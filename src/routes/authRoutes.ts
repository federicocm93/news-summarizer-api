import express from 'express';
import { register, login, getMe, refreshApiKey, googleAuthCallback, getPaddleCustomerPortalLink, triggerFreeUserReset } from '../controllers/authController';
import { protect } from '../middleware/auth';
import passport from '../config/passport';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: process.env.AUTH_FAILURE_REDIRECT || '/login' 
  }),
  googleAuthCallback
);

// Protected routes
router.get('/me', protect, getMe);
router.post('/refresh-api-key', protect, refreshApiKey);
router.post('/customer-portal-link', protect, getPaddleCustomerPortalLink);

// Development/testing routes
router.post('/trigger-free-reset', triggerFreeUserReset);

export default router; 