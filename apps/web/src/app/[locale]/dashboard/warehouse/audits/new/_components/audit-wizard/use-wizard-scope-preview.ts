"use client";

import { useMemo } from "react";
import type { WizardStateResult } from "./use-wizard-state";
import type { WizardSupplierOption } from "./types";

/**
 * Local scope-summary derivation for the preview step. Unlike the
 * prototype (which computed an exact line-by-line preview from in-memory
 * mock data), this summarizes the configured scope without an extra
 * server round trip — the RPC has no dry-run mode. A live per-line
 * preview is a reasonable future enhancement, not built here (see
 * implementation report).
 */
export function useWizardScopePreview(state: WizardStateResult, suppliers: WizardSupplierOption[]) {
  return useMemo(() => {
    const selectedSupplier = suppliers.find((s) => s.id === state.selectedSupplierId) ?? null;
    return {
      locationCount: state.expandedLocationIds.length,
      selectedLocationCount: state.selectedLocationIds.length,
      selectedSupplierName: selectedSupplier?.name ?? null,
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
    suppliers,
  ]);
}
