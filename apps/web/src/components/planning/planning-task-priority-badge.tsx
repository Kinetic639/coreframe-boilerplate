"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskPriority } from "@/lib/validations/planning";

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface PlanningTaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
  config?: PlanningPriorityBadgeConfig | null;
}

export interface PlanningPriorityBadgeConfig {
  label: string;
  color: string;
}

export function PlanningTaskPriorityBadge({
  priority,
  className,
  config,
}: PlanningTaskPriorityBadgeProps) {
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

  const label = t(priority);
  const priorityClassName = PRIORITY_CLASSES[priority] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-xs font-medium", priorityClassName, className)}
    >
      {label}
    </Badge>
  );
}
