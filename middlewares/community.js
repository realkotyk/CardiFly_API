import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';

// Loads community by :slug and attaches to req.community
export async function loadCommunity(req, res, next) {
  const community = await Community.findOne({ slug: req.params.slug });
  if (!community) return res.status(404).json({ error: 'Community not found.' });
  req.community = community;
  next();
}

// Requires active membership (owner or member)
export async function requireMember(req, res, next) {
  const membership = await CommunityMember.findOne({
    community_id: req.community._id,
    user_id: req.user.userId,
    status: 'active',
  });
  if (!membership) return res.status(403).json({ error: 'You are not a member of this community.' });
  req.membership = membership;
  next();
}

// Requires owner role
export async function requireOwner(req, res, next) {
  const membership = await CommunityMember.findOne({
    community_id: req.community._id,
    user_id: req.user.userId,
    role: 'owner',
    status: 'active',
  });
  if (!membership) return res.status(403).json({ error: 'Only the owner can perform this action.' });
  req.membership = membership;
  next();
}
