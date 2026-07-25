"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskPriority } from "@/lib/validations/planning";

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  low: "border-border bg-transparent text-slate-600 dark:text-slate-400",
  normal: "border-border bg-transparent text-blue-700 dark:text-blue-300",
  high: "border-border bg-transparent text-orange-700 dark:text-orange-300",
  urgent: "border-border bg-transparent text-red-700 dark:text-red-400",
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
        className={cn(
          "max-w-28 min-w-16 justify-center gap-1 rounded-md px-1.5 text-xs font-medium",
          className
        )}
        style={{
          color: config.color,
        }}
        title={config.label}
      >
        <Flag className="h-3 w-3 shrink-0 fill-current opacity-70" />
        <span className="min-w-0 truncate">{config.label}</span>
      </Badge>
    );
  }

  const label = t(priority);
  const priorityClassName = PRIORITY_CLASSES[priority] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-28 min-w-16 justify-center gap-1 rounded-md px-1.5 text-xs font-medium",
        priorityClassName,
        className
      )}
      title={label}
    >
      <Flag className="h-3 w-3 shrink-0 fill-current opacity-70" />
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
}
