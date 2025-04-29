import jwt from 'jsonwebtoken';
import User from '../models/User';
import ApiRequest from '../models/ApiRequest';
import { EventName, Paddle } from '@paddle/paddle-node-sdk';
// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Initialize Paddle client
const paddle = new Paddle(process.env.PADDLE_API_KEY || '');

// Middleware to protect routes that require authentication
export const protect = async (req: any, res: any, next: any): Promise<void> => {
  try {
    // 1) Get the token from the headers
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-api-key']) {
      // Alternative: use API key for authentication
      const user = await User.findOne({ apiKey: req.headers['x-api-key'] });
      
      if (!user) {
        res.status(401).json({
          status: 'fail',
          message: 'Invalid API key'
        });
        return;
      }
      
      req.user = user;
      return next();
    }

    if (!token) {
      res.status(401).json({
        status: 'fail',
        message: 'You are not logged in. Please log in to get access.'
      });
      return;
    }

    // 2) Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
      return;
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid token or authorization error'
    });
  }
};

export const protectWebhook = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const signature = (req.headers['paddle-signature'] as string) || '';
    // req.body should be of type `buffer`, convert to string before passing it to `unmarshal`. 
    // If express returned a JSON, remove any other middleware that might have processed raw request to object
    const rawRequestBody = req.body.toString();
    // Replace `WEBHOOK_SECRET_KEY` with the secret key in notifications from vendor dashboard
    const secretKey = process.env['PADDLE_WEBHOOK_SECRET'] || '';

    if (signature && rawRequestBody) {
      // The `unmarshal` function will validate the integrity of the webhook and return an entity
      const eventData = await paddle.webhooks.unmarshal(rawRequestBody, secretKey, signature);
      req.body = eventData.data;
    } else {
      console.log('Signature missing in header');
    }
    next();
  } catch (error: any) {
    console.error('Error processing webhook protection:', error.message);
    res.status(401).json({
      status: 'fail',
      message: 'Invalid token or authorization error'
    });
  }
};

// Middleware to check if the user has remaining API requests
export const checkRequestLimit = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
      return;
    }

    // Check if the user has remaining requests
    if (!user.hasRemainingRequests()) {
      res.status(403).json({
        status: 'fail',
        message: 'You have reached your request limit. Please upgrade your subscription.',
        code: 'REQUEST_LIMIT_EXCEEDED'
      });
      return;
    }

    // Check if the user's subscription has expired
    if (!user.isSubscriptionActive()) {
      res.status(403).json({
        status: 'fail',
        message: 'Your subscription has expired. Please upgrade your subscription.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
      return;
    }

    // Track request count after the response is sent
    res.on('finish', async () => {
      // Only decrement if the request was successful (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Get the latest user data to ensure we have the most recent requestsRemaining value
        const updatedUser = await User.findById(user._id);
        if (updatedUser) {
          updatedUser.requestsRemaining -= 1;
          await updatedUser.save().catch((err: Error) => console.error('Error updating request count:', err));
        }
      }
    });

    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error checking request limit'
    });
  }
};

// Middleware to log API requests
export const logApiRequest = async (req: any, res: any, next: any): Promise<void> => {  
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Log the API request asynchronously
    if (req.user) {
      const apiRequest = new ApiRequest({
        userId: req.user._id,
        endpoint: req.originalUrl,
        status: res.statusCode,
        responseTime,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'Unknown'
      });
      
      apiRequest.save().catch((err: Error) => console.error('Error logging API request:', err));
    }
    
    return res;
  });
  
  next();
}; 