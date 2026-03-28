import { Router } from 'express';
import multer from 'multer';
import { optionalUserId, parsePagination } from '../helpers/utils.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Community from '../models/Community.js';
import CommunityMember from '../models/CommunityMember.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { auth } from '../middlewares/auth.js';
import { loadCommunity, requireMember, requireOwner } from '../middlewares/community.js';
import { attachExtras, attachUserState } from '../helpers/chirpHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commAvatarsDir = path.join(__dirname, '..', 'uploads', 'communities');
if (!fs.existsSync(commAvatarsDir)) fs.mkdirSync(commAvatarsDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const router = Router();

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// POST /api/communities — create
router.post('/', auth, async (req, res) => {
  const { name, description, type, rules } = req.body;
  if (!name || name.trim().length < 3 || name.trim().length > 50) {
    return res.status(400).json({ error: 'Name must be 3-50 characters.' });
  }
  if (description && description.length > 500) {
    return res.status(400).json({ error: 'Description must be 500 characters or less.' });
  }

  const slug = slugify(name.trim());
  if (await Community.findOne({ slug })) {
    return res.status(409).json({ error: 'A community with a similar name already exists.' });
  }

  const community = await Community.create({
    name: name.trim(),
    slug,
    description: description?.trim() || '',
    type: type === 'private' ? 'private' : 'public',
    owner_id: req.user.userId,
    rules: Array.isArray(rules) ? rules.filter(r => r && r.trim()).slice(0, 10) : [],
    member_count: 1,
  });

  await CommunityMember.create({
    community_id: community._id,
    user_id: req.user.userId,
    role: 'owner',
    status: 'active',
  });

  res.status(201).json(community);
});

// GET /api/communities — list/search
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const { page, limit, skip: offset } = parsePagination(req.query, { maxLimit: 50 });

  const filter = q ? { name: { $regex: q, $options: 'i' } } : {};

  const [communities, total] = await Promise.all([
    Community.find(filter)
      .sort({ member_count: -1, created_at: -1 })
      .skip(offset)
      .limit(limit)
      .populate('owner_id', 'username avatar_url'),
    Community.countDocuments(filter),
  ]);

  const userId = optionalUserId(req);
  let membershipMap = {};
  if (userId && communities.length) {
    const memberships = await CommunityMember.find({
      community_id: { $in: communities.map(c => c._id) },
      user_id: userId,
    });
    memberships.forEach(m => { membershipMap[String(m.community_id)] = m; });
  }

  const result = communities.map(c => {
    const cj = c.toJSON();
    const m = membershipMap[String(c._id)];
    cj.owner = { id: c.owner_id._id, username: c.owner_id.username, avatar_url: c.owner_id.avatar_url };
    delete cj.owner_id;
    cj.userMembership = m ? { role: m.role, status: m.status } : null;
    return cj;
  });

  res.status(200).json({ page, limit, total, communities: result });
});

// GET /api/communities/:slug — community page
router.get('/:slug', loadCommunity, async (req, res) => {
  const c = req.community;
  const owner = await User.findById(c.owner_id).select('username avatar_url');

  const userId = optionalUserId(req);
  let userMembership = null;
  if (userId) {
    const m = await CommunityMember.findOne({ community_id: c._id, user_id: userId });
    if (m) userMembership = { role: m.role, status: m.status };
  }

  res.status(200).json({
    ...c.toJSON(),
    owner: owner ? { id: owner._id, username: owner.username, avatar_url: owner.avatar_url } : null,
    userMembership,
  });
});

// PUT /api/communities/:slug — edit (owner only)
router.put('/:slug', auth, loadCommunity, requireOwner, async (req, res) => {
  const { name, description, type, rules } = req.body;
  const c = req.community;

  if (name !== undefined) {
    if (name.trim().length < 3 || name.trim().length > 50) {
      return res.status(400).json({ error: 'Name must be 3-50 characters.' });
    }
    const newSlug = slugify(name.trim());
    const existing = await Community.findOne({ slug: newSlug, _id: { $ne: c._id } });
    if (existing) return res.status(409).json({ error: 'A community with a similar name already exists.' });
    c.name = name.trim();
    c.slug = newSlug;
  }
  if (description !== undefined) {
    if (description.length > 500) return res.status(400).json({ error: 'Description must be 500 characters or less.' });
    c.description = description.trim();
  }
  if (type !== undefined && (type === 'public' || type === 'private')) {
    c.type = type;
  }
  if (rules !== undefined && Array.isArray(rules)) {
    c.rules = rules.filter(r => r && r.trim()).slice(0, 10);
  }

  await c.save();
  res.status(200).json(c);
});

// DELETE /api/communities/:slug — delete (owner only)
router.delete('/:slug', auth, loadCommunity, requireOwner, async (req, res) => {
  const c = req.community;
  await Promise.all([
    CommunityMember.deleteMany({ community_id: c._id }),
    Post.updateMany({ community_id: c._id }, { community_id: null }),
    Community.deleteOne({ _id: c._id }),
  ]);
  res.status(200).json({ message: 'Community deleted.' });
});

// POST /api/communities/:slug/join
router.post('/:slug/join', auth, loadCommunity, async (req, res) => {
  const c = req.community;
  const existing = await CommunityMember.findOne({ community_id: c._id, user_id: req.user.userId });

  if (existing) {
    if (existing.status === 'active') return res.status(400).json({ error: 'You are already a member.' });
    if (existing.status === 'pending') return res.status(400).json({ error: 'Your request is pending approval.' });
  }

  const status = c.type === 'private' ? 'pending' : 'active';
  await CommunityMember.create({
    community_id: c._id,
    user_id: req.user.userId,
    role: 'member',
    status,
  });

  if (status === 'active') {
    await Community.updateOne({ _id: c._id }, { $inc: { member_count: 1 } });
  }

  res.status(200).json({ status, message: status === 'pending' ? 'Join request sent.' : 'Joined community.' });
});

// POST /api/communities/:slug/leave
router.post('/:slug/leave', auth, loadCommunity, async (req, res) => {
  const c = req.community;
  if (String(c.owner_id) === String(req.user.userId)) {
    return res.status(400).json({ error: 'Owner cannot leave. Delete the community instead.' });
  }

  const m = await CommunityMember.findOneAndDelete({ community_id: c._id, user_id: req.user.userId });
  if (!m) return res.status(400).json({ error: 'You are not a member.' });

  if (m.status === 'active') {
    await Community.updateOne({ _id: c._id }, { $inc: { member_count: -1 } });
  }

  res.status(200).json({ message: 'Left community.' });
});

// GET /api/communities/:slug/members
router.get('/:slug/members', loadCommunity, async (req, res) => {
  const c = req.community;
  const userId = optionalUserId(req);

  // For private communities, only members can see the list
  if (c.type === 'private' && userId) {
    const m = await CommunityMember.findOne({ community_id: c._id, user_id: userId, status: 'active' });
    if (!m) return res.status(403).json({ error: 'Only members can view this list.' });
  } else if (c.type === 'private') {
    return res.status(403).json({ error: 'Only members can view this list.' });
  }

  const members = await CommunityMember.find({ community_id: c._id, status: 'active' })
    .sort({ role: 1, joined_at: 1 })
    .populate('user_id', 'username avatar_url bio');

  const result = members.map(m => ({
    id: m.user_id._id,
    username: m.user_id.username,
    avatar_url: m.user_id.avatar_url,
    bio: m.user_id.bio,
    role: m.role,
    joined_at: m.joined_at,
  }));

  res.status(200).json(result);
});

// DELETE /api/communities/:slug/members/:userId — remove member (owner only)
router.delete('/:slug/members/:userId', auth, loadCommunity, requireOwner, async (req, res) => {
  if (String(req.community.owner_id) === req.params.userId) {
    return res.status(400).json({ error: 'Cannot remove the owner.' });
  }

  const m = await CommunityMember.findOneAndDelete({
    community_id: req.community._id,
    user_id: req.params.userId,
  });
  if (!m) return res.status(404).json({ error: 'Member not found.' });

  if (m.status === 'active') {
    await Community.updateOne({ _id: req.community._id }, { $inc: { member_count: -1 } });
  }

  res.status(200).json({ message: 'Member removed.' });
});

// POST /api/communities/:slug/members/:userId/approve — approve pending (owner only)
router.post('/:slug/members/:userId/approve', auth, loadCommunity, requireOwner, async (req, res) => {
  const m = await CommunityMember.findOne({
    community_id: req.community._id,
    user_id: req.params.userId,
    status: 'pending',
  });
  if (!m) return res.status(404).json({ error: 'No pending request found.' });

  m.status = 'active';
  await m.save();
  await Community.updateOne({ _id: req.community._id }, { $inc: { member_count: 1 } });

  res.status(200).json({ message: 'Member approved.' });
});

// POST /api/communities/:slug/members/:userId/reject — reject pending (owner only)
router.post('/:slug/members/:userId/reject', auth, loadCommunity, requireOwner, async (req, res) => {
  const m = await CommunityMember.findOneAndDelete({
    community_id: req.community._id,
    user_id: req.params.userId,
    status: 'pending',
  });
  if (!m) return res.status(404).json({ error: 'No pending request found.' });

  res.status(200).json({ message: 'Request rejected.' });
});

// GET /api/communities/:slug/members/pending — list pending (owner only)
router.get('/:slug/members/pending', auth, loadCommunity, requireOwner, async (req, res) => {
  const pending = await CommunityMember.find({
    community_id: req.community._id,
    status: 'pending',
  }).populate('user_id', 'username avatar_url bio');

  const result = pending.map(m => ({
    id: m.user_id._id,
    username: m.user_id.username,
    avatar_url: m.user_id.avatar_url,
    bio: m.user_id.bio,
    joined_at: m.joined_at,
  }));

  res.status(200).json(result);
});

// GET /api/communities/:slug/chirps — community feed
router.get('/:slug/chirps', loadCommunity, async (req, res) => {
  const c = req.community;
  const userId = optionalUserId(req);

  // Private community: only members can see posts
  if (c.type === 'private') {
    if (!userId) return res.status(403).json({ error: 'Only members can view posts.' });
    const m = await CommunityMember.findOne({ community_id: c._id, user_id: userId, status: 'active' });
    if (!m) return res.status(403).json({ error: 'Only members can view posts.' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const posts = await Post.find({ community_id: c._id, is_published: true })
    .sort({ created_at: -1 })
    .skip(offset)
    .limit(limit)
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
  }));

  await attachExtras(chirps, userId);
  await attachUserState(chirps, userId);

  res.status(200).json({ page, limit, chirps });
});

// POST /api/communities/:slug/chirps — post in community (members only, text only)
router.post('/:slug/chirps', auth, loadCommunity, requireMember, async (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content is required.' });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'Content must be 280 characters or less.' });
  }

  const post = await Post.create({
    user_id: req.user.userId,
    content: content.trim(),
    community_id: req.community._id,
  });

  const full = await Post.findById(post._id).populate('user_id', 'username avatar_url account_type');
  const chirp = {
    id: full._id,
    content: full.content,
    created_at: full.created_at,
    user_id: full.user_id._id,
    username: full.user_id.username,
    avatar_url: full.user_id.avatar_url,
    account_type: full.user_id.account_type || 'standard',
    community_id: full.community_id,
  };

  const result = [chirp];
  await attachExtras(result, req.user.userId);
  await attachUserState(result, req.user.userId);

  res.status(201).json(result[0]);
});

// POST /api/communities/:slug/avatar — upload community avatar (owner only)
router.post('/:slug/avatar', auth, loadCommunity, requireOwner, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const filename = `${req.community._id}.webp`;
    const outputPath = path.join(commAvatarsDir, filename);

    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const url = `/uploads/communities/${filename}`;
    req.community.avatar_url = url;
    await req.community.save();

    res.status(200).json({ url });
  } catch (err) {
    console.error('Community avatar error:', err);
    res.status(500).json({ error: 'Failed to process avatar.' });
  }
});

export default router;
