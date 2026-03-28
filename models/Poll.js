import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
  label:    { type: String, required: true, maxlength: 80 },
  position: { type: Number, default: 0 },
});

pollOptionSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

const pollSchema = new mongoose.Schema({
  post_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
  duration_hours: { type: Number, default: 24 },
  ends_at:        { type: Date, required: true },
  options:        [pollOptionSchema],
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

pollSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; },
});

export default mongoose.model('Poll', pollSchema);
