import mongoose from 'mongoose';

const communitySchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true, minlength: 3, maxlength: 50 },
  slug:         { type: String, required: true, unique: true },
  description:  { type: String, default: '', maxlength: 500 },
  type:         { type: String, enum: ['public', 'private'], default: 'public' },
  owner_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rules:        [{ type: String }],
  member_count: { type: Number, default: 1 },
  avatar_url:   { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

communitySchema.index({ owner_id: 1 });

communitySchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default mongoose.model('Community', communitySchema);
