"use client";

import { useEffect, useMemo } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import { ReportKpiTiles } from "./report-kpi-tiles";
import { ReportAdjustmentsList } from "./report-adjustments-list";
import { ReportAuditTrail } from "./report-audit-trail";
import { ReportReorderPanel } from "./report-reorder-panel";
import type {
  AdjustmentLine,
  EnrichedCountLine,
  EnrichedReorderReportRow,
  FinalReportSessionInfo,
} from "./types";

interface FinalReportScreenProps {
  session: FinalReportSessionInfo;
  lines: EnrichedCountLine[];
  adjustments: AdjustmentLine[];
  /** Full, unfiltered branch reorder report (see ReportReorderPanel). */
  initialReorderRows: EnrichedReorderReportRow[];
  reorderFilterVariantIds: Set<string>;
  branchId: string;
  branchName: string | null;
  supplierName: string | null;
}

export function FinalReportScreen({
  session,
  lines,
  adjustments,
  initialReorderRows,
  reorderFilterVariantIds,
  branchId,
  branchName,
  supplierName,
}: FinalReportScreenProps) {
  const t = useTranslations("warehouseInventory.audits.report");
  const locale = useLocale();

  // Full-bleed mobile-first screen — no dashboard-shell padding around it.
  const setFlushContent = useUiStoreV2((s) => s.setFlushContent);
  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const stats = useMemo(() => {
    const processed = lines.filter(
      (l) => l.status === "counted" || l.status === "approved" || l.status === "skipped"
    ).length;
    const locationsChecked = new Set(lines.map((l) => l.location_id)).size;
    let surplusCount = 0;
    let surplusTotal = 0;
    let shortageCount = 0;
    let shortageTotal = 0;
    for (const line of lines) {
      if (line.status !== "counted" && line.status !== "approved") continue;
      const variance = line.variance_quantity ?? 0;
      if (variance > 0) {
        surplusCount++;
        surplusTotal += variance;
      } else if (variance < 0) {
        shortageCount++;
        shortageTotal += Math.abs(variance);
      }
    }
    return {
      processed,
      locationsChecked,
      surplusCount,
      surplusTotal,
      shortageCount,
      shortageTotal,
    };
  }, [lines]);

  return (
    <div className="h-full overflow-y-auto bg-transparent pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 shadow-md backdrop-blur-md">
        <Link
          href="/dashboard/warehouse/audits"
          className="flex items-center gap-1 rounded-lg p-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted hover:text-primary"
        >
          {t("backToDashboard")}
        </Link>
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
          {t("reportTitle")}
        </span>
        <div className="w-16" />
      </div>

      <div className="mx-auto max-w-md space-y-5 px-4 py-4">
        <div className="relative space-y-3.5 overflow-hidden rounded-2xl border border-border bg-card p-5 text-center shadow-lg">
          <div className="pointer-events-none absolute bottom-[-20px] right-[-20px] select-none text-primary/10">
            <FileText size={120} />
          </div>

          <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-500 shadow-sm">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-1">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("postedBadge")}
            </span>
            <h2 className="font-mono text-lg font-black text-foreground">{session.count_number}</h2>
            <p className="mx-auto max-w-xs text-xs leading-normal text-muted-foreground">
              {t("postedDescription")}
            </p>
          </div>

          <div className="space-y-2 divide-y divide-border rounded-lg border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            <div className="flex justify-between pt-1">
              <span>{t("typeLabel")}</span>
              <span className="font-semibold text-foreground">
                {session.scope.count_type === "location" ? t("typeLocation") : t("typeSupplier")}
              </span>
            </div>
            {branchName && (
              <div className="flex justify-between pt-2">
                <span>{t("kpiLocations")}:</span>
                <span className="font-semibold text-foreground">{branchName}</span>
              </div>
            )}
            {supplierName && (
              <div className="flex justify-between pt-2">
                <span>{t("supplierScopeLabel")}</span>
                <span className="font-semibold text-foreground">{supplierName}</span>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <span>{t("postedAtLabel")}</span>
              <span className="font-mono font-semibold text-foreground">
                {session.approved_at ? new Date(session.approved_at).toLocaleString(locale) : "—"}
              </span>
            </div>
          </div>
        </div>

        <ReportKpiTiles
          locationsChecked={stats.locationsChecked}
          processedCount={stats.processed}
          totalCount={lines.length}
          surplusCount={stats.surplusCount}
          surplusTotal={stats.surplusTotal}
          shortageCount={stats.shortageCount}
          shortageTotal={stats.shortageTotal}
        />

        <ReportReorderPanel
          initialRows={initialReorderRows}
          filterVariantIds={reorderFilterVariantIds}
          branchId={branchId}
          countSessionId={session.id}
        />

        <ReportAdjustmentsList adjustments={adjustments} />

        <ReportAuditTrail
          createdAt={session.created_at}
          updatedAt={session.updated_at}
          approvedAt={session.approved_at}
          totalLines={lines.length}
        />
      </div>
    </div>
  );
}
