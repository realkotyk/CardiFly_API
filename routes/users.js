import { Router } from "express";
import User from "../models/user.js";
import Chirp from "../models/chirp.js";
import { auth } from "../middlewares/auth.js";

const router = Router();

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Public
router.get("/:id", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.status(200).json(user);
});

// @desc    Update own profile (avatar_url, bio)
// @route   PATCH /api/users/:id
// @access  Private
router.patch("/:id", auth, (req, res) => {
    if (parseInt(req.params.id) !== req.user.userId) {
        return res.status(403).json({ error: "Not authorized." });
    }
    const user = User.update(req.params.id, req.body);
    res.status(200).json(user);
});

// @desc    Toggle follow/unfollow a user
// @route   POST /api/users/:id/follow
// @access  Private
router.post("/:id/follow", auth, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (targetId === req.user.userId) {
        return res.status(400).json({ error: "You cannot follow yourself." });
    }
    if (!User.findById(targetId)) {
        return res.status(404).json({ error: "User not found." });
    }
    const result = User.toggleFollow(req.user.userId, targetId);
    res.status(200).json(result);
});

// @desc    Get all posts by a user with reaction counts
// @route   GET /api/users/:id/posts
// @access  Public
router.get("/:id/posts", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.status(200).json(Chirp.findByUserId(user.id));
});

// @desc    List followers of a user
// @route   GET /api/users/:id/followers
// @access  Public
router.get("/:id/followers", (req, res) => {
    if (!User.findById(req.params.id)) {
        return res.status(404).json({ error: "User not found." });
    }
    res.status(200).json(User.followers(req.params.id));
});

// @desc    List users a user is following
// @route   GET /api/users/:id/following
// @access  Public
router.get("/:id/following", (req, res) => {
    if (!User.findById(req.params.id)) {
        return res.status(404).json({ error: "User not found." });
    }
    res.status(200).json(User.following(req.params.id));
});

export default router;
