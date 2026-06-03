"use client";

import { formatDistanceToNow } from "date-fns";
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

export function PlanningTaskActivityList({ activity }: PlanningTaskActivityListProps) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Activity className="text-muted-foreground h-5 w-5" />
        <p className="text-muted-foreground text-xs">No activity yet</p>
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
            <p className="text-sm">{item.message ?? item.activity_type}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.actor_name ?? "System"} ·{" "}
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
