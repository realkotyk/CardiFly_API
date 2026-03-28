import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  type:    { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

reactionSchema.index({ user_id: 1, post_id: 1 }, { unique: true });
reactionSchema.index({ post_id: 1 });

reactionSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Reaction', reactionSchema);
