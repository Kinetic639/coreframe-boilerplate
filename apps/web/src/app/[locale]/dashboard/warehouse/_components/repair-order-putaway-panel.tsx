"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "react-toastify";

import {
  getRepairOrderStorageSuggestionsAction,
  putawayRepairOrderStockAction,
} from "@/app/actions/warehouse/repair-order-receiving";
import type { RepairOrderStorageSuggestion } from "@/server/services/repair-order-storage.service";

/**
 * Zone 5 Phase 5/7 -- minimal pitch putaway panel.
 *
 * Deliberately self-contained (no dependency on Zone 3's own RepairOrder
 * Workshop UI internals, which this session did not have time to fully map)
 * -- a parent page/panel passes in the lines currently sitting at the
 * receiving location for one RepairOrder, and this component shows
 * consolidate-first suggestions plus a manual-location fallback.
 *
 * Explicitly does NOT show:
 *   - any capacity/percentage figure (no real capacity model exists),
 *   - container recommendations (PILOT scope),
 *   - an UNKNOWN suggestion rendered identically to a KNOWN one.
 *
 * NOT verified against a live backend this session (no Supabase MCP / local
 * DB) -- this component typechecks and its data-shape assumptions match the
 * exact DTO produced by RepairOrderStorageService (unit-tested separately),
 * but end-to-end/browser verification is a disclosed gap, not a hidden one.
 */

export type PutawayLineInput = {
  repairOrderLineId: string;
  variantId: string;
  unitId: string;
  sku: string;
  productName: string;
  availableAtReceiving: number;
};

type Props = {
  repairOrderId: string;
  repairOrderLabel: string;
  receivedLines: PutawayLineInput[];
  onPutawayComplete?: () => void;
};

export function RepairOrderPutawayPanel({
  repairOrderId,
  repairOrderLabel,
  receivedLines,
  onPutawayComplete,
}: Props) {
  const [suggestions, setSuggestions] = useState<RepairOrderStorageSuggestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualLocationId, setManualLocationId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getRepairOrderStorageSuggestionsAction({
        repair_order_id: repairOrderId,
      });
      if (cancelled) return;
      if (result.success === true) {
        setSuggestions(result.data);
      } else {
        setLoadError(result.error ?? "Failed to load current storage");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repairOrderId]);

  function toggleLine(lineId: string, availableQty: number) {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
        setQuantities((q) => ({ ...q, [lineId]: q[lineId] ?? availableQty }));
      }
      return next;
    });
  }

  function submitPutaway(destinationLocationId: string) {
    if (selectedLineIds.size === 0) {
      toast.error("Select at least one received line to put away.");
      return;
    }
    const lines = receivedLines
      .filter((l) => selectedLineIds.has(l.repairOrderLineId))
      .map((l) => ({
        repair_order_line_id: l.repairOrderLineId,
        variant_id: l.variantId,
        unit_id: l.unitId,
        quantity: quantities[l.repairOrderLineId] ?? l.availableAtReceiving,
      }));

    startTransition(async () => {
      const result = await putawayRepairOrderStockAction({
        lines,
        destination_location_id: destinationLocationId,
      });
      if (result.success === true) {
        toast.success("Stock put away.");
        setSelectedLineIds(new Set());
        onPutawayComplete?.();
      } else {
        toast.error(result.error ?? "Putaway failed");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Put away — {repairOrderLabel}</h3>
        <p className="text-xs text-muted-foreground">
          Currently in receiving. Choose which lines to move and where.
        </p>
      </div>

      {/* Received lines to select from */}
      <div className="space-y-1">
        {receivedLines.map((line) => (
          <label key={line.repairOrderLineId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedLineIds.has(line.repairOrderLineId)}
              onChange={() => toggleLine(line.repairOrderLineId, line.availableAtReceiving)}
            />
            <span className="flex-1">
              {line.sku} — {line.productName}
            </span>
            <input
              type="number"
              min={0.01}
              max={line.availableAtReceiving}
              step="any"
              disabled={!selectedLineIds.has(line.repairOrderLineId)}
              value={quantities[line.repairOrderLineId] ?? line.availableAtReceiving}
              onChange={(e) =>
                setQuantities((q) => ({ ...q, [line.repairOrderLineId]: Number(e.target.value) }))
              }
              className="w-20 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
            />
            <span className="text-xs text-muted-foreground">/ {line.availableAtReceiving}</span>
          </label>
        ))}
      </div>

      {/* Current storage suggestions */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Existing storage for this RepairOrder
        </h4>
        {loadError && <p className="text-xs text-destructive">{loadError}</p>}
        {!loadError && suggestions === null && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {!loadError && suggestions?.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No existing storage found for this RepairOrder yet.
          </p>
        )}

        <div className="space-y-2">
          {suggestions
            ?.filter((s) => s.attributionStatus === "known")
            .map((s) => (
              <div
                key={s.locationId}
                className="flex items-center justify-between rounded border border-border p-2"
              >
                <div>
                  <div className="text-sm font-medium">{s.locationCode ?? s.locationName}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.distinctRepairOrderLines} line{s.distinctRepairOrderLines === 1 ? "" : "s"} ·{" "}
                    {s.currentQuantity} pcs currently stored here
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submitPutaway(s.locationId)}
                  className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Put here
                </button>
              </div>
            ))}

          {suggestions?.some((s) => s.attributionStatus === "unknown") && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              Location attribution requires verification for{" "}
              {suggestions.filter((s) => s.attributionStatus === "unknown").length} location(s) —
              not shown as a confident suggestion above.
            </div>
          )}
        </div>
      </div>

      {/* Manual fallback */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <input
          type="text"
          placeholder="Or enter another location ID"
          value={manualLocationId}
          onChange={(e) => setManualLocationId(e.target.value)}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={isPending || !manualLocationId}
          onClick={() => submitPutaway(manualLocationId)}
          className="rounded border border-border px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          Choose another location
        </button>
      </div>
    </div>
  );
}
