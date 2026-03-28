import { Router } from "express";
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
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

// GET /hashtags/trending?limit=10
router.get("/trending", async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await Post.find({
        created_at: { $gte: sevenDaysAgo },
        is_published: true,
    }).select('content');

    const tagCounts = {};
    const tagRegex = /#(\w+)/g;

    for (const row of rows) {
        let match;
        while ((match = tagRegex.exec(row.content)) !== null) {
            const tag = match[1].toLowerCase();
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
    }

    const trending = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag: `#${tag}`, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    res.status(200).json(trending);
});

// GET /hashtags/:tag?page=1&limit=20
router.get("/:tag", async (req, res) => {
    const tag = req.params.tag.replace(/^#/, "");
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const userId = optionalUserId(req);

    const query = {
        content: { $regex: `#${tag}`, $options: 'i' },
        is_published: true,
    };

    const [posts, total] = await Promise.all([
        Post.find(query)
            .sort({ created_at: -1 })
            .skip(offset)
            .limit(limit)
            .populate('user_id', 'username avatar_url')
            .lean(),
        Post.countDocuments(query),
    ]);

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

    res.status(200).json({ tag: `#${tag}`, page, limit, total, chirps });
});

export default router;
