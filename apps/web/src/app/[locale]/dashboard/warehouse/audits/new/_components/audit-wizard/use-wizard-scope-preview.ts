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

    // How many catalog variants have zero on-hand stock across the
    // currently-configured scope — i.e. how many lines "include zero-stock
    // items" would add to the audit. A variant absent from stockIndex
    // (which only carries positive-stock rows) is zero-stock by definition.
    let zeroStockCount = 0;
    if (state.countType === "location") {
      const expandedSet = new Set(state.expandedLocationIds);
      const stockedVariantIds = new Set(
        stockIndex.filter((r) => expandedSet.has(r.locationId)).map((r) => r.variantId)
      );
      zeroStockCount = Math.max(0, variantsTotalCount - stockedVariantIds.size);
    } else if (state.selectedSupplierId) {
      const baseline = variantsBySupplierCount[state.selectedSupplierId] ?? 0;
      const locationFilterActive = state.supplierLocationFilterId !== "all";
      const stockedVariantIds = new Set(
        stockIndex
          .filter(
            (r) =>
              r.supplierId === state.selectedSupplierId &&
              (!locationFilterActive || r.locationId === state.supplierLocationFilterId)
          )
          .map((r) => r.variantId)
      );
      zeroStockCount = Math.max(0, baseline - stockedVariantIds.size);
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
