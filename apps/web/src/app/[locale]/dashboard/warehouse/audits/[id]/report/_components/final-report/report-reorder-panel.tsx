"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ReorderSuggestionsPanel } from "../../../../../_components/reorder-suggestions-panel";
import type { EnrichedReorderReportRow } from "./types";

interface ReportReorderPanelProps {
  rows: EnrichedReorderReportRow[];
  branchId: string;
  countSessionId: string;
}

/** Pre-filtered to this session's affected variants (by the SSR page, not a
 * separate RPC filter param) — links out to the full standalone reorder
 * report instead of duplicating the unfiltered query. */
export function ReportReorderPanel({ rows, branchId, countSessionId }: ReportReorderPanelProps) {
  const t = useTranslations("warehouseInventory.audits.report");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground shadow-md">
        {t("reorderEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-md">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          {t("reorderTitle")}
        </h4>
        <Link
          href="/dashboard/warehouse/reports/reorder"
          className="font-mono text-[10px] font-bold uppercase text-primary hover:underline"
        >
          {t("reorderViewAll")}
        </Link>
      </div>
      <ReorderSuggestionsPanel rows={rows} branchId={branchId} countSessionId={countSessionId} />
    </div>
  );
}
