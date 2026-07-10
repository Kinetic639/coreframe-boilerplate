"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ReorderSuggestionsPanel } from "../../../../../_components/reorder-suggestions-panel";
import type { EnrichedReorderReportRow } from "./types";

interface ReportReorderPanelProps {
  /** Full, unfiltered branch reorder report — must match what the standalone
   * report page would fetch, so it seeds the same React Query cache key
   * (`useReorderReportQuery(branchId, {})`) rather than truncating it. */
  initialRows: EnrichedReorderReportRow[];
  /** Restricts display to this session's affected variants — applied
   * client-side by ReorderSuggestionsPanel so it stays correct across
   * refetches, not just on first paint. */
  filterVariantIds: Set<string>;
  branchId: string;
  countSessionId: string;
}

/** Pre-filtered to this session's affected variants — links out to the full
 * standalone reorder report instead of duplicating the unfiltered query. */
export function ReportReorderPanel({
  initialRows,
  filterVariantIds,
  branchId,
  countSessionId,
}: ReportReorderPanelProps) {
  const t = useTranslations("warehouseInventory.audits.report");

  const hasAnyInScope = initialRows.some((r) => filterVariantIds.has(r.variant_id));
  if (!hasAnyInScope) {
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
      <ReorderSuggestionsPanel
        initialRows={initialRows}
        filterVariantIds={filterVariantIds}
        branchId={branchId}
        countSessionId={countSessionId}
      />
    </div>
  );
}
