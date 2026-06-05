"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { TicketStatus } from "@/lib/validations/helpdesk";

const STATUS_DEFAULTS: Record<TicketStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "border-border bg-transparent text-blue-800 dark:text-blue-300",
  },
  in_progress: {
    label: "In Progress",
    className: "border-border bg-transparent text-yellow-800 dark:text-yellow-300",
  },
  waiting: {
    label: "Waiting",
    className: "border-border bg-transparent text-orange-800 dark:text-orange-300",
  },
  waiting_response: {
    label: "Waiting Response",
    className: "border-border bg-transparent text-purple-800 dark:text-purple-300",
  },
  resolved: {
    label: "Resolved",
    className: "border-border bg-transparent text-green-800 dark:text-green-300",
  },
  closed: {
    label: "Closed",
    className: "border-border bg-transparent text-gray-600 dark:text-gray-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-transparent text-red-700 dark:text-red-400",
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

  const defaults = STATUS_DEFAULTS[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-32 min-w-20 justify-center gap-1.5 px-2 text-xs font-medium",
        defaults.className,
        className
      )}
      title={defaults.label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <span className="min-w-0 truncate">{defaults.label}</span>
    </Badge>
  );
}
