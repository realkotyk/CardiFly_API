import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import db from '../startup/db.js';

const router = Router();

// @desc    Get notifications for current user
// @route   GET /notifications
// @access  Private
router.get('/', auth, (req, res) => {
    const notifs = db.prepare(`
        SELECT
            n.id,
            n.type,
            n.read,
            n.created_at,
            u.username AS actor,
            p.content   AS post_content
        FROM notifications n
        JOIN users u ON u.id = n.actor_id
        LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.recipient_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
    `).all(req.user.userId);

    res.status(200).json(notifs);
});

// @desc    Mark all notifications as read
// @route   PATCH /notifications/read
// @access  Private
router.patch('/read', auth, (req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE recipient_id = ?')
        .run(req.user.userId);
    res.status(200).json({ ok: true });
});

export default router;
