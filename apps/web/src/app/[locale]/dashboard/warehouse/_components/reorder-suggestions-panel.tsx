"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Copy, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useReorderReportQuery,
  useSetReorderSuggestionActionMutation,
} from "@/hooks/queries/warehouse/audits";
import type { EnrichedReorderReportRow } from "@/lib/warehouse/count-session-types";

interface ReorderSuggestionsPanelProps {
  initialRows: EnrichedReorderReportRow[];
  branchId: string;
  countSessionId?: string | null;
  /** Params forwarded to useReorderReportQuery — must match whatever the
   * caller used to produce initialRows so the query key lines up. */
  params?: { locationId?: string; supplierId?: string };
  /** Restricts the live rows to this variant set — used by the audit
   * final-report's embedded panel to stay pre-filtered to that session's
   * affected variants across refetches, not just on first paint. */
  filterVariantIds?: Set<string>;
}

/** Shared display component for reorder suggestions — used by both the
 * standalone /reports/reorder page and the audit final-report's embedded
 * panel (pre-filtered to that session's affected variants by the caller).
 * Subscribes to the same React Query cache useSetReorderSuggestionActionMutation
 * invalidates — without this, accept/ignore buttons stayed frozen at the SSR
 * snapshot until a full page reload. */
export function ReorderSuggestionsPanel({
  initialRows,
  branchId,
  countSessionId,
  params = {},
  filterVariantIds,
}: ReorderSuggestionsPanelProps) {
  const t = useTranslations("warehouseReports.reorder");
  const [copied, setCopied] = useState(false);
  const setAction = useSetReorderSuggestionActionMutation(branchId);

  const { data } = useReorderReportQuery(branchId, params, initialRows);
  const liveRows = data ?? initialRows;
  const rows = useMemo(
    () =>
      filterVariantIds ? liveRows.filter((r) => filterVariantIds.has(r.variant_id)) : liveRows,
    [liveRows, filterVariantIds]
  );

  const groups = useMemo(() => {
    const bySupplier = new Map<string, EnrichedReorderReportRow[]>();
    for (const row of rows) {
      const key = row.supplierName ?? "__none__";
      const list = bySupplier.get(key) ?? [];
      list.push(row);
      bySupplier.set(key, list);
    }
    return bySupplier;
  }, [rows]);

  function handleCopy() {
    const lines = rows
      .filter((r) => r.actionStatus !== "ignored")
      .map(
        (r) =>
          `SKU: ${r.sku} | Qty: ${r.suggested_order_quantity} ${r.unitCode} | Vendor: ${r.supplierName ?? "-"}`
      )
      .join("\n");
    navigator.clipboard.writeText(lines || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAccept(row: EnrichedReorderReportRow) {
    setAction.mutate({
      variant_id: row.variant_id,
      location_id: row.location_id,
      status: "accepted",
      count_session_id: countSessionId ?? null,
    });
  }

  function handleIgnore(row: EnrichedReorderReportRow) {
    setAction.mutate({
      variant_id: row.variant_id,
      location_id: row.location_id,
      status: "ignored",
      count_session_id: countSessionId ?? null,
    });
  }

  function handleRestore(row: EnrichedReorderReportRow) {
    setAction.mutate({
      variant_id: row.variant_id,
      location_id: row.location_id,
      status: "accepted",
      count_session_id: countSessionId ?? null,
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
          {t("empty")}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{t("emptyDescription")}</p>
      </div>
    );
  }

  const activeCount = rows.filter((r) => r.actionStatus !== "ignored").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingDown size={16} className="text-primary" />
          <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            {t("title")}
          </h4>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary/20"
          >
            <Copy size={12} />
            <span>{copied ? t("copied") : t("copyList")}</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {[...groups.entries()].map(([key, sugs]) => (
          <div
            key={key}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-md"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 p-3">
              <span className="font-mono text-xs font-bold text-foreground">
                {key === "__none__" ? t("noSupplier") : key}
              </span>
              <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-bold text-primary">
                {sugs.filter((s) => s.actionStatus !== "ignored").length}
              </span>
            </div>

            <div className="divide-y divide-border">
              {sugs.map((row) => (
                <div
                  key={`${row.variant_id}:${row.location_id ?? ""}`}
                  className={`space-y-3.5 p-3.5 transition-opacity ${
                    row.actionStatus === "ignored" ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block font-mono text-xs font-bold text-primary">
                        {row.sku}
                      </span>
                      <span className="mt-0.5 block text-xs leading-tight text-foreground">
                        {row.productName}
                      </span>
                    </div>
                    {row.actionStatus !== "ignored" && (
                      <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">
                        +{row.suggested_order_quantity} {row.unitCode}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded border border-border bg-muted/30 p-2 text-center font-mono text-[10px] text-muted-foreground">
                    <div>
                      <span>{t("onHand")}</span>
                      <span className="mt-0.5 block font-bold text-foreground">
                        {row.on_hand_quantity}
                      </span>
                    </div>
                    <div>
                      <span>{t("minQuantity")}</span>
                      <span className="mt-0.5 block font-bold text-foreground">
                        {row.min_quantity ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span>{t("reorderPoint")}</span>
                      <span className="mt-0.5 block font-bold text-foreground">
                        {row.reorder_point}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs">
                    {row.actionStatus === "accepted" ? (
                      <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        <CheckCircle size={12} />
                        {t("accepted")}
                      </span>
                    ) : row.actionStatus === "ignored" ? (
                      <button
                        type="button"
                        onClick={() => handleRestore(row)}
                        className="cursor-pointer font-mono text-xs font-bold text-primary hover:underline"
                      >
                        {t("restoreSuggestion")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleIgnore(row)}
                          className="cursor-pointer rounded px-2 py-1 font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          {t("ignore")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccept(row)}
                          className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                        >
                          {t("accept")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 rounded-xl border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <TrendingDown size={14} className="mt-0.5 shrink-0 text-primary" />
        <p>{t("footerNote")}</p>
      </div>
    </div>
  );
}
