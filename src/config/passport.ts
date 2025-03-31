import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User, { SubscriptionTier } from '../models/User';
import { v4 as uuidv4 } from 'uuid';

// Get environment variables
const FREE_TRIAL_REQUESTS = parseInt(process.env.FREE_TRIAL_REQUESTS || '50', 10);

// Configure Passport to use Google OAuth 2.0 strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user exists in the database
        const existingUser = await User.findOne({ email: profile.emails?.[0].value });

        if (existingUser) {
          // User already exists, return the user
          return done(null, existingUser);
        }

        // Generate unique API key for new user
        const apiKey = uuidv4();

        // Create a new user with Google profile info
        const newUser = await User.create({
          email: profile.emails?.[0].value,
          password: uuidv4(), // Random password for OAuth users, not used for login
          apiKey,
          subscriptionTier: SubscriptionTier.FREE,
          requestsRemaining: FREE_TRIAL_REQUESTS,
          googleId: profile.id
        });

        return done(null, newUser);
      } catch (error) {
        console.error('Error in Google Strategy:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

// Serialize user to the session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport; 