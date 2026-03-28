import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['like', 'dislike', 'follow', 'reply', 'rechirp', 'mention'], required: true },
  post_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  read:         { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

notificationSchema.index({ recipient_id: 1, created_at: -1 });

notificationSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Notification', notificationSchema);
