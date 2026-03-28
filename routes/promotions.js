import { Router } from 'express';
import Promotion from '../models/Promotion.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { auth } from '../middlewares/auth.js';
import { attachExtras, attachUserState } from '../helpers/chirpHelpers.js';

const router = Router();

// POST / — create a promotion for a chirp
router.post('/', auth, async (req, res) => {
  const { post_id, budget_cents } = req.body;

  if (!post_id) return res.status(400).json({ error: 'post_id is required.' });
  if (!budget_cents || budget_cents < 100) {
    return res.status(400).json({ error: 'Minimum budget is $1.00 (100 cents).' });
  }

  const post = await Post.findById(post_id);
  if (!post) return res.status(404).json({ error: 'Chirp not found.' });
  if (String(post.user_id) !== String(req.user.userId)) {
    return res.status(403).json({ error: 'You can only promote your own chirps.' });
  }

  // Check no active promotion exists for this post
  const existing = await Promotion.findOne({ post_id, status: 'active' });
  if (existing) {
    return res.status(400).json({ error: 'This chirp already has an active promotion.' });
  }

  const promo = await Promotion.create({
    post_id,
    user_id: req.user.userId,
    budget_cents,
  });

  res.status(201).json(promo);
});

// GET /mine — list my promotions
router.get('/mine', auth, async (req, res) => {
  const promos = await Promotion.find({ user_id: req.user.userId })
    .sort({ created_at: -1 })
    .limit(50)
    .lean();
  res.json(promos);
});

// PATCH /:id/pause — pause a promotion
router.patch('/:id/pause', auth, async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promotion not found.' });
  if (String(promo.user_id) !== String(req.user.userId)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  promo.status = 'paused';
  await promo.save();
  res.json(promo);
});

// PATCH /:id/resume — resume a paused promotion
router.patch('/:id/resume', auth, async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promotion not found.' });
  if (String(promo.user_id) !== String(req.user.userId)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  if (promo.spent_cents >= promo.budget_cents) {
    return res.status(400).json({ error: 'Budget exhausted. Add more budget first.' });
  }
  promo.status = 'active';
  await promo.save();
  res.json(promo);
});

// DELETE /:id — cancel a promotion
router.delete('/:id', auth, async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promotion not found.' });
  if (String(promo.user_id) !== String(req.user.userId)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  promo.status = 'cancelled';
  await promo.save();
  res.json({ message: 'Promotion cancelled.' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL: Get promoted chirps for feed interleaving
// Called from chirps route, not exposed as API directly
// ═══════════════════════════════════════════════════════════════════════════════
export async function getPromotedChirps(userId = null, count = 2) {
  // Find active promotions with remaining budget
  const promos = await Promotion.aggregate([
    { $match: { status: 'active' } },
    { $addFields: { remaining: { $subtract: ['$budget_cents', '$spent_cents'] } } },
    { $match: { remaining: { $gt: 0 } } },
    // Randomize selection so same ad doesn't always show
    { $sample: { size: count } },
  ]);

  if (!promos.length) return [];

  const postIds = promos.map(p => p.post_id);
  const posts = await Post.find({ _id: { $in: postIds }, is_published: true })
    .populate('user_id', 'username avatar_url account_type')
    .lean();

  const chirps = posts.map(p => ({
    id: p._id,
    content: p.content,
    created_at: p.created_at,
    location: p.location,
    quoted_post_id: p.quoted_post_id,
    user_id: p.user_id._id,
    username: p.user_id.username,
    avatar_url: p.user_id.avatar_url,
    account_type: p.user_id.account_type || 'standard',
    is_promoted: true,
    promotion_id: promos.find(pr => String(pr.post_id) === String(p._id))?._id,
  }));

  if (chirps.length) {
    await attachExtras(chirps, userId);
    await attachUserState(chirps, userId);

    // Record impressions + spend
    for (const promo of promos) {
      await Promotion.updateOne(
        { _id: promo._id },
        {
          $inc: { impressions: 1, spent_cents: promo.cost_per_impression || 1 },
        }
      );
      // Auto-complete if budget exhausted
      const updated = await Promotion.findById(promo._id);
      if (updated && updated.spent_cents >= updated.budget_cents) {
        updated.status = 'completed';
        await updated.save();
      }
    }
  }

  return chirps;
}

// POST /:id/click — record a click on promoted chirp
router.post('/:id/click', async (req, res) => {
  await Promotion.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } });
  res.json({ ok: true });
});

export default router;
