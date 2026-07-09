"use client";

import { useMemo, useState } from "react";
import {
  computeProgressStats,
  filterByLocation,
  getNextUnresolvedIndex,
  getPreviousUnresolvedIndex,
  sortLinesByLocation,
} from "./count-navigation";
import type { EnrichedCountLine } from "./types";

/**
 * Owns the guided-count screen's local walk-through state: sorted/filtered
 * line list, current position, and location filter. Pure derivations are
 * delegated to count-navigation.ts (independently unit-tested); this hook
 * only wires them to React state.
 */
export function useCountSessionState(lines: EnrichedCountLine[]) {
  const allSortedLines = useMemo(() => sortLinesByLocation(lines), [lines]);

  const [locationFilterId, setLocationFilterId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const filteredLines = useMemo(
    () => filterByLocation(allSortedLines, locationFilterId),
    [allSortedLines, locationFilterId]
  );

  const safeIndex =
    currentIndex >= filteredLines.length ? Math.max(filteredLines.length - 1, 0) : currentIndex;
  const currentLine = filteredLines[safeIndex] ?? null;

  const overallStats = useMemo(() => computeProgressStats(allSortedLines), [allSortedLines]);
  const filteredStats = useMemo(() => computeProgressStats(filteredLines), [filteredLines]);

  function goToNextUnresolved() {
    const next = getNextUnresolvedIndex(filteredLines, safeIndex);
    if (next !== -1) setCurrentIndex(next);
    return next;
  }

  function goToPreviousUnresolved() {
    const prev = getPreviousUnresolvedIndex(filteredLines, safeIndex);
    if (prev !== -1) setCurrentIndex(prev);
    return prev;
  }

  function selectIndex(index: number) {
    setCurrentIndex(index);
  }

  function setLocationFilter(locationId: string | null) {
    setLocationFilterId(locationId);
    setCurrentIndex(0);
  }

  return {
    allSortedLines,
    filteredLines,
    currentLine,
    currentIndex: safeIndex,
    locationFilterId,
    overallStats,
    filteredStats,
    goToNextUnresolved,
    goToPreviousUnresolved,
    selectIndex,
    setLocationFilter,
  };
}
