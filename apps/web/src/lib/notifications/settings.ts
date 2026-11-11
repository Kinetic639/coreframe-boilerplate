import type { NotificationSettings } from "@/lib/types/user-preferences";
import type { NotificationType } from "./types";

/**
 * Notification settings per event and channel, stored in
 * `user_preferences.notification_settings`:
 *   inApp.disabledTypes — types switched off in the bell (read by `_notify()` in the database)
 *   email.types         — types sent by e-mail; absent = the defaults below
 * The channel switches (`inApp.enabled`, `email.enabled`) stay above the matrix.
 */

export type NotificationChannel = "inApp" | "email";

export interface NotificationEventDefinition {
  /** A bell notification type, or "chat.message" (unread chat messages: e-mail only) */
  type: NotificationType | "chat.message";
  /** Channels the event exists on; both when omitted */
  channels?: NotificationChannel[];
  group: "helpdesk" | "planning" | "conversations";
  /** Sent by e-mail unless the user changes it */
  emailByDefault: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  { type: "ticket.new", group: "helpdesk", emailByDefault: true },
  { type: "ticket.assigned", group: "helpdesk", emailByDefault: true },
  { type: "ticket.status", group: "helpdesk", emailByDefault: false },
  { type: "task.assigned", group: "planning", emailByDefault: true },
  { type: "task.status", group: "planning", emailByDefault: false },
  { type: "task.due", group: "planning", emailByDefault: false },
  { type: "comment", group: "conversations", emailByDefault: false },
  { type: "mention", group: "conversations", emailByDefault: true },
  // Chat messages never go to the bell; an unread one can be e-mailed
  { type: "chat.message", group: "conversations", emailByDefault: true, channels: ["email"] },
];

export const DEFAULT_EMAIL_TYPES: string[] = NOTIFICATION_EVENTS.filter(
  (event) => event.emailByDefault
).map((event) => event.type);

function strings(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}

export function inAppDisabledTypes(settings: NotificationSettings | null | undefined): string[] {
  return strings(settings?.inApp?.disabledTypes) ?? [];
}

export function emailTypes(settings: NotificationSettings | null | undefined): string[] {
  return strings(settings?.email?.types) ?? DEFAULT_EMAIL_TYPES;
}

export function isEventOn(
  settings: NotificationSettings | null | undefined,
  channel: NotificationChannel,
  type: string
): boolean {
  return channel === "inApp"
    ? !inAppDisabledTypes(settings).includes(type)
    : emailTypes(settings).includes(type);
}

/**
 * The settings patch for switching one event on one channel. It carries the
 * whole channel object: the server merges settings one level deep.
 */
export function toggleEvent(
  settings: NotificationSettings | null | undefined,
  channel: NotificationChannel,
  type: string,
  on: boolean
): Partial<NotificationSettings> {
  if (channel === "inApp") {
    const rest = inAppDisabledTypes(settings).filter((item) => item !== type);
    return {
      inApp: {
        ...settings?.inApp,
        enabled: settings?.inApp?.enabled ?? true,
        disabledTypes: on ? rest : [...rest, type],
      },
    };
  }
  const rest = emailTypes(settings).filter((item) => item !== type);
  return {
    email: {
      ...settings?.email,
      enabled: settings?.email?.enabled ?? true,
      types: on ? [...rest, type] : rest,
    },
  };
}
