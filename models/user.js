import db from "../startup/db.js";

const User = {
    findByEmail(email) {
        return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    },

    findByUsername(username) {
        return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    },

    findById(id) {
        return db.prepare(
            "SELECT id, username, email, avatar_url, bio, created_at FROM users WHERE id = ?"
        ).get(id);
    },

    findByIdOrUsername(param) {
        const col = /^\d+$/.test(String(param)) ? "id" : "username";
        return db.prepare(`
            SELECT u.id, u.username, u.email, u.avatar_url, u.bio, u.created_at,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followersCount,
                   (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS followingCount,
                   (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS chirpCount
            FROM users u WHERE u.${col} = ?
        `).get(param);
    },

    create({ username, email, password_hash }) {
        const result = db.prepare(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
        ).run(username, email, password_hash);
        return this.findById(result.lastInsertRowid);
    },

    update(id, { avatar_url, bio }) {
        db.prepare(
            "UPDATE users SET avatar_url = COALESCE(?, avatar_url), bio = COALESCE(?, bio) WHERE id = ?"
        ).run(avatar_url ?? null, bio ?? null, id);
        return this.findById(id);
    },

    isFollowing(follower_id, following_id) {
        return !!db.prepare(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
        ).get(follower_id, following_id);
    },

    // Follow toggle: returns { isFollowing, followersCount }
    toggleFollow(follower_id, following_id) {
        const existing = db.prepare(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
        ).get(follower_id, following_id);

        if (existing) {
            db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(follower_id, following_id);
        } else {
            db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(follower_id, following_id);
        }

        const followersCount = db.prepare(
            "SELECT COUNT(*) as c FROM follows WHERE following_id = ?"
        ).get(following_id).c;

        return { isFollowing: !existing, followersCount };
    },

    followers(user_id) {
        return db.prepare(`
            SELECT u.id, u.username, u.avatar_url
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            WHERE f.following_id = ?
            ORDER BY f.created_at DESC
        `).all(user_id);
    },

    following(user_id) {
        return db.prepare(`
            SELECT u.id, u.username, u.avatar_url
            FROM follows f
            JOIN users u ON u.id = f.following_id
            WHERE f.follower_id = ?
            ORDER BY f.created_at DESC
        `).all(user_id);
    },
};

export default User;
