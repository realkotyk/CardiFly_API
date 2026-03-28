import Reaction from '../models/Reaction.js';
import Reply from '../models/Reply.js';
import Rechirp from '../models/Rechirp.js';
import Poll from '../models/Poll.js';
import PollVote from '../models/PollVote.js';
import PostMedia from '../models/PostMedia.js';
import Post from '../models/Post.js';
import User from '../models/User.js';

// Attach likes, dislikes, replies_count, rechirps_count, media, poll, quoted_post
export async function attachExtras(chirps, userId = null) {
    if (!chirps.length) return;

    const ids = chirps.map(c => c.id);

    // Counts
    const [likeCounts, dislikeCounts, replyCounts, rechirpCounts] = await Promise.all([
        Reaction.aggregate([
            { $match: { post_id: { $in: ids }, type: 'like' } },
            { $group: { _id: '$post_id', count: { $sum: 1 } } },
        ]),
        Reaction.aggregate([
            { $match: { post_id: { $in: ids }, type: 'dislike' } },
            { $group: { _id: '$post_id', count: { $sum: 1 } } },
        ]),
        Reply.aggregate([
            { $match: { post_id: { $in: ids } } },
            { $group: { _id: '$post_id', count: { $sum: 1 } } },
        ]),
        Rechirp.aggregate([
            { $match: { post_id: { $in: ids } } },
            { $group: { _id: '$post_id', count: { $sum: 1 } } },
        ]),
    ]);

    const toMap = (arr) => {
        const m = {};
        arr.forEach(r => { m[String(r._id)] = r.count; });
        return m;
    };

    const likes = toMap(likeCounts);
    const dislikes = toMap(dislikeCounts);
    const replies = toMap(replyCounts);
    const rechirps = toMap(rechirpCounts);

    // Media
    const media = await PostMedia.find({ post_id: { $in: ids } }).sort('position').lean();
    const mediaByPost = {};
    media.forEach(m => {
        const key = String(m.post_id);
        (mediaByPost[key] ??= []).push({ id: m._id, post_id: m.post_id, url: m.url, type: m.type, position: m.position });
    });

    // Polls
    const polls = await Poll.find({ post_id: { $in: ids } }).lean();
    const pollMap = {};
    if (polls.length) {
        const pollIds = polls.map(p => p._id);
        const votes = await PollVote.find({ poll_id: { $in: pollIds } }).lean();

        const votesByPoll = {};
        const votesByOption = {};
        votes.forEach(v => {
            const pk = String(v.poll_id);
            const ok = String(v.option_id);
            votesByPoll[pk] = (votesByPoll[pk] || 0) + 1;
            votesByOption[ok] = (votesByOption[ok] || 0) + 1;
        });

        for (const poll of polls) {
            const pk = String(poll._id);
            const options = poll.options.map(o => ({
                id: o._id,
                label: o.label,
                position: o.position,
                votes: votesByOption[String(o._id)] || 0,
            }));
            const total_votes = votesByPoll[pk] || 0;
            let user_vote = null;
            if (userId) {
                const uv = votes.find(v => String(v.poll_id) === pk && String(v.user_id) === String(userId));
                if (uv) user_vote = uv.option_id;
            }
            pollMap[String(poll.post_id)] = { id: poll._id, options, total_votes, ends_at: poll.ends_at, user_vote };
        }
    }

    // Quoted posts
    const quoteIds = [...new Set(chirps.filter(c => c.quoted_post_id).map(c => c.quoted_post_id))];
    const quotedMap = {};
    if (quoteIds.length) {
        const quoted = await Post.find({ _id: { $in: quoteIds } })
            .populate('user_id', 'username avatar_url')
            .lean();
        for (const q of quoted) {
            quotedMap[String(q._id)] = {
                id: q._id,
                content: q.content,
                created_at: q.created_at,
                location: q.location,
                user_id: q.user_id._id,
                username: q.user_id.username,
                avatar_url: q.user_id.avatar_url,
            };
        }
        // Attach media to quoted posts
        const quotedMedia = await PostMedia.find({ post_id: { $in: quoteIds } }).sort('position').lean();
        quotedMedia.forEach(m => {
            const qp = quotedMap[String(m.post_id)];
            if (qp) {
                (qp.media ??= []).push({ id: m._id, post_id: m.post_id, url: m.url, type: m.type, position: m.position });
            }
        });
        // Ensure media array exists
        Object.values(quotedMap).forEach(q => { q.media ??= []; });
    }

    // Assign
    for (const c of chirps) {
        const sid = String(c.id);
        c.likes = likes[sid] || 0;
        c.dislikes = dislikes[sid] || 0;
        c.replies_count = replies[sid] || 0;
        c.rechirps_count = rechirps[sid] || 0;
        c.media = mediaByPost[sid] || [];
        c.poll = pollMap[sid] || undefined;
        c.quoted_post = c.quoted_post_id ? (quotedMap[String(c.quoted_post_id)] || null) : null;
    }
}

// Attach userLiked, userDisliked, userRechirped, userReplied, userQuoted
export async function attachUserState(chirps, userId) {
    if (!userId || !chirps.length) {
        chirps.forEach(c => {
            c.userLiked = false;
            c.userDisliked = false;
            c.userRechirped = false;
            c.userReplied = false;
            c.userQuoted = false;
        });
        return;
    }

    const ids = chirps.map(c => c.id);

    const [userReactions, userRechirps, userReplies, userQuotes] = await Promise.all([
        Reaction.find({ user_id: userId, post_id: { $in: ids } }).lean(),
        Rechirp.find({ user_id: userId, post_id: { $in: ids } }).lean(),
        Reply.find({ user_id: userId, post_id: { $in: ids } }).lean(),
        Post.find({ user_id: userId, quoted_post_id: { $in: ids } }).select('quoted_post_id').lean(),
    ]);

    const reactionMap = {};
    userReactions.forEach(r => { reactionMap[String(r.post_id)] = r.type; });
    const rechirpSet = new Set(userRechirps.map(r => String(r.post_id)));
    const replySet = new Set(userReplies.map(r => String(r.post_id)));
    const quoteSet = new Set(userQuotes.map(r => String(r.quoted_post_id)));

    for (const c of chirps) {
        const sid = String(c.id);
        c.userLiked = reactionMap[sid] === 'like';
        c.userDisliked = reactionMap[sid] === 'dislike';
        c.userRechirped = rechirpSet.has(sid);
        c.userReplied = replySet.has(sid);
        c.userQuoted = quoteSet.has(sid);
    }
}
