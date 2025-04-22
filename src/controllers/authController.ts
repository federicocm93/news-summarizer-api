import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { SubscriptionTier } from '../models/User';

// Get environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30d';
const FREE_TRIAL_REQUESTS = parseInt(process.env.FREE_TRIAL_REQUESTS || '50', 10);

// Generate JWT token
const signToken = (id: string, email: string): string => {
  return jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN});
};

// Register a new user
export const register = async (req: any, res: any): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 8 characters long'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        status: 'fail',
        message: 'User already exists with this email'
      });
      return;
    }

    // Generate unique API key
    const apiKey = uuidv4();

    // Create new user with free trial requests
    const newUser = await User.create({
      email,
      password,
      apiKey,
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionExpirationDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Same day next month
      requestsRemaining: FREE_TRIAL_REQUESTS,
    });

    // Generate JWT token
    const token = signToken(newUser.id, newUser.email);

    // Remove password from output
    newUser.password = undefined as any;

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: newUser
      }
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error registering user'
    });
  }
};

// Login existing user
export const login = async (req: any, res: any): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
      return;
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
      return;
    }

    // Generate token
    const token = signToken(user.id, user.email);

    // Remove password from output
    user.password = undefined as any;

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error logging in'
    });
  }
};

// Handle login with Google
export const googleAuthCallback = (req: any, res: any): void => {
  try {
    if (!req.user) {
      res.redirect(process.env.AUTH_FAILURE_REDIRECT || '/login');
      return;
    }

    // Generate token
    const token = signToken(req.user.id, req.user.email);
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || '/'}?token=${token}`);
  } catch (error) {
    console.error('Error in Google authentication callback:', error);
    res.redirect(process.env.AUTH_FAILURE_REDIRECT || '/login');
  }
};

// Get current user
export const getMe = async (req: any, res: any): Promise<void> => {
  try {
    const user = req.user;
    const { email, apiKey, subscriptionTier, requestsRemaining } = user;
    res.status(200).json({
      status: 'success',
      data: {
        email,
        apiKey,
        subscriptionTier,
        requestsRemaining
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving user information'
    });
  }
};

// Refresh API key
export const refreshApiKey = async (req: any, res: any): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
      return;
    }

    // Generate new API key
    const newApiKey = uuidv4();
    
    // Update user with new API key
    user.apiKey = newApiKey;
    await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        apiKey: newApiKey
      }
    });
  } catch (error) {
    console.error('Error refreshing API key:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error refreshing API key'
    });
  }
}; 