/** What the service worker (public/sw.js) receives in a push message */
export interface PushPayload {
  kind: "notification" | "chat";
  title: string;
  body: string;
  /** Path to open on click, in the recipient's language */
  url: string;
  /** Same tag = the newer notification replaces the older one */
  tag: string;
  /** Number on the app icon: unread notifications + unread conversations */
  badge: number;
  organizationId: string;
  /** What "Mark as read" marks */
  ref: { notificationId?: string; conversationId?: string; until?: string };
  actions: { open: string; markRead: string };
}

/** A device of the signed-in user (push_subscriptions_mine) */
export interface PushDevice {
  id: string;
  endpoint: string;
  user_agent: string | null;
  standalone: boolean;
  created_at: string;
  last_seen_at: string;
  last_success_at: string | null;
}
