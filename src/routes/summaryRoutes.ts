import express from 'express';
import { getUsageStats, handleOpenAIRequest, getAllowedNewsDomains } from '../controllers/summaryController';
import { protect, checkRequestLimit, logApiRequest } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/domains', getAllowedNewsDomains);

// Protected routes
router.post('/generate', protect, logApiRequest, checkRequestLimit, handleOpenAIRequest);
router.get('/usage', protect, getUsageStats);

export default router; 