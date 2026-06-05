"use client";

import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TicketPriority } from "@/lib/validations/helpdesk";

const PRIORITY_DEFAULTS: Record<TicketPriority, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "border-border bg-transparent text-gray-600 dark:text-gray-400",
  },
  medium: {
    label: "Medium",
    className: "border-border bg-transparent text-blue-700 dark:text-blue-300",
  },
  high: {
    label: "High",
    className: "border-border bg-transparent text-orange-700 dark:text-orange-300",
  },
  urgent: {
    label: "Urgent",
    className: "border-border bg-transparent text-red-700 dark:text-red-400",
  },
};

export interface PriorityBadgeConfig {
  label: string;
  color: string; // hex
}

interface TicketPriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
  config?: PriorityBadgeConfig;
}

export function TicketPriorityBadge({ priority, className, config }: TicketPriorityBadgeProps) {
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

  const defaults = PRIORITY_DEFAULTS[priority] ?? {
    label: priority,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-28 min-w-16 justify-center gap-1 rounded-md px-1.5 text-xs font-medium",
        defaults.className,
        className
      )}
      title={defaults.label}
    >
      <Flag className="h-3 w-3 shrink-0 fill-current opacity-70" />
      <span className="min-w-0 truncate">{defaults.label}</span>
    </Badge>
  );
}
