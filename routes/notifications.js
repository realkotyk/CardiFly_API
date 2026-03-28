import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import Notification from '../models/Notification.js';

const router = Router();

// GET /notifications
router.get('/', auth, async (req, res) => {
    const notifs = await Notification.find({ recipient_id: req.user.userId })
        .sort({ created_at: -1 })
        .limit(50)
        .populate('actor_id', 'username')
        .populate('post_id', 'content');

    const result = notifs.map(n => ({
        id: n._id,
        type: n.type,
        read: n.read,
        created_at: n.created_at,
        actor: n.actor_id?.username,
        post_content: n.post_id?.content,
    }));

    res.status(200).json(result);
});

// PATCH /notifications/read
router.patch('/read', auth, async (req, res) => {
    await Notification.updateMany({ recipient_id: req.user.userId }, { read: true });
    res.status(200).json({ ok: true });
});

export default router;
