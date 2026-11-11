import type { AppNotification, NotificationsPage } from "./types";

/** Infinite query shape of a notifications list: page 0 is the newest */
export interface NotificationsInfiniteData {
  pages: NotificationsPage[];
  pageParams: unknown[];
}

export function flattenNotifications(
  data: NotificationsInfiniteData | undefined
): AppNotification[] {
  return data ? data.pages.flatMap((page) => page.notifications) : [];
}

/** A new notification goes on top (once) */
export function prependNotification(
  data: NotificationsInfiniteData | undefined,
  notification: AppNotification
): NotificationsInfiniteData | undefined {
  if (!data || data.pages.length === 0) return data;
  if (flattenNotifications(data).some((item) => item.id === notification.id)) return data;
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, notifications: [notification, ...first.notifications] }, ...rest],
  };
}

/**
 * Read state of some (or all, `ids` null) notifications. In an "unread" list
 * (`dropRead`) rows that became read leave the list.
 */
export function setReadInList(
  data: NotificationsInfiniteData | undefined,
  ids: string[] | null,
  read: boolean,
  now: string,
  dropRead = false
): NotificationsInfiniteData | undefined {
  if (!data) return data;
  const hit = (id: string) => ids === null || ids.includes(id);
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      notifications: page.notifications
        .map((item) =>
          hit(item.id) && (item.read_at === null) === read
            ? { ...item, read_at: read ? now : null }
            : item
        )
        .filter((item) => !(dropRead && item.read_at !== null)),
    })),
  };
}

/** "today" | "yesterday" | "earlier" for the drawer's groups */
export function notificationDayGroup(
  iso: string,
  now: Date = new Date()
): "today" | "yesterday" | "earlier" {
  const time = new Date(iso).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time >= startOfToday) return "today";
  if (time >= startOfToday - 24 * 60 * 60 * 1000) return "yesterday";
  return "earlier";
}

/** "12 min temu", "2 godz. temu", "wczoraj, 16:42", "03.10, 08:12" */
export function formatNotificationTime(
  iso: string,
  locale: string,
  now: Date = new Date()
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" });
  if (minutes < 1)
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  if (minutes < 60) return relative.format(-minutes, "minute");
  const group = notificationDayGroup(iso, now);
  const clock = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (group === "today") return relative.format(-Math.round(minutes / 60), "hour");
  if (group === "yesterday") {
    return `${new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day")}, ${clock}`;
  }
  return `${date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })}, ${clock}`;
}
