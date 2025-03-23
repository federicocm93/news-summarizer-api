import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_USER = process.env.MONGODB_USER || '';
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || '';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(`mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@cluster0.m90ux.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error('MongoDB Connection Error Details:');
    console.error(`Error Type: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    if (error.stack) {
      console.error(`Stack Trace: ${error.stack}`);
    }
    const maskedUri = `mongodb+srv://${MONGODB_USER}:****@cluster0.m90ux.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    console.error(`Attempted connection with URI: ${maskedUri}`);
    process.exit(1);
  }
};

// Set up mongoose event listeners
mongoose.connection.on('error', (err: Error) => {
  console.error('MongoDB connection error details:');
  console.error(`Error Type: ${err.name}`);
  console.error(`Error Message: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Handle app termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

export default { connectDB }; 