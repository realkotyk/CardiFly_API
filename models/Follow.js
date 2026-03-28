import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  following_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

followSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });
followSchema.index({ following_id: 1 });

followSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Follow', followSchema);
