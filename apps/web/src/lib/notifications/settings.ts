import type { NotificationSettings } from "@/lib/types/user-preferences";
import type { NotificationType } from "./types";

/**
 * Notification settings per event and channel, stored in
 * `user_preferences.notification_settings`:
 *   inApp.disabledTypes — types switched off in the bell (read by `_notify()` in the database)
 *   email.types         — types sent by e-mail; absent = the defaults below
 *   push.types          — types pushed to the user's devices; absent = the defaults below
 *                         (read by `push_claim()` in the database)
 * The channel switches (`inApp.enabled`, `push.enabled`, `email.enabled`) stay above the matrix.
 */

export type NotificationChannel = "inApp" | "push" | "email";

/** Channels that keep a list of switched-on types (in-app keeps the switched-off ones) */
type ListedChannel = Exclude<NotificationChannel, "inApp">;

export interface NotificationEventDefinition {
  /**
   * A bell notification type, "chat.new" (a new chat message: push only) or
   * "chat.message" (chat messages still unread after 15 minutes: e-mail only)
   */
  type: NotificationType | "chat.new" | "chat.message";
  /** Channels the event exists on; all when omitted */
  channels?: NotificationChannel[];
  group: "helpdesk" | "planning" | "conversations";
  /** Sent by e-mail unless the user changes it */
  emailByDefault: boolean;
  /** Pushed to the user's devices unless the user changes it */
  pushByDefault: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  { type: "ticket.new", group: "helpdesk", emailByDefault: true, pushByDefault: true },
  { type: "ticket.assigned", group: "helpdesk", emailByDefault: true, pushByDefault: true },
  { type: "ticket.status", group: "helpdesk", emailByDefault: false, pushByDefault: false },
  { type: "task.assigned", group: "planning", emailByDefault: true, pushByDefault: true },
  { type: "task.status", group: "planning", emailByDefault: false, pushByDefault: false },
  { type: "task.due", group: "planning", emailByDefault: false, pushByDefault: true },
  { type: "comment", group: "conversations", emailByDefault: false, pushByDefault: true },
  { type: "mention", group: "conversations", emailByDefault: true, pushByDefault: true },
  // Chat messages never go to the bell: a new one is pushed at once (when
  // Ambra is not open), one still unread after 15 minutes can be e-mailed
  {
    type: "chat.new",
    group: "conversations",
    emailByDefault: false,
    pushByDefault: true,
    channels: ["push"],
  },
  {
    type: "chat.message",
    group: "conversations",
    emailByDefault: true,
    pushByDefault: false,
    channels: ["email"],
  },
];

export const DEFAULT_EMAIL_TYPES: string[] = NOTIFICATION_EVENTS.filter(
  (event) => event.emailByDefault
).map((event) => event.type);

/** Must match `_push_default_types()` in the database */
export const DEFAULT_PUSH_TYPES: string[] = NOTIFICATION_EVENTS.filter(
  (event) => event.pushByDefault
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

export function pushTypes(settings: NotificationSettings | null | undefined): string[] {
  return strings(settings?.push?.types) ?? DEFAULT_PUSH_TYPES;
}

function listedTypes(
  settings: NotificationSettings | null | undefined,
  channel: ListedChannel
): string[] {
  return channel === "push" ? pushTypes(settings) : emailTypes(settings);
}

export function isEventOn(
  settings: NotificationSettings | null | undefined,
  channel: NotificationChannel,
  type: string
): boolean {
  return channel === "inApp"
    ? !inAppDisabledTypes(settings).includes(type)
    : listedTypes(settings, channel).includes(type);
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
  const rest = listedTypes(settings, channel).filter((item) => item !== type);
  return {
    [channel]: {
      ...settings?.[channel],
      enabled: settings?.[channel]?.enabled ?? true,
      types: on ? [...rest, type] : rest,
    },
  };
}
