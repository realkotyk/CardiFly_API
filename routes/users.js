import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Chirp from "../models/chirp.js";
import { auth } from "../middlewares/auth.js";
import db from "../startup/db.js";

const router = Router();

// @desc    Search users by username prefix (for @mention autocomplete)
// @route   GET /api/users/search?q=partial
// @access  Public
router.get("/search", (req, res) => {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(200).json([]);
    const users = db.prepare(`
        SELECT id, username, avatar_url
        FROM users
        WHERE username LIKE ? COLLATE NOCASE
        ORDER BY username ASC
        LIMIT 10
    `).all(`${q}%`);
    res.status(200).json(users);
});

// @desc    Get 3 most active users not yet followed by the requester
// @route   GET /api/users/suggestions
// @access  Public (auth optional)
router.get("/suggestions", (req, res) => {
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
            currentUserId = decoded.userId;
        } catch {}
    }

    const suggestions = db.prepare(`
        SELECT u.id, u.username, u.bio, u.avatar_url,
               (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count
        FROM users u
        WHERE u.id != COALESCE(?, -1)
          AND u.id NOT IN (
              SELECT following_id FROM follows WHERE follower_id = COALESCE(?, -1)
          )
        ORDER BY (followers_count + posts_count) DESC
        LIMIT 3
    `).all(currentUserId, currentUserId);

    res.status(200).json(suggestions);
});

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Public
router.get("/:id", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    let isFollowing = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
            isFollowing = User.isFollowing(decoded.userId, user.id);
        } catch {}
    }

    res.status(200).json({ ...user, isFollowing });
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
    const target = User.findByIdOrUsername(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if (target.id === req.user.userId) {
        return res.status(400).json({ error: "You cannot follow yourself." });
    }
    const result = User.toggleFollow(req.user.userId, target.id);
    if (result.isFollowing) {
        db.prepare("INSERT INTO notifications (recipient_id, actor_id, type) VALUES (?, ?, 'follow')")
            .run(target.id, req.user.userId);
    }
    res.status(200).json(result);
});

// @desc    Get all posts by a user with reaction counts
// @route   GET /api/users/:id/posts
// @access  Public
router.get("/:id/posts", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        try {
            const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch {}
    }

    const posts = Chirp.findByUserId(user.id);
    posts.forEach(p => {
        if (userId) {
            const reaction = db.prepare(
                "SELECT type FROM reactions WHERE post_id = ? AND user_id = ?"
            ).get(p.id, userId);
            p.userLiked = reaction?.type === "like";
            p.userDisliked = reaction?.type === "dislike";
            p.userRechirped = !!db.prepare(
                "SELECT id FROM rechirps WHERE post_id = ? AND user_id = ?"
            ).get(p.id, userId);
            p.userReplied = !!db.prepare(
                "SELECT id FROM replies WHERE post_id = ? AND user_id = ?"
            ).get(p.id, userId);
        } else {
            p.userLiked = false;
            p.userDisliked = false;
            p.userRechirped = false;
            p.userReplied = false;
        }
    });
    res.status(200).json(posts);
});

// @desc    Get posts liked by a user
// @route   GET /api/users/:id/likes
// @access  Public
router.get("/:id/likes", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const liked = db.prepare(`
        SELECT p.id, p.content, p.created_at,
               u.id AS user_id, u.username, u.avatar_url,
               (SELECT COUNT(*) FROM reactions WHERE post_id = p.id AND type = 'like') AS likes,
               (SELECT COUNT(*) FROM reactions WHERE post_id = p.id AND type = 'dislike') AS dislikes,
               (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
               (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count,
               1 AS userLiked, 0 AS userDisliked
        FROM reactions r
        JOIN posts p ON r.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE r.user_id = ? AND r.type = 'like'
        ORDER BY r.created_at DESC
    `).all(user.id);

    res.status(200).json(liked);
});

// @desc    Get replies made by a user
// @route   GET /api/users/:id/replies
// @access  Public
router.get("/:id/replies", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const replies = db.prepare(`
        SELECT
            r.id, r.content, r.created_at,
            u.username, u.avatar_url,
            p.id AS post_id, p.content AS post_content,
            pu.username AS post_username,
            (SELECT COUNT(*) FROM reply_reactions WHERE reply_id = r.id AND type = 'like') AS likes,
            (SELECT COUNT(*) FROM reply_reactions WHERE reply_id = r.id AND type = 'dislike') AS dislikes
        FROM replies r
        JOIN users u ON u.id = r.user_id
        JOIN posts p ON p.id = r.post_id
        JOIN users pu ON pu.id = p.user_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    `).all(user.id);

    res.status(200).json(replies);
});

// @desc    List followers of a user
// @route   GET /api/users/:id/followers
// @access  Public
router.get("/:id/followers", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.status(200).json(User.followers(user.id));
});

// @desc    List users a user is following
// @route   GET /api/users/:id/following
// @access  Public
router.get("/:id/following", (req, res) => {
    const user = User.findByIdOrUsername(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.status(200).json(User.following(user.id));
});

export default router;
