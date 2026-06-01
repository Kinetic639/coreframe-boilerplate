"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TicketStatus } from "@/lib/validations/helpdesk";

const STATUS_DEFAULTS: Record<TicketStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  waiting: {
    label: "Waiting",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  waiting_response: {
    label: "Waiting Response",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  closed: {
    label: "Closed",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export interface StatusBadgeConfig {
  label: string;
  color: string; // hex e.g. "#3b82f6"
}

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
  config?: StatusBadgeConfig;
}

export function TicketStatusBadge({ status, className, config }: TicketStatusBadgeProps) {
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
