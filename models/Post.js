import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:  { type: String, default: '', maxlength: 280 },
  location: { type: String, default: null },
  scheduled_at:   { type: Date, default: null },
  is_published:   { type: Boolean, default: true },
  quoted_post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

postSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default mongoose.model('Post', postSchema);
