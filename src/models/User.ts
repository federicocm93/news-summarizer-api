import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SubscriptionTier } from '../enums/SubscriptionTier';

// Get environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30d';

export interface IUserDocument extends mongoose.Document {
  email: string;
  password: string;
  apiKey: string;
  subscriptionTier: SubscriptionTier;
  subscriptionExpirationDate: Date;
  requestsRemaining: number;
  resetTokenUsed: boolean;
  resetToken: string;
  resetTokenExpires: Date;
  externalId?: string;
  subscriptionExternalId?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateJWT(): string;
  generatePremiumMonthlySubscription(): void;
  generatePremiumYearlySubscription(): void;
  generateProMonthlySubscription(): void;
  generateProYearlySubscription(): void;
  hasRemainingRequests(): boolean;
  isSubscriptionActive(): boolean;
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
    subscriptionExpirationDate: {
      type: Date,
      default: null
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
    resetTokenExpires: Date,
    externalId: {
      type: String,
      unique: true,
      sparse: true
    },
    subscriptionExternalId: {
      type: String,
      unique: true,
      sparse: true
    }
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

// Method to generate JWT token
userSchema.methods.generateJWT = function(): string {
  return jwt.sign({ id: this._id, email: this.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN});
};

userSchema.methods.generatePremiumMonthlySubscription = function(): void {
  this.subscriptionTier = SubscriptionTier.PREMIUM;
  this.requestsRemaining = 500;
  this.subscriptionExpirationDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
};

userSchema.methods.generatePremiumYearlySubscription = function(): void {
  this.subscriptionTier = SubscriptionTier.PREMIUM;
  this.subscriptionExpirationDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
};

userSchema.methods.generateProMonthlySubscription = function(): void {
  this.subscriptionTier = SubscriptionTier.PRO;
  this.requestsRemaining = 5000;
  this.subscriptionExpirationDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
};

userSchema.methods.generateProYearlySubscription = function(): void {
  this.subscriptionTier = SubscriptionTier.PRO;
  this.subscriptionExpirationDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
};

userSchema.methods.hasRemainingRequests = function(): boolean {
  return this.requestsRemaining > 0;
};

userSchema.methods.isSubscriptionActive = function(): boolean {
  return this.subscriptionExpirationDate && this.subscriptionExpirationDate > new Date();
};

const User = mongoose.model<IUserDocument>('User', userSchema);

export { SubscriptionTier };
export default User; 