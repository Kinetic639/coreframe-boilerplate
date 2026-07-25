"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TaskStatus } from "@/lib/validations/planning";

const STATUS_CLASSES: Record<TaskStatus, string> = {
  open: "border-border bg-transparent text-blue-800 dark:text-blue-300",
  in_progress: "border-border bg-transparent text-amber-800 dark:text-amber-300",
  completed: "border-border bg-transparent text-emerald-800 dark:text-emerald-300",
  cancelled: "border-border bg-transparent text-gray-600 dark:text-gray-400",
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
        className={cn(
          "max-w-32 min-w-20 justify-center gap-1.5 px-2 text-xs font-medium",
          className
        )}
        style={{
          color: config.color,
        }}
        title={config.label}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
        <span className="min-w-0 truncate">{config.label}</span>
      </Badge>
    );
  }

  const labelKey = status === "in_progress" ? "inProgress" : status;
  const label = t(labelKey as "open" | "inProgress" | "completed" | "cancelled");
  const statusClassName = STATUS_CLASSES[status] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-32 min-w-20 justify-center gap-1.5 px-2 text-xs font-medium",
        statusClassName,
        className
      )}
      title={label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
}
