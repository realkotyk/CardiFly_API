import { Router } from 'express';
import User from '../models/User.js';
import { auth } from '../middlewares/auth.js';

const router = Router();

// Subscription plans config
const PLANS = {
  monthly: { price_cents: 99, duration_days: 30, label: 'Monthly' },
  yearly:  { price_cents: 199, duration_days: 365, label: 'Yearly' },
};

// GET /subscription/plans — public plan info
router.get('/plans', (req, res) => {
  const plans = Object.entries(PLANS).map(([id, p]) => ({
    id,
    label: p.label,
    price_cents: p.price_cents,
    price_display: `$${(p.price_cents / 100).toFixed(2)}`,
    duration_days: p.duration_days,
  }));
  res.json({ plans });
});

// GET /subscription/status — current user's subscription
router.get('/status', auth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const isActive = user.isVip();
  res.json({
    account_type: user.account_type,
    subscription_plan: user.subscription_plan,
    subscription_expires_at: user.subscription_expires_at,
    is_active: isActive,
  });
});

// POST /subscription/activate — activate FlyPass
// In production this would be called by a Stripe webhook after payment.
// For now it's a direct endpoint for testing + future Stripe integration.
router.post('/activate', auth, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Use "monthly" or "yearly".' });
  }

  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const config = PLANS[plan];
  const now = new Date();

  // If already VIP and not expired, extend from current expiry
  const baseDate = (user.isVip() && user.subscription_expires_at > now)
    ? user.subscription_expires_at
    : now;

  const expiresAt = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + config.duration_days);

  user.account_type = 'vip';
  user.subscription_plan = plan;
  user.subscription_expires_at = expiresAt;
  await user.save();

  res.json({
    message: 'FlyPass activated!',
    account_type: 'vip',
    subscription_plan: plan,
    subscription_expires_at: expiresAt,
  });
});

// POST /subscription/cancel — cancel (reverts to default at expiry)
router.post('/cancel', auth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (user.account_type !== 'vip') {
    return res.status(400).json({ error: 'No active subscription.' });
  }

  // Don't remove VIP immediately — let it expire
  user.subscription_plan = null; // signals "won't renew"
  await user.save();

  res.json({
    message: 'Subscription cancelled. FlyPass active until expiry.',
    subscription_expires_at: user.subscription_expires_at,
  });
});

export default router;
