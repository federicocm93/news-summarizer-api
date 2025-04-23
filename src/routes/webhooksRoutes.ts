import express from 'express';
import { protectWebhook, checkRequestLimit, logApiRequest } from '../middleware/auth';
import { handleWebhook } from '../controllers/webhookController';

const router = express.Router();

// Protected routes
router.post('/notify', protectWebhook, logApiRequest, checkRequestLimit, handleWebhook);

export default router; 