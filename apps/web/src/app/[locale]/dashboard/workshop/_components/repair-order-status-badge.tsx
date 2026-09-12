import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RepairOrderStatus } from "@/lib/types/repair-orders";

const STATUS_VARIANT: Record<RepairOrderStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  closed: "secondary",
  archived: "outline",
};

export function RepairOrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations("modules.workshop.repairOrders");
  const variant = STATUS_VARIANT[status as RepairOrderStatus] ?? "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {t(`status.${status}`, { fallback: status } as any)}
    </Badge>
  );
}
