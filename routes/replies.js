import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import ReplyReaction from "../models/ReplyReaction.js";

const router = Router();

// POST /replies/:id/like
router.post("/:id/like", auth, async (req, res) => {
    const replyId = req.params.id;
    const userId = req.user.userId;

    const existing = await ReplyReaction.findOne({ reply_id: replyId, user_id: userId });

    if (existing?.type === "like") {
        await ReplyReaction.deleteOne({ _id: existing._id });
    } else if (existing) {
        existing.type = "like";
        await existing.save();
    } else {
        await ReplyReaction.create({ reply_id: replyId, user_id: userId, type: "like" });
    }

    const [likes, dislikes] = await Promise.all([
        ReplyReaction.countDocuments({ reply_id: replyId, type: 'like' }),
        ReplyReaction.countDocuments({ reply_id: replyId, type: 'dislike' }),
    ]);

    res.json({ likes, dislikes, userLiked: existing?.type !== "like", userDisliked: false });
});

// POST /replies/:id/dislike
router.post("/:id/dislike", auth, async (req, res) => {
    const replyId = req.params.id;
    const userId = req.user.userId;

    const existing = await ReplyReaction.findOne({ reply_id: replyId, user_id: userId });

    if (existing?.type === "dislike") {
        await ReplyReaction.deleteOne({ _id: existing._id });
    } else if (existing) {
        existing.type = "dislike";
        await existing.save();
    } else {
        await ReplyReaction.create({ reply_id: replyId, user_id: userId, type: "dislike" });
    }

    const [likes, dislikes] = await Promise.all([
        ReplyReaction.countDocuments({ reply_id: replyId, type: 'like' }),
        ReplyReaction.countDocuments({ reply_id: replyId, type: 'dislike' }),
    ]);

    res.json({ likes, dislikes, userLiked: false, userDisliked: existing?.type !== "dislike" });
});

export default router;
