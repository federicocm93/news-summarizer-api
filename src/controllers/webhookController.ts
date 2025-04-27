import User, { SubscriptionTier } from "../models/User";
import { SubscriptionCreatedNotification } from '@paddle/paddle-node-sdk';
import { triggerNewSubscriptionPushEvent } from "../services/pusher";
export const handleWebhook = async (req: any, res: any): Promise<void> => {
  try {
    const eventData = req.body;
    console.log('Webhook received:', eventData);
    
    // Get the event type from the constructor name
    const eventType = eventData.constructor.name.toLowerCase();
    console.log('Event type:', eventType);

    if (eventType === 'subscriptioncreatednotification') {
      const user = await User.findOne({ externalId: eventData.customerId });
      if (!user) { 
        throw new Error('User not found');
      }
      const subscriptionTier = eventData.items[0].price.customData.tier as SubscriptionTier;
      const subscriptionFrequency = eventData.items[0].price.customData.type;

      if (subscriptionTier === SubscriptionTier.PREMIUM) {
        if (subscriptionFrequency === 'monthly') {
          user.generatePremiumMonthlySubscription();
        } else if (subscriptionFrequency === 'yearly') {
          user.generatePremiumYearlySubscription();
        }
      } else if (subscriptionTier === SubscriptionTier.PRO) {
        if (subscriptionFrequency === 'monthly') {
          user.generateProMonthlySubscription();
        } else if (subscriptionFrequency === 'yearly') {
          user.generateProYearlySubscription();
        }
      }
      await user.save();
      await triggerNewSubscriptionPushEvent(user._id);
      console.log('Subscription created for user', user.email);
    } else if (eventType === 'customernotification') {
      const user = await User.findOne({ email: eventData.email });
      if (!user) { 
        throw new Error('User not found');
      }
      user.externalId = eventData.id;
      await user.save();
      console.log('External ID set for user', user.email);
    } else if (eventType === 'subscriptionupdatednotification') {
      console.log('Subscription updated');
    } else if (eventType === 'subscriptioncancellednotification') {
      console.log('Subscription cancelled');
    }
    return res.status(200).json({
      status: 'success',
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error handling webhook'
    });
  }
};