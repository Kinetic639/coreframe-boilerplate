"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskStatus } from "@/lib/validations/planning";

const STATUS_DEFAULTS: Record<TaskStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

interface PlanningTaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function PlanningTaskStatusBadge({ status, className }: PlanningTaskStatusBadgeProps) {
  const defaults = STATUS_DEFAULTS[status] ?? {
    label: status,
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
