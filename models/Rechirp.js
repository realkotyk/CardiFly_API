import mongoose from 'mongoose';

const rechirpSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

rechirpSchema.index({ post_id: 1, user_id: 1 }, { unique: true });

rechirpSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Rechirp', rechirpSchema);
