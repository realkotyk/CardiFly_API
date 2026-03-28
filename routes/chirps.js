import { Router } from "express";
import jwt from "jsonwebtoken";
import Chirp from "../models/chirp.js";
import { auth } from "../middlewares/auth.js";
import db from "../startup/db.js";

const router = Router();

// Helper: extract @mentioned usernames from content and create 'mention' notifications
function createMentionNotifications(content, actorId, postId) {
    const matches = content.match(/@(\w+)/g);
    if (!matches) return;
    const usernames = [...new Set(matches.map(m => m.slice(1)))];
    const insertNotif = db.prepare(
        "INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES (?, ?, 'mention', ?)"
    );
    for (const username of usernames) {
        const user = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
        if (user && user.id !== actorId) {
            insertNotif.run(user.id, actorId, postId);
        }
    }
}

// Helper: extract userId from optional Bearer token
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

// @desc    Get paginated feed
// @route   GET /api/chirps?page=1&limit=20
// @access  Public
router.get("/", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const chirps = Chirp.findAll({ limit, offset });

    const userId = optionalUserId(req);

    Chirp.attachPollData(chirps, userId);
    Chirp.attachMedia(chirps);

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

    Chirp.attachPollData(chirps, req.user.userId);
    Chirp.attachMedia(chirps);

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

// @desc    Get user's scheduled posts
// @route   GET /api/chirps/scheduled
// @access  Private
router.get("/scheduled", auth, (req, res) => {
    const chirps = Chirp.findScheduled(req.user.userId);
    Chirp.attachPollData(chirps, req.user.userId);
    Chirp.attachMedia(chirps);
    res.status(200).json(chirps);
});

// @desc    Get single chirp
// @route   GET /api/chirps/:id
// @access  Public
router.get("/:id", (req, res) => {
    const chirp = Chirp.findById(req.params.id);
    if (!chirp) return res.status(404).json({ error: "Chirp not found." });

    const userId = optionalUserId(req);
    const chirps = [chirp];
    Chirp.attachPollData(chirps, userId);
    Chirp.attachMedia(chirps);

    res.status(200).json(chirps[0]);
});

// @desc    Create a chirp
// @route   POST /api/chirps
// @access  Private
router.post("/", auth, (req, res) => {
    const { content, location, poll, media_urls, gif_url, scheduled_at } = req.body;

    const hasContent = content && content.trim().length > 0;
    const hasMedia = (Array.isArray(media_urls) && media_urls.length > 0) || gif_url;
    const hasPoll = poll && Array.isArray(poll.options) && poll.options.filter(o => o && o.trim()).length >= 2;

    if (!hasContent && !hasMedia && !hasPoll) {
        return res.status(400).json({ error: "content, media, poll, or gif is required." });
    }
    if (content && content.length > 280) {
        return res.status(400).json({ error: "content must be 280 characters or less." });
    }

    const chirp = Chirp.create({
        user_id: req.user.userId,
        content: content ? content.trim() : "",
        location: location || null,
        scheduled_at: scheduled_at || null,
    });

    // Create poll if provided
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
        const durationHours = poll.duration_hours || 24;
        const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
        const pollResult = db.prepare(
            "INSERT INTO polls (post_id, duration_hours, ends_at) VALUES (?, ?, ?)"
        ).run(chirp.id, durationHours, endsAt);
        const insertOption = db.prepare(
            "INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)"
        );
        poll.options.forEach((label, i) => {
            insertOption.run(pollResult.lastInsertRowid, label, i);
        });
    }

    // Insert media URLs
    if (Array.isArray(media_urls) && media_urls.length > 0) {
        const insertMedia = db.prepare(
            "INSERT INTO post_media (post_id, url, type, position) VALUES (?, ?, 'image', ?)"
        );
        media_urls.forEach((url, i) => {
            insertMedia.run(chirp.id, url, i);
        });
    }

    // Insert GIF
    if (gif_url) {
        db.prepare(
            "INSERT INTO post_media (post_id, url, type, position) VALUES (?, ?, 'gif', 0)"
        ).run(chirp.id, gif_url);
    }

    if (content) {
        createMentionNotifications(content, req.user.userId, chirp.id);
    }

    // Re-fetch with attachments
    const result = [Chirp.findById(chirp.id)];
    Chirp.attachPollData(result, req.user.userId);
    Chirp.attachMedia(result);

    res.status(201).json(result[0]);
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

// @desc    Vote on a poll option
// @route   POST /api/chirps/:id/vote
// @access  Private
router.post("/:id/vote", auth, (req, res) => {
    const { option_id } = req.body;
    if (!option_id) {
        return res.status(400).json({ error: "option_id is required." });
    }

    const poll = db.prepare("SELECT * FROM polls WHERE post_id = ?").get(req.params.id);
    if (!poll) {
        return res.status(404).json({ error: "Poll not found." });
    }

    // Check poll not expired
    if (new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: "Poll has ended." });
    }

    // Check option belongs to this poll
    const option = db.prepare("SELECT * FROM poll_options WHERE id = ? AND poll_id = ?").get(option_id, poll.id);
    if (!option) {
        return res.status(400).json({ error: "Invalid option for this poll." });
    }

    // Check user hasn't already voted
    const existing = db.prepare("SELECT * FROM poll_votes WHERE poll_id = ? AND user_id = ?").get(poll.id, req.user.userId);
    if (existing) {
        return res.status(400).json({ error: "You have already voted on this poll." });
    }

    db.prepare("INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)").run(poll.id, option_id, req.user.userId);

    // Return updated poll data
    const options = db.prepare(`
        SELECT po.id, po.label, po.position,
               (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) AS votes
        FROM poll_options po
        WHERE po.poll_id = ?
        ORDER BY po.position
    `).all(poll.id);
    const total_votes = options.reduce((sum, o) => sum + o.votes, 0);

    res.status(200).json({ poll_id: poll.id, options, total_votes, user_vote: option_id });
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
    createMentionNotifications(content, req.user.userId, chirp.id);
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

    const userId = optionalUserId(req);

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
