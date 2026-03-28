import db from "./startup/db.js";

export function startScheduler() {
    setInterval(() => {
        const now = new Date().toISOString();
        const due = db.prepare(
            "SELECT id FROM posts WHERE is_published = 0 AND scheduled_at <= ? AND scheduled_at IS NOT NULL"
        ).all(now);

        if (due.length > 0) {
            const ids = due.map(r => r.id);
            const placeholders = ids.map(() => '?').join(',');
            db.prepare(
                `UPDATE posts SET is_published = 1, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id IN (${placeholders})`
            ).run(...ids);
            console.log(`Published ${ids.length} scheduled chirp(s)`);
        }
    }, 60_000);
}
