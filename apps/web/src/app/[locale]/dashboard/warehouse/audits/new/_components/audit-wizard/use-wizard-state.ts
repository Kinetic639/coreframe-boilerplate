"use client";

import { useMemo, useState } from "react";
import { expandLocationIds } from "@/lib/warehouse/count-session-scope";
import type { CountSessionType } from "@/lib/warehouse/count-session-types";
import type { WizardLocationOption } from "./types";

/**
 * All wizard step/field state, plus the derived (memoized) expanded
 * location-id list — a genuine memoization candidate per the plan's
 * guidance (§14): recomputing subtree expansion on every keystroke of
 * unrelated fields would be wasteful once the location count grows.
 */
export function useWizardState(allLocations: WizardLocationOption[]) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [countType, setCountType] = useState<CountSessionType>("location");

  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [includeChildren, setIncludeChildren] = useState(true);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierLocationFilterId, setSupplierLocationFilterId] = useState<string>("all");

  const [showExpectedQuantity, setShowExpectedQuantityState] = useState(true);
  const [includeZeroStock, setIncludeZeroStock] = useState(true);
  const [requireReasonForVariance, setRequireReasonForVariance] = useState(true);

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  const selectAllTopLocations = () => {
    setSelectedLocationIds(allLocations.filter((l) => !l.parent_id).map((l) => l.id));
  };

  const clearLocations = () => setSelectedLocationIds([]);

  const expandedLocationIds = useMemo(() => {
    if (countType !== "location") return [];
    return expandLocationIds(allLocations, selectedLocationIds, includeChildren);
  }, [allLocations, countType, selectedLocationIds, includeChildren]);

  /** Blind mode forces require-reason off — mirrors the prototype's exact
   * dependent-toggle behavior (a reason can't reference a system quantity
   * the counter never saw). */
  const setShowExpectedQuantity = (value: boolean) => {
    setShowExpectedQuantityState(value);
    if (!value) setRequireReasonForVariance(false);
  };

  return {
    step,
    setStep,
    countType,
    setCountType,
    selectedLocationIds,
    toggleLocation,
    selectAllTopLocations,
    clearLocations,
    includeChildren,
    setIncludeChildren,
    expandedLocationIds,
    selectedSupplierId,
    setSelectedSupplierId,
    supplierLocationFilterId,
    setSupplierLocationFilterId,
    showExpectedQuantity,
    setShowExpectedQuantity,
    includeZeroStock,
    setIncludeZeroStock,
    requireReasonForVariance,
    setRequireReasonForVariance,
  };
}

export type WizardStateResult = ReturnType<typeof useWizardState>;
