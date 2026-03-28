import mongoose from 'mongoose';

const communityMemberSchema = new mongoose.Schema({
  community_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:         { type: String, enum: ['owner', 'member'], default: 'member' },
  status:       { type: String, enum: ['active', 'pending'], default: 'active' },
}, { timestamps: { createdAt: 'joined_at', updatedAt: false } });

communityMemberSchema.index({ community_id: 1, user_id: 1 }, { unique: true });
communityMemberSchema.index({ user_id: 1 });

communityMemberSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default mongoose.model('CommunityMember', communityMemberSchema);
