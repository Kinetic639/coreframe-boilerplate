"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/utils";

interface VarianceBulkApproveBarProps {
  totalLines: number;
  unapprovedCount: number;
  /** Lines actually eligible for bulk-approve right now (status="counted"
   * among shortages/surpluses/matches) — distinct from unapprovedCount,
   * which also includes pending/needs_recount/skipped lines that bulk
   * approve can never touch. Disables the button once this reaches 0 so it
   * can't fire the "line_ids must contain at least 1 element" server error. */
  eligibleCount: number;
  onApproveAll: () => void;
}

export function VarianceBulkApproveBar({
  totalLines,
  unapprovedCount,
  eligibleCount,
  onApproveAll,
}: VarianceBulkApproveBarProps) {
  const t = useTranslations("warehouseInventory.audits.review");
  const disabled = eligibleCount === 0;

  return (
    <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs shadow-md">
      <div className="space-y-0.5">
        <span className="block text-muted-foreground">
          {t("itemsCount")} <strong className="font-mono text-foreground">{totalLines}</strong>
        </span>
        <span className="block text-muted-foreground">
          {t("unapprovedCount")}{" "}
          <strong className="font-mono text-primary">{unapprovedCount}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={onApproveAll}
        disabled={disabled}
        className={cn(
          "rounded-lg border px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-colors",
          disabled
            ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
            : "cursor-pointer border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
        )}
      >
        {t("approveAll")}
      </button>
    </div>
  );
}
