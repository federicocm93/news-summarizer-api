import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { connectDB } from './config/database';
import passport from './config/passport';
import authRoutes from './routes/authRoutes';
import summaryRoutes from './routes/summaryRoutes';
import webhookRoutes from './routes/webhooksRoutes';
import MongoStore from 'connect-mongo';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Body parser middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies for all routes except the Stripe webhook
app.use((req: any, res: any, next: any) => {
  if (req.originalUrl === '/api/webhooks/notify') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// Session middleware for Passport
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'your-mongodb-uri',
    ttl: 14 * 24 * 60 * 60 // = 14 days
  })
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Proxy
app.set('trust proxy', true);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/health', (req: any, res: any) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err: Error, req: any, res: any, next: any) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404 errors
app.use((req: any, res: any) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 