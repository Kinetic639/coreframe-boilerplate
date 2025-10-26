// =============================================
// Movement Status Badge Component
// Displays movement status with color-coded badges
// =============================================

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react";
import type { MovementStatus } from "../types/stock-movements";

interface MovementStatusBadgeProps {
  status: MovementStatus;
  className?: string;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<
  MovementStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: typeof Clock;
  }
> = {
  pending: {
    label: "Pending",
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 bg-yellow-50",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    variant: "default",
    className: "bg-blue-500 text-white",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    variant: "default",
    className: "bg-green-500 text-white",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive",
    className: "bg-red-500 text-white",
    icon: XCircle,
  },
  reversed: {
    label: "Reversed",
    variant: "secondary",
    className: "bg-gray-500 text-white",
    icon: RotateCcw,
  },
};

export function MovementStatusBadge({
  status,
  className = "",
  showIcon = true,
}: MovementStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className}`}>
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
