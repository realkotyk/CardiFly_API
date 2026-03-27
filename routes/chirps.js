import { Router } from "express";
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
    res.status(201).json(reply);
});

// @desc    Get replies for a chirp
// @route   GET /api/chirps/:id/replies
// @access  Public
router.get("/:id/replies", (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const replies = db.prepare(
        "SELECT r.id, r.content, r.created_at, u.username, u.avatar_url FROM replies r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? ORDER BY r.created_at ASC"
    ).all(req.params.id);
    res.status(200).json(replies);
});

// @desc    Toggle like
// @route   POST /api/chirps/:id/like
// @access  Private
router.post("/:id/like", auth, (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });
    const result = Chirp.toggleReaction(req.user.userId, req.params.id, "like");
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
    const updated = Chirp.findById(req.params.id);
    res.status(200).json({ ...result, likes: updated.likes, dislikes: updated.dislikes });
});

export default router;
