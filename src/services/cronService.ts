import cron from 'node-cron';
import User from '../models/User';
import { SubscriptionTier } from '../enums/SubscriptionTier';

// Get environment variables
const FREE_TRIAL_REQUESTS = parseInt(process.env.FREE_TRIAL_REQUESTS || '30', 10);

// Function to reset requests for free tier users
const resetFreeUserRequests = async (): Promise<void> => {
  try {
    console.log('Starting monthly free tier request reset...');
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Find free tier users whose requests were last reset more than 30 days ago
    const freeUsersToReset = await User.find({
      subscriptionTier: SubscriptionTier.FREE,
      lastRequestReset: { $lte: thirtyDaysAgo }
    });
    
    console.log(`Found ${freeUsersToReset.length} free tier users eligible for request reset`);
    
    // Reset requests for each eligible user
    for (const user of freeUsersToReset) {
      user.requestsRemaining = FREE_TRIAL_REQUESTS;
      user.lastRequestReset = new Date();
      await user.save();
      
      console.log(`Reset requests for user ${user.email} - ${FREE_TRIAL_REQUESTS} requests restored`);
    }
    
    console.log('Monthly free tier request reset completed successfully');
  } catch (error) {
    console.error('Error during monthly free tier request reset:', error);
  }
};

// Initialize cron job
export const initializeCronJobs = (): void => {
  console.log('Initializing cron jobs...');
  
  // Run every day at 2 AM to check for users eligible for reset
  // Format: '0 2 * * *' = At 02:00 every day
  cron.schedule('0 2 * * *', resetFreeUserRequests, {
    timezone: 'UTC'
  });
  
  console.log('Cron job scheduled: Daily check for free tier request reset at 2 AM UTC');
};

// Export the reset function for manual testing/execution
export { resetFreeUserRequests }; 