"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdjustmentLine } from "./types";

interface ReportAdjustmentsListProps {
  adjustments: AdjustmentLine[];
}

export function ReportAdjustmentsList({ adjustments }: ReportAdjustmentsListProps) {
  const t = useTranslations("warehouseInventory.audits.report");

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-md">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="text-primary" size={16} />
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          {t("adjustmentsTitle")}
        </h4>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">{t("adjustmentsDescription")}</p>

      {adjustments.length === 0 ? (
        <div className="rounded border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
          {t("adjustmentsEmpty")}
        </div>
      ) : (
        <div className="max-h-56 space-y-2 divide-y divide-border overflow-y-auto">
          {adjustments.map((line) => (
            <div key={line.id} className="flex items-start justify-between pt-2.5 text-xs">
              <div>
                <span className="block font-mono text-[11px] font-bold text-foreground">
                  {line.sku}
                </span>
                <span className="block line-clamp-1 text-[10px] text-muted-foreground">
                  {line.productName}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                  {line.movement_number}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`font-mono text-xs font-bold ${
                    line.direction === "increase" ? "text-primary" : "text-red-500"
                  }`}
                >
                  {line.direction === "increase" ? "+" : "-"}
                  {line.quantity} {line.unitCode}
                </span>
                {line.reasonCode && (
                  <span className="mt-0.5 block font-mono text-[10px] capitalize text-muted-foreground">
                    {line.reasonCode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
