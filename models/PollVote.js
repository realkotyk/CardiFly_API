import mongoose from 'mongoose';

const pollVoteSchema = new mongoose.Schema({
  poll_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true },
  option_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

pollVoteSchema.index({ poll_id: 1, user_id: 1 }, { unique: true });

pollVoteSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('PollVote', pollVoteSchema);
