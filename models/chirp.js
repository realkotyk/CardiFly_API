import db from "../startup/db.js";

const Chirp = {
    create({ user_id, content }) {
        const result = db.prepare(
            "INSERT INTO posts (user_id, content) VALUES (?, ?)"
        ).run(user_id, content);
        return this.findById(result.lastInsertRowid);
    },

    findById(id) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
        `).get(id);
    },

    findAll({ limit = 20, offset = 0 } = {}) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
    },

    update(id, content) {
        db.prepare("UPDATE posts SET content = ? WHERE id = ?").run(content, id);
        return this.findById(id);
    },

    findByUserId(userId) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `).all(userId);
    },

    findFollowingFeed(userId, { limit = 20, offset = 0 } = {}) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.user_id IN (
                SELECT following_id FROM follows WHERE follower_id = ?
            )
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, limit, offset);
    },

    delete(id) {
        return db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    },

    toggleReaction(user_id, post_id, type) {
        const existing = db.prepare(
            "SELECT * FROM reactions WHERE user_id = ? AND post_id = ?"
        ).get(user_id, post_id);

        if (!existing) {
            db.prepare("INSERT INTO reactions (user_id, post_id, type) VALUES (?, ?, ?)").run(user_id, post_id, type);
            return { action: "added", type };
        }
        if (existing.type === type) {
            db.prepare("DELETE FROM reactions WHERE user_id = ? AND post_id = ?").run(user_id, post_id);
            return { action: "removed", type };
        }
        db.prepare("UPDATE reactions SET type = ? WHERE user_id = ? AND post_id = ?").run(type, user_id, post_id);
        return { action: "changed", type };
    },
};

export default Chirp;
