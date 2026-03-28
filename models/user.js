import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password_hash: { type: String, required: true, select: false },
  avatar_url: { type: String, default: null },
  display_name: { type: String, default: null },
  bio: { type: String, default: null },
  country: { type: String, default: null },
  city: { type: String, default: null },
  // FlyPass subscription
  account_type: { type: String, enum: ['standard', 'vip'], default: 'standard' },
  subscription_plan: { type: String, enum: ['monthly', 'yearly', null], default: null },
  subscription_expires_at: { type: Date, default: null },
  stripe_customer_id: { type: String, default: null },
  // Creator earnings (Stripe Connect)
  stripe_account_id: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Helper: check if user currently has active VIP
userSchema.methods.isVip = function() {
  return this.account_type === 'vip' &&
    this.subscription_expires_at &&
    new Date(this.subscription_expires_at) > new Date();
};

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
