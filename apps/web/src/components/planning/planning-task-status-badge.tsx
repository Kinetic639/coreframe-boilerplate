"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskStatus } from "@/lib/validations/planning";

const STATUS_CLASSES: Record<TaskStatus, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface PlanningTaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  config?: PlanningStatusBadgeConfig | null;
}

export interface PlanningStatusBadgeConfig {
  label: string;
  color: string;
}

export function PlanningTaskStatusBadge({
  status,
  className,
  config,
}: PlanningTaskStatusBadgeProps) {
  const t = useTranslations("modules.planning.tasks");

  if (config) {
    return (
      <Badge
        variant="outline"
        className={cn("border-0 text-xs font-medium", className)}
        style={{
          backgroundColor: `${config.color}1a`,
          color: config.color,
        }}
      >
        {config.label}
      </Badge>
    );
  }

  const labelKey = status === "in_progress" ? "inProgress" : status;
  const label = t(labelKey as "open" | "inProgress" | "completed" | "cancelled");
  const statusClassName = STATUS_CLASSES[status] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-xs font-medium", statusClassName, className)}
    >
      {label}
    </Badge>
  );
}
