import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { SubscriptionTier } from '../models/User';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Get environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30d';
const FREE_TRIAL_REQUESTS = parseInt(process.env.FREE_TRIAL_REQUESTS || '50', 10);

// Generate JWT token
const signToken = (id: string, email: string): string => {
  return jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN});
};

// Register a new user
export const register = async (req: Request, res: Response): Promise<void> => {
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
export const login = async (req: Request, res: Response): Promise<void> => {
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

// Get current user
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    res.status(200).json({
      status: 'success',
      data: {
        user
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
export const refreshApiKey = async (req: Request, res: Response): Promise<void> => {
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