import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { CountSessionStatus } from "@/lib/warehouse/count-session-types";
import { COUNT_SESSION_STATUS_COLOR_CLASSES } from "@/lib/warehouse/count-status-colors";

export function AuditStatusBadge({ status }: { status: CountSessionStatus }) {
  const t = useTranslations("warehouseInventory.audits.dashboard");
  const colors = COUNT_SESSION_STATUS_COLOR_CLASSES[status];
  const labelKey: Record<CountSessionStatus, string> = {
    draft: "statusDraft",
    counting: "statusCounting",
    submitted: "statusSubmitted",
    approved: "statusApproved",
    cancelled: "statusCancelled",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold uppercase tracking-wide",
        colors.text,
        colors.bg,
        colors.border,
        status === "counting" && "animate-pulse"
      )}
    >
      {t(labelKey[status])}
    </Badge>
  );
}
