import express from 'express';
import { protectWebhook, logApiRequest } from '../middleware/auth';
import { handleWebhook } from '../controllers/webhookController';

const router = express.Router();

// Protected routes
router.post('/notify', protectWebhook, logApiRequest, handleWebhook);

export default router; 