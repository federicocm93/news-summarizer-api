import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User, { SubscriptionTier } from '../models/User';
import { Paddle } from '@paddle/paddle-node-sdk';
import fetch from 'node-fetch';
import { resetFreeUserRequests } from '../services/cronService';

// Get environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '30d';
const FREE_TRIAL_REQUESTS = parseInt(process.env.FREE_TRIAL_REQUESTS || '30', 10);

const paddle = new Paddle(process.env.PADDLE_API_KEY || '');

// Generate JWT token
const signToken = (id: string, email: string): string => {
  return jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN});
};

// Register a new user
export const register = async (req: any, res: any): Promise<void> => {
  try {
    const { email, password, extensionId } = req.body;
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

    // Handle extension user upgrade
    if (extensionId) {
      // Find the existing extension user
      const extensionUser = await User.findOne({ 
        apiKey: extensionId, 
        isExtensionUser: true 
      });

      if (!extensionUser) {
        res.status(400).json({
          status: 'fail',
          message: 'Invalid extension ID or extension user not found'
        });
        return;
      }

      // Check if email is already taken by another user
      const existingEmailUser = await User.findOne({ 
        email,
        _id: { $ne: extensionUser._id } // Exclude the current extension user
      });
      
      if (existingEmailUser) {
        res.status(400).json({
          status: 'fail',
          message: 'User already exists with this email'
        });
        return;
      }

      // Upgrade the extension user to a full account
      extensionUser.email = email;
      extensionUser.password = password; // Will be hashed by pre-save hook
      extensionUser.isExtensionUser = false;
      await extensionUser.save();

      // Generate JWT token
      const token = signToken(extensionUser.id, extensionUser.email);

      // Remove password from output
      extensionUser.password = undefined as any;

      res.status(200).json({
        status: 'success',
        token,
        data: {
          user: extensionUser
        },
        message: 'Account upgraded successfully. Your existing usage has been preserved.'
      });
      return;
    }

    // Regular user registration (non-extension)
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
      lastRequestReset: new Date(),
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
    const { email, apiKey, subscriptionTier, requestsRemaining, subscriptionExternalId } = user;
    res.status(200).json({
      status: 'success',
      data: {
        id: user._id,
        email,
        apiKey,
        subscriptionTier,
        requestsRemaining,
        subscriptionExternalId
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

// Create extension user with UUID-based API key
export const createExtensionUser = async (req: any, res: any): Promise<void> => {
  try {
    const { extensionId } = req.body;
    
    if (!extensionId) {
      res.status(400).json({
        status: 'fail',
        message: 'Extension ID is required'
      });
      return;
    }

    // Check if user already exists with this extension ID as API key
    const existingUser = await User.findOne({ apiKey: extensionId });
    if (existingUser) {
      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: existingUser._id,
            apiKey: existingUser.apiKey,
            subscriptionTier: existingUser.subscriptionTier,
            requestsRemaining: existingUser.requestsRemaining,
            isExtensionUser: true
          }
        }
      });
      return;
    }

    // Create new extension user with UUID as both API key and identifier
    const newUser = await User.create({
      email: `extension-${extensionId}@tldr-news.local`, // Temporary email format
      password: uuidv4(), // Random password, not used for login
      apiKey: extensionId, // Use the extension-generated UUID as API key
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionExpirationDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      requestsRemaining: FREE_TRIAL_REQUESTS,
      lastRequestReset: new Date(),
      isExtensionUser: true // Flag to identify extension users
    });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: newUser._id,
          apiKey: newUser.apiKey,
          subscriptionTier: newUser.subscriptionTier,
          requestsRemaining: newUser.requestsRemaining,
          isExtensionUser: true
        }
      }
    });
  } catch (error) {
    console.error('Error creating extension user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating extension user'
    });
  }
};

// Create Paddle Customer Portal Link
export const getPaddleCustomerPortalLink = async (req: any, res: any): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.externalId) {
      res.status(400).json({ status: 'fail', message: 'User externalId not found' });
      return;
    }
    const apiKey = process.env.PADDLE_API_KEY;
    const customerId = user.externalId;
    const subscriptionId = user.subscriptionExternalId;
    const response = await fetch(`https://api.paddle.com/customers/${customerId}/portal-sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription_ids: [subscriptionId] })
    });
    const data = await response.json();
    if (data && data.data && data.data.urls && data.data.urls.general && data.data.urls.general.overview) {
      res.status(200).json({ status: 'success', url: data.data.urls.general.overview });
    } else {
      res.status(500).json({ status: 'error', message: 'Failed to get portal link', details: data });
    }
  } catch (error: any) {
    console.error('Error creating Paddle portal link:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error creating portal link' });
  }
};

// Manual trigger for free user request reset (for testing purposes)
export const triggerFreeUserReset = async (req: any, res: any): Promise<void> => {
  try {
    // Only allow this in development environment for security
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        status: 'fail',
        message: 'This endpoint is not available in production'
      });
      return;
    }

    await resetFreeUserRequests();
    
    res.status(200).json({
      status: 'success',
      message: 'Free user request reset triggered manually'
    });
  } catch (error) {
    console.error('Error in manual free user reset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error triggering free user reset'
    });
  }
}; 