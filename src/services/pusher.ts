import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "",
  key: process.env.PUSHER_APP_KEY || "",
  secret: process.env.PUSHER_APP_SECRET || "",
  cluster: "us2",
  useTLS: true
});


export const triggerNewSubscriptionPushEvent = async (userId: string) => {
  if (!userId) {
    console.warn("Cannot trigger new subscription push event: No user ID provided");
    return;
  }
  try {
    pusher.trigger("user-subscription-channel", "new-subscription", {
      userId
    });
  } catch (error: any) {
    console.error("Error triggering new subscription push event:", error.message ?? error);
  }
};