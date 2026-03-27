import { Router } from "express";
import Post from "../models/post.js";
import Reaction from "../models/reaction.js";
import { checkAuth } from "../middlewares/check-auth.js";

const router = Router();

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
router.post("/", checkAuth, (req, res) => {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content is required." });
    }

    if (content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }

    const post = Post.create({ user_id: req.userData.userId, content: content.trim() });
    res.status(201).json(post);
});

// @desc    Get paginated public feed (newest first)
// @route   GET /api/posts?page=1&limit=20
// @access  Public
router.get("/", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const posts = Post.findAll({ limit, offset });
    res.status(200).json({ page, limit, posts });
});

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
router.get("/:id", (req, res) => {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    res.status(200).json(post);
});

// @desc    Delete a post (author only)
// @route   DELETE /api/posts/:id
// @access  Private
router.delete("/:id", checkAuth, (req, res) => {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });

    if (post.user_id !== req.userData.userId) {
        return res.status(403).json({ error: "Not authorized to delete this post." });
    }

    Post.delete(req.params.id);
    res.status(200).json({ message: "Post deleted." });
});

// @desc    Toggle like on a post
// @route   POST /api/posts/:id/like
// @access  Private
router.post("/:id/like", checkAuth, (req, res) => {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });

    const result = Reaction.toggle(req.userData.userId, req.params.id, "like");
    const counts = Reaction.countsByPost(req.params.id);
    res.status(200).json({ ...result, ...counts });
});

// @desc    Toggle dislike on a post
// @route   POST /api/posts/:id/dislike
// @access  Private
router.post("/:id/dislike", checkAuth, (req, res) => {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });

    const result = Reaction.toggle(req.userData.userId, req.params.id, "dislike");
    const counts = Reaction.countsByPost(req.params.id);
    res.status(200).json({ ...result, ...counts });
});

export default router;
