import "server-only";

import webpush from "web-push";
import type { PushSender } from "./push";

/** Sends with the `web-push` library; 404/410 mean the device unsubscribed */
export function webPushSender(vapid: {
  publicKey: string;
  privateKey: string;
  subject: string;
}): PushSender {
  return async (subscription, payload) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          vapidDetails: vapid,
          // Not worth delivering a day late
          TTL: 60 * 60 * 12,
          urgency: "high",
        }
      );
      return "ok";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      console.error("[push] send failed", status ?? error);
      return "failed";
    }
  };
}
