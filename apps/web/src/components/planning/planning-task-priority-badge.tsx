"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskPriority } from "@/lib/validations/planning";

const PRIORITY_DEFAULTS: Record<TaskPriority, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  normal: {
    label: "Normal",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface PlanningTaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function PlanningTaskPriorityBadge({ priority, className }: PlanningTaskPriorityBadgeProps) {
  const defaults = PRIORITY_DEFAULTS[priority] ?? {
    label: priority,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-xs font-medium", defaults.className, className)}
    >
      {defaults.label}
    </Badge>
  );
}
