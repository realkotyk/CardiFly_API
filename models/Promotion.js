import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  post_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Budget & delivery
  budget_cents:     { type: Number, required: true },           // total budget in cents (e.g. 300 = $3.00)
  spent_cents:      { type: Number, default: 0 },               // how much has been spent
  cost_per_impression: { type: Number, default: 1 },            // cost in cents per impression (1 cent default)
  impressions:      { type: Number, default: 0 },               // times shown in feed
  clicks:           { type: Number, default: 0 },               // times clicked
  // Lifecycle
  status:  { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active' },
  starts_at: { type: Date, default: Date.now },
  ends_at:   { type: Date, default: null },                     // null = run until budget exhausted
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Index for fast feed queries: find active promotions that still have budget
promotionSchema.index({ status: 1, spent_cents: 1 });

promotionSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

export default mongoose.model('Promotion', promotionSchema);
