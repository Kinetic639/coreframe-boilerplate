"use client";

import { useLocale, useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import type { PlanningTaskActivity } from "@/server/services/planning-tasks.service";

interface PlanningTaskActivityListProps {
  activity: PlanningTaskActivity[];
}

const ACTIVITY_ICONS: Record<string, string> = {
  task_created: "✨",
  title_changed: "✏️",
  description_changed: "📝",
  assigned: "👤",
  unassigned: "👤",
  status_changed: "🔄",
  priority_changed: "🚦",
  due_date_changed: "📅",
  completed: "✅",
  reopened: "🔁",
  cancelled: "❌",
  archived: "📦",
  restored: "♻️",
};

const ACTIVITY_MESSAGE_KEYS = {
  task_created: "task_created",
  title_changed: "title_changed",
  description_changed: "description_changed",
  assigned: "assigned",
  unassigned: "unassigned",
  status_changed: "status_changed",
  priority_changed: "priority_changed",
  due_date_changed: "due_date_changed",
  completed: "completed",
  reopened: "reopened",
  cancelled: "cancelled",
  archived: "archived",
  restored: "restored",
  comment_added: "comment_added",
} as const;

function formatRelativeTime(date: Date, locale: string): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ] as const;

  let duration = seconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        Math.round(duration),
        division.unit
      );
    }
    duration /= division.amount;
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(duration),
    "year"
  );
}

export function PlanningTaskActivityList({ activity }: PlanningTaskActivityListProps) {
  const t = useTranslations("modules.planning.tasks");
  const activityT = useTranslations("modules.planning.tasks.activityMessages");
  const locale = useLocale();

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Activity className="text-muted-foreground h-5 w-5" />
        <p className="text-muted-foreground text-xs">{t("noActivity")}</p>
      </div>
    );
  }

  const sorted = [...activity].reverse();

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((item) => (
        <div key={item.id} className="flex gap-2.5">
          <span className="mt-0.5 shrink-0 text-sm">
            {ACTIVITY_ICONS[item.activity_type] ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {ACTIVITY_MESSAGE_KEYS[item.activity_type as keyof typeof ACTIVITY_MESSAGE_KEYS]
                ? activityT(
                    ACTIVITY_MESSAGE_KEYS[item.activity_type as keyof typeof ACTIVITY_MESSAGE_KEYS]
                  )
                : (item.message ?? item.activity_type)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.actor_name ?? t("systemActor")} ·{" "}
              {formatRelativeTime(new Date(item.created_at), locale)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
