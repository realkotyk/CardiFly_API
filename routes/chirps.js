import { Router } from "express";
import jwt from "jsonwebtoken";
import Chirp from "../models/chirp.js";
import { auth } from "../middlewares/auth.js";
import db from "../startup/db.js";

const router = Router();

// @desc    Get paginated feed
// @route   GET /api/chirps?page=1&limit=20
// @access  Public
router.get("/", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const chirps = Chirp.findAll({ limit, offset });

    let userId = null;
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch {}
    }

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

    res.status(200).json({ page, limit, chirps });
});

// @desc    Get feed from followed users
// @route   GET /api/chirps/following
// @access  Private
router.get("/following", auth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const chirps = Chirp.findFollowingFeed(req.user.userId, { limit, offset });
    chirps.forEach(c => {
        const reaction = db.prepare(
            "SELECT type FROM reactions WHERE post_id = ? AND user_id = ?"
        ).get(c.id, req.user.userId);
        c.userLiked = reaction?.type === "like";
        c.userDisliked = reaction?.type === "dislike";
        c.userRechirped = !!db.prepare(
            "SELECT id FROM rechirps WHERE post_id = ? AND user_id = ?"
        ).get(c.id, req.user.userId);
        c.userReplied = !!db.prepare(
            "SELECT id FROM replies WHERE post_id = ? AND user_id = ?"
        ).get(c.id, req.user.userId);
    });
    res.status(200).json({ page, limit, chirps });
});

// @desc    Get single chirp
// @route   GET /api/chirps/:id
// @access  Public
router.get("/:id", (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    res.status(200).json(chirp);
});

// @desc    Create a chirp
// @route   POST /api/chirps
// @access  Private
router.post("/", auth, (req, res) => {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }
    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }
    const chirp = Chirp.create({ user_id: req.user.userId, content: content.trim() });
    res.status(201).json(chirp);
});

// @desc    Update a chirp (author only)
// @route   PATCH /api/chirps/:id
// @access  Private
router.patch("/:id", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    if (chirp.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Not authorized." });
    }
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }
    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }
    const updated = Chirp.update(req.params.id, content.trim());
    res.status(200).json(updated);
});

// @desc    Delete a chirp (author only)
// @route   DELETE /api/chirps/:id
// @access  Private
router.delete("/:id", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    if (chirp.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Not authorized." });
    }
    Chirp.delete(req.params.id);
    res.status(200).json({ message: "Chirp deleted." });
});

// @desc    Post a reply to a chirp
// @route   POST /api/chirps/:id/reply
// @access  Private
router.post("/:id/reply", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }
    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }
    const result = db.prepare(
        "INSERT INTO replies (post_id, user_id, content) VALUES (?, ?, ?)"
    ).run(req.params.id, req.user.userId, content.trim());
    const reply = db.prepare(
        "SELECT r.id, r.content, r.created_at, u.username, u.avatar_url FROM replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?"
    ).get(result.lastInsertRowid);
    if (chirp.user_id !== req.user.userId) {
        db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, 'reply', ?)")
            .run(chirp.user_id, req.user.userId, chirp.id);
    }
    res.status(201).json(reply);
});

// @desc    Get replies for a chirp
// @route   GET /api/chirps/:id/replies
// @access  Public
router.get("/:id/replies", (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const replies = db.prepare(`
        SELECT r.id, r.content, r.created_at, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM reply_reactions WHERE reply_id = r.id AND type = 'like') as likes,
            (SELECT COUNT(*) FROM reply_reactions WHERE reply_id = r.id AND type = 'dislike') as dislikes
        FROM replies r
        JOIN users u ON u.id = r.user_id
        WHERE r.post_id = ?
        ORDER BY r.created_at ASC
    `).all(req.params.id);

    let userId = null;
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch { /* invalid token — treat as unauthenticated */ }
    }

    if (userId) {
        replies.forEach(r => {
            const reaction = db.prepare(
                "SELECT type FROM reply_reactions WHERE reply_id = ? AND user_id = ?"
            ).get(r.id, userId);
            r.userLiked = reaction?.type === "like";
            r.userDisliked = reaction?.type === "dislike";
        });
    }

    res.status(200).json(replies);
});

// @desc    Toggle rechirp
// @route   POST /api/chirps/:id/rechirp
// @access  Private
router.post("/:id/rechirp", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });

    const existing = db.prepare(
        "SELECT id FROM rechirps WHERE post_id = ? AND user_id = ?"
    ).get(req.params.id, req.user.userId);

    if (existing) {
        db.prepare("DELETE FROM rechirps WHERE post_id = ? AND user_id = ?")
            .run(req.params.id, req.user.userId);
    } else {
        db.prepare("INSERT INTO rechirps (post_id, user_id) VALUES (?, ?)")
            .run(req.params.id, req.user.userId);
        if (chirp.user_id !== req.user.userId) {
            db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, 'rechirp', ?)")
                .run(chirp.user_id, req.user.userId, chirp.id);
        }
    }

    const count = db.prepare(
        "SELECT COUNT(*) as c FROM rechirps WHERE post_id = ?"
    ).get(req.params.id).c;

    res.status(200).json({ rechirped: !existing, count });
});

// @desc    Toggle like
// @route   POST /api/chirps/:id/like
// @access  Private
router.post("/:id/like", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const result = Chirp.toggleReaction(req.user.userId, req.params.id, "like");
    const reactionNow = db.prepare("SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND type = 'like'").get(req.params.id, req.user.userId);
    if (reactionNow && chirp.user_id !== req.user.userId) {
        db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, 'like', ?)")
            .run(chirp.user_id, req.user.userId, chirp.id);
    }
    const updated = Chirp.findById(req.params.id);
    res.status(200).json({ ...result, likes: updated.likes, dislikes: updated.dislikes });
});

// @desc    Toggle dislike
// @route   POST /api/chirps/:id/dislike
// @access  Private
router.post("/:id/dislike", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const result = Chirp.toggleReaction(req.user.userId, req.params.id, "dislike");
    const reactionNow = db.prepare("SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND type = 'dislike'").get(req.params.id, req.user.userId);
    if (reactionNow && chirp.user_id !== req.user.userId) {
        db.prepare("INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, 'dislike', ?)")
            .run(chirp.user_id, req.user.userId, chirp.id);
    }
    const updated = Chirp.findById(req.params.id);
    res.status(200).json({ ...result, likes: updated.likes, dislikes: updated.dislikes });
});

export default router;
