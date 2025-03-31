import Stripe from 'stripe';
import User, { SubscriptionTier } from '../models/User';
import Subscription from '../models/Subscription';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16'
});

// Get environment variables for request limits
const PREMIUM_TIER_REQUESTS = parseInt(process.env.PREMIUM_TIER_REQUESTS || '500', 10);
const PRO_TIER_REQUESTS = parseInt(process.env.PRO_TIER_REQUESTS || '5000', 10);

// Create a Stripe checkout session for subscription
export const createCheckoutSession = async (req: any, res: any): Promise<void> => {
  try {
    const { tier, successUrl, cancelUrl } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
      return;
    }

    // Validate tier
    if (![SubscriptionTier.PREMIUM, SubscriptionTier.PRO].includes(tier)) {
      res.status(400).json({
        status: 'fail',
        message: 'Invalid subscription tier'
      });
      return;
    }

    // Set price ID based on tier (these would be your actual Stripe price IDs)
    const priceId = tier === SubscriptionTier.PREMIUM
      ? process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium'
      : process.env.STRIPE_PRO_PRICE_ID || 'price_pro';

    // Create or retrieve Stripe customer
    let stripeCustomerId = '';
    const existingSubscription = await Subscription.findOne({ userId: user.id });
    
    if (existingSubscription) {
      stripeCustomerId = existingSubscription.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl || process.env.STRIPE_SUCCESS_URL || 'https://your-domain.com/success',
      cancel_url: cancelUrl || process.env.STRIPE_CANCEL_URL || 'https://your-domain.com/cancel',
      metadata: {
        userId: user.id,
        tier
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating checkout session'
    });
  }
};

// Handle Stripe webhook events
export const handleWebhook = async (req: any, res: any): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    
    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error handling webhook'
    });
  }
};

// Handle successful checkout session
const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  try {
    if (!session.metadata || !session.metadata.userId || !session.metadata.tier) {
      console.error('Missing metadata in checkout session');
      return;
    }

    const userId = session.metadata.userId;
    const tier = session.metadata.tier as SubscriptionTier;
    const stripeSubscriptionId = session.subscription as string;
    
    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    // Create or update subscription record
    const subscriptionData = {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId,
      subscriptionTier: tier,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      status: stripeSubscription.status
    };
    
    await Subscription.findOneAndUpdate(
      { userId },
      subscriptionData,
      { upsert: true, new: true }
    );
    
    // Update user's subscription tier and request quota
    const requestAllowance = tier === SubscriptionTier.PREMIUM ? PREMIUM_TIER_REQUESTS : PRO_TIER_REQUESTS;
    
    await User.findByIdAndUpdate(userId, {
      subscriptionTier: tier,
      requestsRemaining: requestAllowance
    });
  } catch (error) {
    console.error('Error processing checkout completion:', error);
  }
};

// Handle subscription updates
const handleSubscriptionUpdated = async (subscription: Stripe.Subscription): Promise<void> => {
  try {
    // Find the subscription in our database
    const dbSubscription = await Subscription.findOne({
      stripeSubscriptionId: subscription.id
    });
    
    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`);
      return;
    }
    
    // Update subscription record
    dbSubscription.status = subscription.status;
    dbSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
    dbSubscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    dbSubscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await dbSubscription.save();
    
    // If a new billing period has started, reset the request quota
    const user = await User.findById(dbSubscription.userId);
    if (user && subscription.status === 'active') {
      const requestAllowance = user.subscriptionTier === SubscriptionTier.PREMIUM 
        ? PREMIUM_TIER_REQUESTS 
        : PRO_TIER_REQUESTS;
      
      user.requestsRemaining = requestAllowance;
      await user.save();
    }
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
};

// Handle subscription cancellations
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  try {
    // Find the subscription in our database
    const dbSubscription = await Subscription.findOne({
      stripeSubscriptionId: subscription.id
    });
    
    if (!dbSubscription) {
      console.error(`Subscription not found for deletion: ${subscription.id}`);
      return;
    }
    
    // Update subscription status
    dbSubscription.status = 'canceled';
    await dbSubscription.save();
    
    // Update user tier to FREE
    const user = await User.findById(dbSubscription.userId);
    if (user) {
      user.subscriptionTier = SubscriptionTier.FREE;
      user.requestsRemaining = 0; // No more requests until they subscribe again
      await user.save();
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
};

// Get user's subscription information
export const getSubscription = async (req: any, res: any): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required'
      });
      return;
    }
    
    // Get subscription details
    const subscription = await Subscription.findOne({ userId: user.id });
    
    res.status(200).json({
      status: 'success',
      data: {
        subscription: subscription || null,
        tier: user.subscriptionTier,
        requestsRemaining: user.requestsRemaining
      }
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving subscription information'
    });
  }
}; 