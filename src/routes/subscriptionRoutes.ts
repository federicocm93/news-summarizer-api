import express from 'express';
import { createCheckoutSession, handleWebhook, getSubscription } from '../controllers/subscriptionController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Webhook route (no authentication)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/status', protect, getSubscription);

export default router; 