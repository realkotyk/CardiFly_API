import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password_hash: { type: String, required: true, select: false },
  avatar_url: { type: String, default: null },
  bio: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password_hash;
  },
});

export default mongoose.model('User', userSchema);
