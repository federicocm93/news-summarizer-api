import express from 'express';
import { getUsageStats, handleOpenAIRequest } from '../controllers/summaryController';
import { protect, checkRequestLimit, logApiRequest } from '../middleware/auth';

const router = express.Router();

// Protected routes
router.post('/generate', protect, logApiRequest, checkRequestLimit, handleOpenAIRequest);
router.get('/usage', protect, getUsageStats);

export default router; 