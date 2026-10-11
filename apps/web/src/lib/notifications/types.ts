/**
 * Notifications (bell): one row per recipient about one object. Rows come from
 * the notification RPCs of migration 20261011054231_notifications.sql; the
 * sentence shown is composed in the app from `type`, `data` and the actor.
 */

export type NotificationType =
  | "ticket.new"
  | "ticket.assigned"
  | "ticket.status"
  | "comment"
  | "mention"
  | "task.assigned"
  | "task.status";

export type NotificationTargetType = "helpdesk.ticket" | "planning.task" | "workshop.repair_order";

export type NotificationFilter = "all" | "unread" | "assigned";

export interface NotificationActor {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface AppNotification {
  id: string;
  organization_id: string;
  type: NotificationType | (string & {});
  target_type: NotificationTargetType | (string & {});
  target_id: string;
  /** Number of the object as it was then (HD-000014, PT-000008, ZL number) */
  target_code: string | null;
  /** Title of the object as it was then */
  title: string;
  /** Excerpt of the comment, for comment notifications */
  snippet: string | null;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  actor: NotificationActor | null;
}

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  nextCursor: NotificationCursor | null;
}

export const NOTIFICATIONS_PAGE_SIZE = 30;
/** The unread count is capped by the database */
export const NOTIFICATIONS_UNREAD_CAP = 100;

/** Path of the object a notification is about, or null for unknown targets */
export function notificationHref(
  notification: Pick<AppNotification, "target_type" | "target_id">
): string | null {
  switch (notification.target_type) {
    case "helpdesk.ticket":
      return `/dashboard/help-desk/tickets/${notification.target_id}`;
    case "planning.task":
      return `/dashboard/planning/tasks/${notification.target_id}`;
    case "workshop.repair_order":
      return `/dashboard/workshop/${notification.target_id}`;
    default:
      return null;
  }
}
