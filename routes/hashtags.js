import { Router } from "express";
import jwt from "jsonwebtoken";
import db from "../startup/db.js";

const router = Router();

// @desc    Get trending hashtags (extracted from post content)
// @route   GET /hashtags/trending?limit=10
// @access  Public
router.get("/trending", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Extract all hashtags from posts in the last 7 days
    const rows = db.prepare(`
        SELECT content FROM posts
        WHERE created_at >= datetime('now', '-7 days')
        ORDER BY created_at DESC
    `).all();

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

// @desc    Get posts by hashtag
// @route   GET /hashtags/:tag?page=1&limit=20
// @access  Public
router.get("/:tag", (req, res) => {
    const tag = req.params.tag.replace(/^#/, "");
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    let userId = null;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch {}
    }

    const chirps = db.prepare(`
        SELECT p.id, p.content, p.created_at,
               u.id AS user_id, u.username, u.avatar_url,
               COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
               COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
               (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
               (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN reactions r ON r.post_id = p.id
        WHERE LOWER(p.content) LIKE ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    `).all(`%#${tag.toLowerCase()}%`, limit, offset);

    // Add user reaction state
    chirps.forEach(c => {
        if (userId) {
            const reaction = db.prepare(
                "SELECT type FROM reactions WHERE post_id = ? AND user_id = ?"
            ).get(c.id, userId);
            c.userLiked = reaction?.type === "like";
            c.userDisliked = reaction?.type === "dislike";
            c.userRechirped = !!db.prepare(
                "SELECT id FROM rechirps WHERE post_id = ? AND user_id = ?"
            ).get(c.id, userId);
            c.userReplied = !!db.prepare(
                "SELECT id FROM replies WHERE post_id = ? AND user_id = ?"
            ).get(c.id, userId);
        } else {
            c.userLiked = false;
            c.userDisliked = false;
            c.userRechirped = false;
            c.userReplied = false;
        }
    });

    const total = db.prepare(
        "SELECT COUNT(*) as c FROM posts WHERE LOWER(content) LIKE ?"
    ).get(`%#${tag.toLowerCase()}%`).c;

    res.status(200).json({ tag: `#${tag}`, page, limit, total, chirps });
});

export default router;
