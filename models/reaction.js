import db from "../startup/db.js";

const Reaction = {
    // Returns the existing reaction for a user on a post, or undefined
    findByUserAndPost(user_id, post_id) {
        return db.prepare(
            "SELECT * FROM reactions WHERE user_id = ? AND post_id = ?"
        ).get(user_id, post_id);
    },

    // Toggle logic:
    // - No reaction → insert new reaction of given type
    // - Same type exists → remove it (untoggle)
    // - Different type exists → update to new type
    // Returns { action: 'added'|'removed'|'changed', type }
    toggle(user_id, post_id, type) {
        const existing = this.findByUserAndPost(user_id, post_id);

        if (!existing) {
            db.prepare(
                "INSERT INTO reactions (user_id, post_id, type) VALUES (?, ?, ?)"
            ).run(user_id, post_id, type);
            return { action: "added", type };
        }

        if (existing.type === type) {
            db.prepare(
                "DELETE FROM reactions WHERE user_id = ? AND post_id = ?"
            ).run(user_id, post_id);
            return { action: "removed", type };
        }

        db.prepare(
            "UPDATE reactions SET type = ? WHERE user_id = ? AND post_id = ?"
        ).run(type, user_id, post_id);
        return { action: "changed", type };
    },

    countsByPost(post_id) {
        return db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'like' THEN 1 ELSE 0 END), 0) AS likes,
                COALESCE(SUM(CASE WHEN type = 'dislike' THEN 1 ELSE 0 END), 0) AS dislikes
            FROM reactions WHERE post_id = ?
        `).get(post_id);
    },
};

export default Reaction;
