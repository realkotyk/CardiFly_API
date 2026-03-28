import Post from './models/Post.js';

export function startScheduler() {
    setInterval(async () => {
        try {
            const now = new Date();
            const result = await Post.updateMany(
                { is_published: false, scheduled_at: { $lte: now, $ne: null } },
                { is_published: true, created_at: now },
            );
            if (result.modifiedCount > 0) {
                console.log(`Published ${result.modifiedCount} scheduled chirp(s)`);
            }
        } catch (err) {
            console.error('Scheduler error:', err.message);
        }
    }, 60_000);
}
