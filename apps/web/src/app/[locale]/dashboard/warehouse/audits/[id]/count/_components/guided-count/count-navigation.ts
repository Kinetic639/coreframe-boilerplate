import type { EnrichedCountLine } from "./types";

/** A line is "resolved" once it's been counted/approved with a recorded
 * quantity — matches the prototype's isResolved check exactly. Skipped and
 * needs_recount lines are NOT resolved (they should keep surfacing in the
 * unresolved cycle until the counter returns to them). */
function isResolved(line: EnrichedCountLine): boolean {
  return (
    (line.status === "counted" || line.status === "approved") && line.counted_quantity !== null
  );
}

/** Stable sort: by location code, then by sequence_no — mirrors the
 * prototype's allSortedLines derivation. */
export function sortLinesByLocation(lines: EnrichedCountLine[]): EnrichedCountLine[] {
  return [...lines].sort((a, b) => {
    if (a.locationCode !== b.locationCode) return a.locationCode.localeCompare(b.locationCode);
    return (a.sequence_no ?? 0) - (b.sequence_no ?? 0);
  });
}

export function filterByLocation(
  lines: EnrichedCountLine[],
  locationId: string | null
): EnrichedCountLine[] {
  if (!locationId) return lines;
  return lines.filter((l) => l.location_id === locationId);
}

/** Cycles forward from `startIndex`, wrapping around, to the next
 * not-yet-resolved line. Returns -1 if every line is resolved. */
export function getNextUnresolvedIndex(lines: EnrichedCountLine[], startIndex: number): number {
  const len = lines.length;
  if (len <= 0) return -1;
  for (let i = 1; i <= len; i++) {
    const idx = (startIndex + i) % len;
    if (!isResolved(lines[idx])) return idx;
  }
  return -1;
}

export function getPreviousUnresolvedIndex(lines: EnrichedCountLine[], startIndex: number): number {
  const len = lines.length;
  if (len <= 0) return -1;
  for (let i = 1; i <= len; i++) {
    const idx = (startIndex - i + len) % len;
    if (!isResolved(lines[idx])) return idx;
  }
  return -1;
}

export interface CountProgressStats {
  total: number;
  counted: number;
  percent: number;
}

export function computeProgressStats(lines: EnrichedCountLine[]): CountProgressStats {
  const total = lines.length;
  const counted = lines.filter(isResolved).length;
  const percent = total > 0 ? Math.round((counted / total) * 100) : 0;
  return { total, counted, percent };
}
