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
  stockIndex: WizardStockIndexRow[] = []
) {
  return useMemo(() => {
    const selectedSupplier = suppliers.find((s) => s.id === state.selectedSupplierId) ?? null;

    // How many extra zero-stock lines "include zero-stock items" would add
    // to the audit. The count-session RPC only ever seeds lines from
    // EXISTING balance rows in the selected scope — it never invents a line
    // for a (variant, location) pair with no tracked relationship at all —
    // so this is exactly "how many existing rows in scope already read
    // zero", never a catalog-wide estimate.
    let zeroStockCount = 0;
    if (state.countType === "location") {
      const expandedSet = new Set(state.expandedLocationIds);
      zeroStockCount = stockIndex.filter((r) => r.isZero && expandedSet.has(r.locationId)).length;
    } else if (state.selectedSupplierId) {
      // The RPC's primary branch applies the supplier filter across ALL
      // branch locations when no location_filter_ids narrowing is chosen
      // ("all locations") — only a single explicit location filter
      // restricts it to that one location.
      const locationFilterActive = state.supplierLocationFilterId !== "all";
      zeroStockCount = stockIndex.filter(
        (r) =>
          r.isZero &&
          (r.supplierIds?.includes(state.selectedSupplierId!) ||
            r.supplierId === state.selectedSupplierId) &&
          (!locationFilterActive || r.locationId === state.supplierLocationFilterId)
      ).length;
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
    stockIndex,
  ]);
}
