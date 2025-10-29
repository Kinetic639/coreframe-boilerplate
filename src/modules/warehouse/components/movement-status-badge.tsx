"use client";

// =============================================
// Movement Status Badge Component
// Displays movement status with color-coded badges
// =============================================

import { useTranslations } from "next-intl";
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
    labelKey: MovementStatus;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: typeof Clock;
  }
> = {
  pending: {
    labelKey: "pending",
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 bg-yellow-50",
    icon: Clock,
  },
  approved: {
    labelKey: "approved",
    variant: "default",
    className: "bg-blue-500 text-white",
    icon: CheckCircle2,
  },
  completed: {
    labelKey: "completed",
    variant: "default",
    className: "bg-green-500 text-white",
    icon: CheckCircle2,
  },
  cancelled: {
    labelKey: "cancelled",
    variant: "destructive",
    className: "bg-red-500 text-white",
    icon: XCircle,
  },
  reversed: {
    labelKey: "reversed",
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
  const t = useTranslations("stockMovements.statuses");
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`${config.className} ${className}`}>
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {t(config.labelKey)}
    </Badge>
  );
}
