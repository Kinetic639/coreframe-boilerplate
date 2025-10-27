"use client";

// =============================================
// Delivery Status Badge Component
// Displays delivery status in Odoo style
// =============================================

import { Badge } from "@/components/ui/badge";
import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/modules/warehouse/types/deliveries";
import { useLocale } from "next-intl";

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  className?: string;
}

export function DeliveryStatusBadge({ status, className }: DeliveryStatusBadgeProps) {
  const locale = useLocale() as "pl" | "en";
  const config = DELIVERY_STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className={`${config.color} ${className || ""}`}>
      {config.label[locale] || config.label.en}
    </Badge>
  );
}
