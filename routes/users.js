import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Reaction from "../models/Reaction.js";
import Follow from "../models/Follow.js";
import Reply from "../models/Reply.js";
import Rechirp from "../models/Rechirp.js";
import ReplyReaction from "../models/ReplyReaction.js";
import CommunityMember from "../models/CommunityMember.js";
import Community from "../models/Community.js";
import Notification from "../models/Notification.js";
import { auth } from "../middlewares/auth.js";
import { attachExtras, attachUserState } from "../helpers/chirpHelpers.js";

const router = Router();

function optionalUserId(req) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
            return decoded.userId;
        } catch {}
    }
    return null;
}

// GET /api/users/search?q=partial
router.get("/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(200).json([]);
    const users = await User.find({
        username: { $regex: `^${q}`, $options: 'i' },
    }).select('username avatar_url').limit(10).sort('username');
    res.status(200).json(users);
});

// GET /api/users/suggestions
router.get("/suggestions", async (req, res) => {
    const currentUserId = optionalUserId(req);

    const excludeIds = [];
    if (currentUserId) {
        excludeIds.push(new mongoose.Types.ObjectId(currentUserId));
        const following = await Follow.find({ follower_id: currentUserId }).select('following_id');
        following.forEach(f => excludeIds.push(f.following_id));
    }

    const suggestions = await User.aggregate([
        { $match: { _id: { $nin: excludeIds } } },
        {
            $lookup: {
                from: 'follows', localField: '_id', foreignField: 'following_id', as: 'followerDocs',
            },
        },
        {
            $lookup: {
                from: 'posts', localField: '_id', foreignField: 'user_id', as: 'postDocs',
            },
        },
        {
            $addFields: {
                followers_count: { $size: '$followerDocs' },
                posts_count: { $size: '$postDocs' },
                id: '$_id',
            },
        },
        { $sort: { followers_count: -1, posts_count: -1 } },
        { $limit: 3 },
        { $project: { id: 1, username: 1, bio: 1, avatar_url: 1, followers_count: 1, posts_count: 1, account_type: { $ifNull: ['$account_type', 'standard'] }, _id: 0 } },
    ]);

    res.status(200).json(suggestions);
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const [followersCount, followingCount, chirpCount] = await Promise.all([
        Follow.countDocuments({ following_id: user._id }),
        Follow.countDocuments({ follower_id: user._id }),
        Post.countDocuments({ user_id: user._id, is_published: true }),
    ]);

    let isFollowing = false;
    const currentUserId = optionalUserId(req);
    if (currentUserId) {
        isFollowing = !!(await Follow.findOne({ follower_id: currentUserId, following_id: user._id }));
    }

    res.status(200).json({ ...user.toJSON(), followersCount, followingCount, chirpCount, isFollowing });
});

// PATCH /api/users/:id
router.patch("/:id", auth, async (req, res) => {
    if (String(req.params.id) !== String(req.user.userId)) {
        return res.status(403).json({ error: "Not authorized." });
    }
    const { avatar_url, bio, display_name, country, city } = req.body;
    const updates = {};
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (bio !== undefined) updates.bio = bio;
    if (display_name !== undefined) updates.display_name = display_name;
    if (country !== undefined) updates.country = country;
    if (city !== undefined) updates.city = city;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.status(200).json(user);
});

// POST /api/users/:id/follow
router.post("/:id/follow", auth, async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const target = await User.findOne(query);
    if (!target) return res.status(404).json({ error: "User not found." });
    if (String(target._id) === String(req.user.userId)) {
        return res.status(400).json({ error: "You cannot follow yourself." });
    }

    const existing = await Follow.findOne({ follower_id: req.user.userId, following_id: target._id });
    if (existing) {
        await Follow.deleteOne({ _id: existing._id });
    } else {
        await Follow.create({ follower_id: req.user.userId, following_id: target._id });
        await Notification.create({ recipient_id: target._id, actor_id: req.user.userId, type: 'follow' });
    }

    const followersCount = await Follow.countDocuments({ following_id: target._id });
    res.status(200).json({ isFollowing: !existing, followersCount });
});

// GET /api/users/:id/posts
router.get("/:id/posts", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const userId = optionalUserId(req);
    const posts = await Post.find({ user_id: user._id, is_published: true })
        .sort({ created_at: -1 })
        .populate('user_id', 'username avatar_url account_type')
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
        account_type: p.user_id.account_type || 'standard',
    }));

    await attachExtras(chirps, userId);
    await attachUserState(chirps, userId);
    res.status(200).json(chirps);
});

// GET /api/users/:id/likes
router.get("/:id/likes", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const reactions = await Reaction.find({ user_id: user._id, type: 'like' }).sort({ created_at: -1 });
    const postIds = reactions.map(r => r.post_id);
    const posts = await Post.find({ _id: { $in: postIds } })
        .populate('user_id', 'username avatar_url account_type')
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
        account_type: p.user_id.account_type || 'standard',
        userLiked: true,
        userDisliked: false,
    }));

    await attachExtras(chirps);
    res.status(200).json(chirps);
});

// GET /api/users/:id/replies
router.get("/:id/replies", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const replies = await Reply.find({ user_id: user._id })
        .sort({ created_at: -1 })
        .populate('user_id', 'username avatar_url account_type')
        .populate({ path: 'post_id', populate: { path: 'user_id', select: 'username' } })
        .lean();

    const result = await Promise.all(replies.map(async (r) => {
        const likes = await ReplyReaction.countDocuments({ reply_id: r._id, type: 'like' });
        const dislikes = await ReplyReaction.countDocuments({ reply_id: r._id, type: 'dislike' });
        return {
            id: r._id,
            content: r.content,
            created_at: r.created_at,
            username: r.user_id.username,
            avatar_url: r.user_id.avatar_url,
            account_type: r.user_id.account_type || 'standard',
            post_id: r.post_id?._id,
            post_content: r.post_id?.content,
            post_username: r.post_id?.user_id?.username,
            likes,
            dislikes,
        };
    }));

    res.status(200).json(result);
});

// GET /api/users/:id/followers
router.get("/:id/followers", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const follows = await Follow.find({ following_id: user._id })
        .sort({ created_at: -1 })
        .populate('follower_id', 'username avatar_url');
    const result = follows.map(f => ({
        id: f.follower_id._id,
        username: f.follower_id.username,
        avatar_url: f.follower_id.avatar_url,
    }));
    res.status(200).json(result);
});

// GET /api/users/:id/following
router.get("/:id/following", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const follows = await Follow.find({ follower_id: user._id })
        .sort({ created_at: -1 })
        .populate('following_id', 'username avatar_url');
    const result = follows.map(f => ({
        id: f.following_id._id,
        username: f.following_id.username,
        avatar_url: f.following_id.avatar_url,
    }));
    res.status(200).json(result);
});

// GET /api/users/:id/communities
router.get("/:id/communities", async (req, res) => {
    const query = mongoose.isValidObjectId(req.params.id)
        ? { _id: req.params.id }
        : { username: req.params.id };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ error: "User not found." });

    const memberships = await CommunityMember.find({ user_id: user._id, status: 'active' })
        .populate({ path: 'community_id', populate: { path: 'owner_id', select: 'username avatar_url' } });

    const communities = memberships.map(m => {
        const c = m.community_id;
        return {
            id: c._id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            type: c.type,
            member_count: c.member_count,
            role: m.role,
            owner: { id: c.owner_id._id, username: c.owner_id.username, avatar_url: c.owner_id.avatar_url },
        };
    });

    res.status(200).json(communities);
});

export default router;
