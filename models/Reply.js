import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 280 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

replySchema.index({ post_id: 1 });

replySchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Reply', replySchema);
