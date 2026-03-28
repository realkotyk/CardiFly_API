import mongoose from 'mongoose';

const replyReactionSchema = new mongoose.Schema({
  reply_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Reply', required: true },
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:     { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

replyReactionSchema.index({ reply_id: 1, user_id: 1 }, { unique: true });

replyReactionSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('ReplyReaction', replyReactionSchema);
