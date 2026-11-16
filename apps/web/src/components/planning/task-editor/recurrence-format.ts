import type { KanbanRecurrence, KanbanRecurrenceFreq } from "@/lib/types/kanban";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** ISO weekdays in the order a week is shown: Monday first. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * A rule as people say it: "Every 2 weeks on Mon, Wed", "Every month on the
 * 15th, until 31.12.2026". `t` is scoped to boardExtras.recurrence and
 * `weekday` names an ISO day briefly.
 */
export function describeRecurrence(
  t: Translate,
  rule: KanbanRecurrence,
  weekday: (isoDay: number) => string,
  formatDay: (ymd: string) => string
): string {
  const interval = rule.interval ?? 1;
  let text = t(`every.${rule.freq}`, { count: interval });
  if (rule.freq === "weekly" && rule.weekdays?.length) {
    const days = [...new Set(rule.weekdays)].sort((a, b) => a - b).map(weekday);
    text += ` ${t("onDays", { days: days.join(", ") })}`;
  }
  if (rule.freq === "monthly" && rule.monthday) {
    text += ` ${t("onMonthday", { day: rule.monthday })}`;
  }
  if (rule.until) text += `, ${t("untilDay", { day: formatDay(rule.until) })}`;
  return text;
}

/**
 * A rule from what the form holds, without the parts that do not apply (a
 * weekly rule's days, a monthly rule's day). An interval of 1 is left out.
 */
export function buildRecurrence(input: {
  freq: KanbanRecurrenceFreq;
  interval: number;
  weekdays: number[];
  monthday: number | null;
  until: string | null;
}): KanbanRecurrence {
  const interval = Math.min(365, Math.max(1, Math.round(input.interval) || 1));
  const rule: KanbanRecurrence = { freq: input.freq };
  if (interval > 1) rule.interval = interval;
  if (input.freq === "weekly" && input.weekdays.length) {
    rule.weekdays = [...new Set(input.weekdays)]
      .filter((d) => d >= 1 && d <= 7)
      .sort((a, b) => a - b);
  }
  if (input.freq === "monthly" && input.monthday) {
    rule.monthday = Math.min(31, Math.max(1, input.monthday));
  }
  if (input.until) rule.until = input.until;
  return rule;
}

/** ISO day (1 = Monday) of a YYYY-MM-DD day. */
export function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}
