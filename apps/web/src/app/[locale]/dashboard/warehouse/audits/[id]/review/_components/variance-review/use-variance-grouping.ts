"use client";

import { useMemo } from "react";
import { groupCountLines } from "@/lib/warehouse/count-line-grouping";
import type { EnrichedCountLine } from "./types";

/** Wires the pure groupCountLines (independently unit-tested) to React
 * memoization — grouping runs over potentially hundreds of lines and is
 * read by every group-section child, so memoizing is genuinely worthwhile. */
export function useVarianceGrouping(lines: EnrichedCountLine[]) {
  return useMemo(() => groupCountLines(lines), [lines]);
}
