import User, { SubscriptionTier } from "../models/User";

export const handleWebhook = async (req: any, res: any): Promise<void> => {
  try {
    console.log('Webhook received');
    const eventData = req.body;
    console.log('eventData', eventData);
    if (eventData.eventType === 'subscription_created') {
      const user = await User.findOne({ externalId: eventData.customer_id });
      if (!user) { 
        throw new Error('User not found');
      }
      const subscriptionTier = eventData.items[0].price.custom_data.tier as SubscriptionTier;
      const subscriptionFrequency = eventData.items[0].price.custom_data.type;

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
      console.log('Subscription created');
    } else if (eventData.eventType === 'subscription_updated') {
      console.log('Subscription updated');
    } else if (eventData.eventType === 'subscription_cancelled') {
      console.log('Subscription cancelled');
    } else if (eventData.eventType === 'customer_created') {
      const user = await User.findOne({ email: eventData.email });
      if (!user) { 
        throw new Error('User not found');
      }
      user.externalId = eventData.id;
      await user.save();
      return res.status(200).json({
        status: 'success',
        message: 'Webhook received'
      });
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