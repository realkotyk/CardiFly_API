import mongoose from 'mongoose';

const postMediaSchema = new mongoose.Schema({
  post_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  url:      { type: String, required: true },
  type:     { type: String, default: 'image' },
  position: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

postMediaSchema.index({ post_id: 1 });

postMediaSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('PostMedia', postMediaSchema);
