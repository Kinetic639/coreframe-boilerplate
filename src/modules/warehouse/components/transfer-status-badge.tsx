"use client";

import { Badge } from "@/components/ui/badge";
import type { TransferStatus } from "../types/inter-warehouse-transfers";

interface TransferStatusBadgeProps {
  status: TransferStatus;
  className?: string;
}

export function TransferStatusBadge({ status, className }: TransferStatusBadgeProps) {
  const statusConfig: Record<
    TransferStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    draft: { label: "Draft", variant: "secondary" },
    pending: { label: "Pending Approval", variant: "outline" },
    approved: { label: "Approved", variant: "default" },
    in_transit: { label: "In Transit", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    rejected: { label: "Rejected", variant: "destructive" },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
