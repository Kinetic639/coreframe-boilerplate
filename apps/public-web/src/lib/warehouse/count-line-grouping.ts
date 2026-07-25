/**
 * Pure grouping logic for the variance-review screen.
 *
 * Not server-only — pure function over plain data, safe to unit-test and
 * import from a client component.
 */
import type { CountLineStatus } from "./count-session-types";

export interface GroupableCountLine {
  id: string;
  status: CountLineStatus;
  variance_quantity: number | null;
  source: "generated" | "unexpected_found";
}

export interface CountLineGroups<T extends GroupableCountLine> {
  shortages: T[];
  surpluses: T[];
  matches: T[];
  needsRecount: T[];
  skipped: T[];
  pending: T[];
}

/**
 * Groups count lines the way the variance-review screen displays them:
 * shortages/surpluses (nonzero-variance counted or approved lines),
 * matches (zero-variance counted/approved lines), needs-recount, skipped,
 * and pending (not yet counted). An unexpected-found line always has
 * expected_quantity=0, so any nonzero counted quantity is inherently a
 * surplus — it is grouped exactly like any other surplus line, no special
 * casing needed here since variance_quantity already reflects that.
 */
export function groupCountLines<T extends GroupableCountLine>(lines: T[]): CountLineGroups<T> {
  const groups: CountLineGroups<T> = {
    shortages: [],
    surpluses: [],
    matches: [],
    needsRecount: [],
    skipped: [],
    pending: [],
  };

  for (const line of lines) {
    if (line.status === "pending") {
      groups.pending.push(line);
      continue;
    }
    if (line.status === "skipped") {
      groups.skipped.push(line);
      continue;
    }
    if (line.status === "needs_recount") {
      groups.needsRecount.push(line);
      continue;
    }
    // status is "counted" or "approved" here.
    const variance = line.variance_quantity ?? 0;
    if (variance === 0) {
      groups.matches.push(line);
    } else if (variance > 0) {
      groups.surpluses.push(line);
    } else {
      groups.shortages.push(line);
    }
  }

  return groups;
}
