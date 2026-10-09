/**
 * Compact chat times: "10:24" today, "pt." within the week, "03.10" earlier,
 * "03.10.2025" in another year.
 */
export function formatChatListTime(iso: string, locale: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) {
    return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  const sixDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  if (date.getTime() >= sixDaysAgo) {
    return date.toLocaleDateString(locale, { weekday: "short" });
  }
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function formatChatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/** Day key for separators ("2026-10-09" in local time) */
export function chatDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** "today" / "yesterday" / a date, for day separators */
export function chatDayLabel(
  iso: string,
  locale: string,
  labels: { today: string; yesterday: string },
  now: Date = new Date()
): string {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (date.getTime() >= startOfToday) return labels.today;
  if (date.getTime() >= startOfToday - dayMs) return labels.yesterday;
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Messages of one author within this many ms are grouped (one name / time line) */
export const CHAT_GROUP_WINDOW_MS = 5 * 60 * 1000;
