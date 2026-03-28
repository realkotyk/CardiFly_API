import { Router } from "express";
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Reaction from "../models/Reaction.js";
import Rechirp from "../models/Rechirp.js";
import Reply from "../models/Reply.js";
import ReplyReaction from "../models/ReplyReaction.js";
import Poll from "../models/Poll.js";
import PollVote from "../models/PollVote.js";
import PostMedia from "../models/PostMedia.js";
import Notification from "../models/Notification.js";
import Follow from "../models/Follow.js";
import { auth } from "../middlewares/auth.js";
import { attachExtras, attachUserState } from "../helpers/chirpHelpers.js";

const router = Router();

function optionalUserId(req) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        try {
            return jwt.verify(header.split(" ")[1], process.env.JWT_SECRET).userId;
        } catch {}
    }
    return null;
}

async function createMentionNotifications(content, actorId, postId) {
    const matches = content.match(/@(\w+)/g);
    if (!matches) return;
    const usernames = [...new Set(matches.map(m => m.slice(1)))];
    for (const username of usernames) {
        const user = await User.findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
        if (user && String(user._id) !== String(actorId)) {
            await Notification.create({ recipient_id: user._id, actor_id: actorId, type: 'mention', post_id: postId });
        }
    }
}

async function postToChirp(post) {
    const p = post.toObject ? post.toObject() : post;
    const user = p.user_id;
    return {
        id: p._id,
        content: p.content,
        created_at: p.created_at,
        location: p.location,
        scheduled_at: p.scheduled_at,
        is_published: p.is_published,
        quoted_post_id: p.quoted_post_id,
        user_id: user._id || user,
        username: user.username,
        avatar_url: user.avatar_url,
    };
}

// GET / — paginated feed
router.get("/", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const userId = optionalUserId(req);

    const posts = await Post.find({ is_published: true })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate('user_id', 'username avatar_url')
        .lean();

    const chirps = posts.map(p => ({
        id: p._id,
        content: p.content,
        created_at: p.created_at,
        location: p.location,
        quoted_post_id: p.quoted_post_id,
        user_id: p.user_id._id,
        username: p.user_id.username,
        avatar_url: p.user_id.avatar_url,
    }));

    await attachExtras(chirps, userId);
    await attachUserState(chirps, userId);

    res.status(200).json({ page, limit, chirps });
});

// GET /following
router.get("/following", auth, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const following = await Follow.find({ follower_id: req.user.userId }).select('following_id');
    const followingIds = following.map(f => f.following_id);

    const posts = await Post.find({ user_id: { $in: followingIds }, is_published: true })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .populate('user_id', 'username avatar_url')
        .lean();

    const chirps = posts.map(p => ({
        id: p._id,
        content: p.content,
        created_at: p.created_at,
        location: p.location,
        quoted_post_id: p.quoted_post_id,
        user_id: p.user_id._id,
        username: p.user_id.username,
        avatar_url: p.user_id.avatar_url,
    }));

    await attachExtras(chirps, req.user.userId);
    await attachUserState(chirps, req.user.userId);

    res.status(200).json({ page, limit, chirps });
});

// GET /scheduled
router.get("/scheduled", auth, async (req, res) => {
    const posts = await Post.find({
        user_id: req.user.userId,
        is_published: false,
        scheduled_at: { $ne: null },
    }).sort({ scheduled_at: 1 }).populate('user_id', 'username avatar_url').lean();

    const chirps = posts.map(p => ({
        id: p._id,
        content: p.content,
        created_at: p.created_at,
        location: p.location,
        scheduled_at: p.scheduled_at,
        user_id: p.user_id._id,
        username: p.user_id.username,
        avatar_url: p.user_id.avatar_url,
    }));

    await attachExtras(chirps, req.user.userId);
    res.status(200).json(chirps);
});

// GET /:id
router.get("/:id", async (req, res) => {
    const post = await Post.findById(req.params.id).populate('user_id', 'username avatar_url');
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const userId = optionalUserId(req);
    const chirp = {
        id: post._id,
        content: post.content,
        created_at: post.created_at,
        location: post.location,
        scheduled_at: post.scheduled_at,
        is_published: post.is_published,
        quoted_post_id: post.quoted_post_id,
        user_id: post.user_id._id,
        username: post.user_id.username,
        avatar_url: post.user_id.avatar_url,
    };

    const chirps = [chirp];
    await attachExtras(chirps, userId);
    await attachUserState(chirps, userId);

    res.status(200).json(chirps[0]);
});

// POST / — create chirp
router.post("/", auth, async (req, res) => {
    const { content, location, poll, media_urls, gif_url, scheduled_at, quoted_post_id } = req.body;

    const hasContent = content && content.trim().length > 0;
    const hasMedia = (Array.isArray(media_urls) && media_urls.length > 0) || gif_url;
    const hasPoll = poll && Array.isArray(poll.options) && poll.options.filter(o => o && o.trim()).length >= 2;
    const hasQuote = !!quoted_post_id;

    if (!hasContent && !hasMedia && !hasPoll && !hasQuote) {
        return res.status(400).json({ error: "content, media, poll, gif, or quote is required." });
    }
    if (content && content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }

    const post = await Post.create({
        user_id: req.user.userId,
        content: content ? content.trim() : "",
        location: location || null,
        scheduled_at: scheduled_at || null,
        is_published: !scheduled_at,
        quoted_post_id: quoted_post_id || null,
    });

    // Create poll
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
        const durationHours = poll.duration_hours || 24;
        const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
        const options = poll.options.map((label, i) => ({ label, position: i }));
        await Poll.create({ post_id: post._id, duration_hours: durationHours, ends_at: endsAt, options });
    }

    // Insert media
    if (Array.isArray(media_urls) && media_urls.length > 0) {
        await PostMedia.insertMany(media_urls.map((url, i) => ({
            post_id: post._id, url, type: 'image', position: i,
        })));
    }
    if (gif_url) {
        await PostMedia.create({ post_id: post._id, url: gif_url, type: 'gif', position: 0 });
    }

    if (content) {
        await createMentionNotifications(content, req.user.userId, post._id);
    }

    // Re-fetch with user populated
    const full = await Post.findById(post._id).populate('user_id', 'username avatar_url');
    const chirp = {
        id: full._id,
        content: full.content,
        created_at: full.created_at,
        location: full.location,
        quoted_post_id: full.quoted_post_id,
        user_id: full.user_id._id,
        username: full.user_id.username,
        avatar_url: full.user_id.avatar_url,
    };
    const result = [chirp];
    await attachExtras(result, req.user.userId);
    await attachUserState(result, req.user.userId);

    res.status(201).json(result[0]);
});

// PATCH /:id
router.patch("/:id", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });
    if (String(post.user_id) !== String(req.user.userId)) {
        return res.status(403).json({ error: "Not authorized." });
    }
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }
    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }
    post.content = content.trim();
    await post.save();

    const full = await Post.findById(post._id).populate('user_id', 'username avatar_url');
    const chirp = {
        id: full._id,
        content: full.content,
        created_at: full.created_at,
        location: full.location,
        user_id: full.user_id._id,
        username: full.user_id.username,
        avatar_url: full.user_id.avatar_url,
    };
    const result = [chirp];
    await attachExtras(result, req.user.userId);
    res.status(200).json(result[0]);
});

// DELETE /:id
router.delete("/:id", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });
    if (String(post.user_id) !== String(req.user.userId)) {
        return res.status(403).json({ error: "Not authorized." });
    }
    // Cascade delete related data
    await Promise.all([
        Reaction.deleteMany({ post_id: post._id }),
        Reply.deleteMany({ post_id: post._id }),
        Rechirp.deleteMany({ post_id: post._id }),
        PostMedia.deleteMany({ post_id: post._id }),
        Poll.deleteMany({ post_id: post._id }),
        Notification.deleteMany({ post_id: post._id }),
        Post.deleteOne({ _id: post._id }),
    ]);
    res.status(200).json({ message: "Chirp deleted." });
});

// POST /:id/vote
router.post("/:id/vote", auth, async (req, res) => {
    const { option_id } = req.body;
    if (!option_id) return res.status(400).json({ error: "option_id is required." });

    const poll = await Poll.findOne({ post_id: req.params.id });
    if (!poll) return res.status(404).json({ error: "Poll not found." });

    if (new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: "Poll has ended." });
    }

    const option = poll.options.id(option_id);
    if (!option) return res.status(400).json({ error: "Invalid option for this poll." });

    const existing = await PollVote.findOne({ poll_id: poll._id, user_id: req.user.userId });
    if (existing) return res.status(400).json({ error: "You have already voted on this poll." });

    await PollVote.create({ poll_id: poll._id, option_id, user_id: req.user.userId });

    // Return updated poll
    const votes = await PollVote.find({ poll_id: poll._id });
    const votesByOption = {};
    votes.forEach(v => { votesByOption[String(v.option_id)] = (votesByOption[String(v.option_id)] || 0) + 1; });

    const options = poll.options.map(o => ({
        id: o._id,
        label: o.label,
        position: o.position,
        votes: votesByOption[String(o._id)] || 0,
    }));

    res.status(200).json({ poll_id: poll._id, options, total_votes: votes.length, user_vote: option_id });
});

// POST /:id/reply
router.post("/:id/reply", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }
    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }

    const reply = await Reply.create({ post_id: post._id, user_id: req.user.userId, content: content.trim() });
    const populated = await Reply.findById(reply._id).populate('user_id', 'username avatar_url');

    if (String(post.user_id) !== String(req.user.userId)) {
        await Notification.create({ recipient_id: post.user_id, actor_id: req.user.userId, type: 'reply', post_id: post._id });
    }
    await createMentionNotifications(content, req.user.userId, post._id);

    res.status(201).json({
        id: populated._id,
        content: populated.content,
        created_at: populated.created_at,
        username: populated.user_id.username,
        avatar_url: populated.user_id.avatar_url,
    });
});

// GET /:id/replies
router.get("/:id/replies", async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const replies = await Reply.find({ post_id: post._id })
        .sort({ created_at: 1 })
        .populate('user_id', 'username avatar_url')
        .lean();

    const userId = optionalUserId(req);
    const replyIds = replies.map(r => r._id);

    const [likeCounts, dislikeCounts] = await Promise.all([
        ReplyReaction.aggregate([
            { $match: { reply_id: { $in: replyIds }, type: 'like' } },
            { $group: { _id: '$reply_id', count: { $sum: 1 } } },
        ]),
        ReplyReaction.aggregate([
            { $match: { reply_id: { $in: replyIds }, type: 'dislike' } },
            { $group: { _id: '$reply_id', count: { $sum: 1 } } },
        ]),
    ]);

    const likeMap = {};
    likeCounts.forEach(r => { likeMap[String(r._id)] = r.count; });
    const dislikeMap = {};
    dislikeCounts.forEach(r => { dislikeMap[String(r._id)] = r.count; });

    let userReactionMap = {};
    if (userId) {
        const userReactions = await ReplyReaction.find({ user_id: userId, reply_id: { $in: replyIds } });
        userReactions.forEach(r => { userReactionMap[String(r.reply_id)] = r.type; });
    }

    const result = replies.map(r => ({
        id: r._id,
        content: r.content,
        created_at: r.created_at,
        username: r.user_id.username,
        avatar_url: r.user_id.avatar_url,
        likes: likeMap[String(r._id)] || 0,
        dislikes: dislikeMap[String(r._id)] || 0,
        userLiked: userReactionMap[String(r._id)] === 'like',
        userDisliked: userReactionMap[String(r._id)] === 'dislike',
    }));

    res.status(200).json(result);
});

// POST /:id/rechirp
router.post("/:id/rechirp", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const existing = await Rechirp.findOne({ post_id: post._id, user_id: req.user.userId });
    if (existing) {
        await Rechirp.deleteOne({ _id: existing._id });
    } else {
        await Rechirp.create({ post_id: post._id, user_id: req.user.userId });
        if (String(post.user_id) !== String(req.user.userId)) {
            await Notification.create({ recipient_id: post.user_id, actor_id: req.user.userId, type: 'rechirp', post_id: post._id });
        }
    }

    const count = await Rechirp.countDocuments({ post_id: post._id });
    res.status(200).json({ rechirped: !existing, count });
});

// POST /:id/like
router.post("/:id/like", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const existing = await Reaction.findOne({ user_id: req.user.userId, post_id: post._id });
    let action;
    if (!existing) {
        await Reaction.create({ user_id: req.user.userId, post_id: post._id, type: 'like' });
        action = 'added';
    } else if (existing.type === 'like') {
        await Reaction.deleteOne({ _id: existing._id });
        action = 'removed';
    } else {
        existing.type = 'like';
        await existing.save();
        action = 'changed';
    }

    if (action !== 'removed' && String(post.user_id) !== String(req.user.userId)) {
        await Notification.create({ recipient_id: post.user_id, actor_id: req.user.userId, type: 'like', post_id: post._id });
    }

    const [likes, dislikes] = await Promise.all([
        Reaction.countDocuments({ post_id: post._id, type: 'like' }),
        Reaction.countDocuments({ post_id: post._id, type: 'dislike' }),
    ]);

    res.status(200).json({ action, type: 'like', likes, dislikes });
});

// POST /:id/dislike
router.post("/:id/dislike", auth, async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Chirp not found." });

    const existing = await Reaction.findOne({ user_id: req.user.userId, post_id: post._id });
    let action;
    if (!existing) {
        await Reaction.create({ user_id: req.user.userId, post_id: post._id, type: 'dislike' });
        action = 'added';
    } else if (existing.type === 'dislike') {
        await Reaction.deleteOne({ _id: existing._id });
        action = 'removed';
    } else {
        existing.type = 'dislike';
        await existing.save();
        action = 'changed';
    }

    if (action !== 'removed' && String(post.user_id) !== String(req.user.userId)) {
        await Notification.create({ recipient_id: post.user_id, actor_id: req.user.userId, type: 'dislike', post_id: post._id });
    }

    const [likes, dislikes] = await Promise.all([
        Reaction.countDocuments({ post_id: post._id, type: 'like' }),
        Reaction.countDocuments({ post_id: post._id, type: 'dislike' }),
    ]);

    res.status(200).json({ action, type: 'dislike', likes, dislikes });
});

export default router;
