import db from "../startup/db.js";

const Post = {
    create({ user_id, content }) {
        const stmt = db.prepare(
            "INSERT INTO posts (user_id, content) VALUES (?, ?)"
        );
        const result = stmt.run(user_id, content);
        return this.findById(result.lastInsertRowid);
    },

    findById(id) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = ?
        `).get(id);
    },

    findAll({ limit = 20, offset = 0 } = {}) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at,
                   u.id AS user_id, u.username, u.avatar_url
            FROM posts p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);
    },

    delete(id) {
        return db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    },
};

export default Post;
