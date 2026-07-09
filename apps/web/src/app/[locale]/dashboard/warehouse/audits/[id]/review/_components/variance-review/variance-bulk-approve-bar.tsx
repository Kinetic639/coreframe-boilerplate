"use client";

import { useTranslations } from "next-intl";

interface VarianceBulkApproveBarProps {
  totalLines: number;
  unapprovedCount: number;
  onApproveAll: () => void;
}

export function VarianceBulkApproveBar({
  totalLines,
  unapprovedCount,
  onApproveAll,
}: VarianceBulkApproveBarProps) {
  const t = useTranslations("warehouseInventory.audits.review");

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
        className="cursor-pointer rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-emerald-500 transition-colors hover:bg-emerald-500/20"
      >
        {t("approveAll")}
      </button>
    </div>
  );
}
