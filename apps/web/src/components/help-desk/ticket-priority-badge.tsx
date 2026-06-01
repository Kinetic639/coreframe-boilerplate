"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TicketPriority } from "@/lib/validations/helpdesk";

const PRIORITY_DEFAULTS: Record<TicketPriority, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  medium: {
    label: "Medium",
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
