import db from "../startup/db.js";

const Chirp = {
    create({ user_id, content, location = null, scheduled_at = null }) {
        const is_published = scheduled_at ? 0 : 1;
        const result = db.prepare(
            "INSERT INTO posts (user_id, content, location, scheduled_at, is_published) VALUES (?, ?, ?, ?, ?)"
        ).run(user_id, content, location, scheduled_at, is_published);
        return this.findById(result.lastInsertRowid);
    },

    findById(id) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at, p.location, p.scheduled_at, p.is_published,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
                   (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.id = ?
            GROUP BY p.id
        `).get(id);
    },

    findAll({ limit = 20, offset = 0 } = {}) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at, p.location,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
                   (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.is_published = 1
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
            SELECT p.id, p.content, p.created_at, p.location,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
                   (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.user_id = ? AND p.is_published = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `).all(userId);
    },

    findFollowingFeed(userId, { limit = 20, offset = 0 } = {}) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at, p.location,
                   u.id AS user_id, u.username, u.avatar_url,
                   COALESCE(SUM(CASE WHEN r.type = 'like' THEN 1 END), 0) AS likes,
                   COALESCE(SUM(CASE WHEN r.type = 'dislike' THEN 1 END), 0) AS dislikes,
                   (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS replies_count,
                   (SELECT COUNT(*) FROM rechirps WHERE post_id = p.id) AS rechirps_count
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN reactions r ON r.post_id = p.id
            WHERE p.user_id IN (
                SELECT following_id FROM follows WHERE follower_id = ?
            ) AND p.is_published = 1
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, limit, offset);
    },

    findScheduled(userId) {
        return db.prepare(`
            SELECT p.id, p.content, p.created_at, p.location, p.scheduled_at,
                   u.id AS user_id, u.username, u.avatar_url
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ? AND p.is_published = 0 AND p.scheduled_at IS NOT NULL
            ORDER BY p.scheduled_at ASC
        `).all(userId);
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

    // Attach poll data to an array of chirps
    attachPollData(chirps, userId = null) {
        if (!chirps.length) return;
        const ids = chirps.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        const polls = db.prepare(`
            SELECT pl.id, pl.post_id, pl.duration_hours, pl.ends_at
            FROM polls pl
            WHERE pl.post_id IN (${placeholders})
        `).all(...ids);

        for (const poll of polls) {
            const options = db.prepare(`
                SELECT po.id, po.label, po.position,
                       (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) AS votes
                FROM poll_options po
                WHERE po.poll_id = ?
                ORDER BY po.position
            `).all(poll.id);

            const total_votes = options.reduce((sum, o) => sum + o.votes, 0);
            let user_vote = null;
            if (userId) {
                const vote = db.prepare("SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?").get(poll.id, userId);
                if (vote) user_vote = vote.option_id;
            }

            const chirp = chirps.find(c => c.id === poll.post_id);
            if (chirp) {
                chirp.poll = { id: poll.id, options, total_votes, ends_at: poll.ends_at, user_vote };
            }
        }
    },

    // Attach media to an array of chirps
    attachMedia(chirps) {
        if (!chirps.length) return;
        const ids = chirps.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        const media = db.prepare(`
            SELECT id, post_id, url, type, position FROM post_media
            WHERE post_id IN (${placeholders})
            ORDER BY position
        `).all(...ids);

        const byPost = {};
        media.forEach(m => { (byPost[m.post_id] ??= []).push(m); });
        chirps.forEach(c => { c.media = byPost[c.id] || []; });
    },
};

export default Chirp;
