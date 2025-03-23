import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { SubscriptionTier } from './Subscription';

interface IUserDocument extends mongoose.Document {
  email: string;
  password: string;
  apiKey: string;
  subscriptionTier: SubscriptionTier;
  requestsRemaining: number;
  resetTokenUsed: boolean;
  resetToken: string;
  resetTokenExpires: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false
    },
    apiKey: {
      type: String,
      unique: true
    },
    subscriptionTier: {
      type: String,
      enum: Object.values(SubscriptionTier),
      default: SubscriptionTier.FREE
    },
    requestsRemaining: {
      type: Number,
      default: 0
    },
    resetTokenUsed: {
      type: Boolean,
      default: false
    },
    resetToken: String,
    resetTokenExpires: Date
  },
  {
    timestamps: true
  }
);

// Pre-save hook to hash the password
userSchema.pre('save', async function(next: mongoose.CallbackWithoutResultAndOptionalError) {
  // Only hash the password if it's modified
  if (!this.isModified('password')) return next();

  // Hash the password with a salt of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUserDocument>('User', userSchema);

export { SubscriptionTier };
export default User; 