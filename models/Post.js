import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:  { type: String, default: '', maxlength: 1000 },  // 280 default, 1000 for VIP (enforced in route)
  location: { type: String, default: null },
  scheduled_at:   { type: Date, default: null },
  is_published:   { type: Boolean, default: true },
  quoted_post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  community_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

postSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

// Indexes for query performance
postSchema.index({ scheduled_at: 1 });
postSchema.index({ community_id: 1, is_published: 1 });
postSchema.index({ user_id: 1, is_published: 1, created_at: -1 });

export default mongoose.model('Post', postSchema);
