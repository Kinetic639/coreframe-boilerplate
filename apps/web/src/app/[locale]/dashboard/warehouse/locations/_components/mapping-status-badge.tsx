"use client";

import { Badge } from "@/components/ui/badge";
import type { LocationMappingStatus } from "@/lib/types/warehouse/locations-v2";

const CONFIG: Record<LocationMappingStatus, { label: string; className: string }> = {
  mapped: {
    label: "Mapped",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  partially_mapped: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  unmapped: {
    label: "Unmapped",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

interface MappingStatusBadgeProps {
  status: LocationMappingStatus;
  size?: "sm" | "xs";
}

export function MappingStatusBadge({ status, size = "sm" }: MappingStatusBadgeProps) {
  const { label, className } = CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={`${className} ${size === "xs" ? "px-1 py-0 text-[10px]" : "text-xs"} font-medium`}
    >
      {label}
    </Badge>
  );
}
