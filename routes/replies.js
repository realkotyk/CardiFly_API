import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import db from "../startup/db.js";

const router = Router();

// @desc    Toggle like on a reply
// @route   POST /replies/:id/like
// @access  Private
router.post("/:id/like", auth, (req, res) => {
    const replyId = parseInt(req.params.id);
    const userId = req.user.userId;

    const existing = db.prepare(
        "SELECT * FROM reply_reactions WHERE reply_id = ? AND user_id = ?"
    ).get(replyId, userId);

    if (existing?.type === "like") {
        db.prepare("DELETE FROM reply_reactions WHERE reply_id = ? AND user_id = ?")
            .run(replyId, userId);
    } else {
        db.prepare("INSERT OR REPLACE INTO reply_reactions (reply_id, user_id, type) VALUES (?,?,?)")
            .run(replyId, userId, "like");
    }

    const likes = db.prepare("SELECT COUNT(*) as c FROM reply_reactions WHERE reply_id = ? AND type='like'").get(replyId).c;
    const dislikes = db.prepare("SELECT COUNT(*) as c FROM reply_reactions WHERE reply_id = ? AND type='dislike'").get(replyId).c;
    res.json({ likes, dislikes, userLiked: existing?.type !== "like", userDisliked: false });
});

// @desc    Toggle dislike on a reply
// @route   POST /replies/:id/dislike
// @access  Private
router.post("/:id/dislike", auth, (req, res) => {
    const replyId = parseInt(req.params.id);
    const userId = req.user.userId;

    const existing = db.prepare(
        "SELECT * FROM reply_reactions WHERE reply_id = ? AND user_id = ?"
    ).get(replyId, userId);

    if (existing?.type === "dislike") {
        db.prepare("DELETE FROM reply_reactions WHERE reply_id = ? AND user_id = ?")
            .run(replyId, userId);
    } else {
        db.prepare("INSERT OR REPLACE INTO reply_reactions (reply_id, user_id, type) VALUES (?,?,?)")
            .run(replyId, userId, "dislike");
    }

    const likes = db.prepare("SELECT COUNT(*) as c FROM reply_reactions WHERE reply_id = ? AND type='like'").get(replyId).c;
    const dislikes = db.prepare("SELECT COUNT(*) as c FROM reply_reactions WHERE reply_id = ? AND type='dislike'").get(replyId).c;
    res.json({ likes, dislikes, userLiked: false, userDisliked: existing?.type !== "dislike" });
});

export default router;
