"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReportKpiTilesProps {
  locationsChecked: number;
  processedCount: number;
  totalCount: number;
  surplusCount: number;
  surplusTotal: number;
  shortageCount: number;
  shortageTotal: number;
}

export function ReportKpiTiles({
  locationsChecked,
  processedCount,
  totalCount,
  surplusCount,
  surplusTotal,
  shortageCount,
  shortageTotal,
}: ReportKpiTilesProps) {
  const t = useTranslations("warehouseInventory.audits.report");

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 shadow-md">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {t("kpiLocations")}
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold text-foreground">{locationsChecked}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("kpiLocationsUnit")}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 shadow-md">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {t("kpiProcessed")}
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold text-foreground">
            {processedCount}/{totalCount}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {t("kpiProcessedUnit")}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-xl border border-l-4 border-border border-l-emerald-500 bg-card p-3.5 shadow-md">
        <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-500">
          <TrendingUp size={11} /> {t("kpiSurplus")}
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold text-emerald-500">+{surplusTotal}</span>
          <span className="font-mono text-[9px] text-muted-foreground">({surplusCount})</span>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-xl border border-l-4 border-border border-l-red-500 bg-card p-3.5 shadow-md">
        <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-red-500">
          <TrendingDown size={11} /> {t("kpiShortage")}
        </span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold text-red-500">-{shortageTotal}</span>
          <span className="font-mono text-[9px] text-muted-foreground">({shortageCount})</span>
        </div>
      </div>
    </div>
  );
}
