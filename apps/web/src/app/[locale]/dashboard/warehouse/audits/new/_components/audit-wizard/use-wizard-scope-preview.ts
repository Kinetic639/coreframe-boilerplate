"use client";

import { useMemo } from "react";
import type { WizardStateResult } from "./use-wizard-state";
import type { WizardStockIndexRow, WizardSupplierOption } from "./types";

/**
 * Local scope-summary derivation for the preview step. Unlike the
 * prototype (which computed an exact line-by-line preview from in-memory
 * mock data), this summarizes the configured scope without an extra
 * server round trip — the RPC has no dry-run mode. A live per-line
 * preview is a reasonable future enhancement, not built here (see
 * implementation report).
 */
export function useWizardScopePreview(
  state: WizardStateResult,
  suppliers: WizardSupplierOption[],
  variantsTotalCount = 0,
  variantsBySupplierCount: Record<string, number> = {},
  stockIndex: WizardStockIndexRow[] = []
) {
  return useMemo(() => {
    const selectedSupplier = suppliers.find((s) => s.id === state.selectedSupplierId) ?? null;

    // How many extra zero-stock catalog lines "include zero-stock items"
    // would add to the audit. This mirrors the count-session RPC's seeding
    // step exactly: for EACH selected location, every active catalog
    // variant that doesn't already have a balance row (positive or zero) at
    // that specific location gets its own line — it's a per-location sum,
    // not a single dedup across the whole scope, since the same
    // out-of-stock variant produces one line per location it's missing
    // from.
    let zeroStockCount = 0;
    if (state.countType === "location") {
      const existingCountByLocation = new Map<string, number>();
      for (const row of stockIndex) {
        existingCountByLocation.set(
          row.locationId,
          (existingCountByLocation.get(row.locationId) ?? 0) + 1
        );
      }
      for (const locationId of state.expandedLocationIds) {
        const existing = existingCountByLocation.get(locationId) ?? 0;
        zeroStockCount += Math.max(0, variantsTotalCount - existing);
      }
    } else if (state.selectedSupplierId) {
      // The RPC cross-joins over location_filter_ids for supplier-scoped
      // sessions — if no specific location is chosen ("all locations"),
      // that array is empty and the RPC's unnest() yields zero rows, i.e.
      // it adds nothing. Only a single explicit location filter actually
      // seeds zero-stock lines.
      if (state.supplierLocationFilterId !== "all") {
        const baseline = variantsBySupplierCount[state.selectedSupplierId] ?? 0;
        const existing = stockIndex.filter(
          (r) =>
            r.supplierId === state.selectedSupplierId &&
            r.locationId === state.supplierLocationFilterId
        ).length;
        zeroStockCount = Math.max(0, baseline - existing);
      }
    }

    return {
      locationCount: state.expandedLocationIds.length,
      selectedLocationCount: state.selectedLocationIds.length,
      selectedSupplierName: selectedSupplier?.name ?? null,
      zeroStockCount,
      canLaunch:
        state.countType === "location"
          ? state.selectedLocationIds.length > 0
          : Boolean(state.selectedSupplierId),
    };
  }, [
    state.countType,
    state.expandedLocationIds,
    state.selectedLocationIds,
    state.selectedSupplierId,
    state.supplierLocationFilterId,
    suppliers,
    variantsTotalCount,
    variantsBySupplierCount,
    stockIndex,
  ]);
}
