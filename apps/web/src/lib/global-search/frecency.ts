/**
 * "Frecency" of palette items — how often and how recently the user opened
 * them — so the pages, actions and records someone really uses rank first.
 *
 * Per viewer convenience only: kept in localStorage per user + organization
 * (ids only, no labels), never sent anywhere. Guarded like recent.ts.
 */

interface UsageEntry {
  /** Times opened */
  c: number;
  /** Last opened, epoch ms */
  t: number;
}

type UsageMap = Record<string, UsageEntry>;

const KEY_PREFIX = "ambra.globalSearch.usage";
const MAX_ENTRIES = 200;
const DAY = 24 * 60 * 60 * 1000;

function storageKey(userId: string, orgId: string): string {
  return `${KEY_PREFIX}.${userId}.${orgId}`;
}

export function readUsage(userId: string, orgId: string): UsageMap {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, orgId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: UsageMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = value as Partial<UsageEntry> | null;
      if (entry && typeof entry.c === "number" && typeof entry.t === "number") {
        map[id] = { c: entry.c, t: entry.t };
      }
    }
    return map;
  } catch {
    return {};
  }
}

/** Counts one opening of `id`; keeps the MAX_ENTRIES most recent ids */
export function recordUsage(userId: string, orgId: string, id: string, now = Date.now()): UsageMap {
  const map = readUsage(userId, orgId);
  map[id] = { c: (map[id]?.c ?? 0) + 1, t: now };
  const kept = Object.entries(map)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, MAX_ENTRIES);
  const next = Object.fromEntries(kept);
  try {
    window.localStorage.setItem(storageKey(userId, orgId), JSON.stringify(next));
  } catch {
    // Storage unavailable: ranking just falls back to relevance
  }
  return next;
}

/** Usage score: opening count weighted by how recent the last opening was */
export function usageScore(map: UsageMap, id: string, now = Date.now()): number {
  const entry = map[id];
  if (!entry) return 0;
  const age = now - entry.t;
  const recency = age < DAY ? 1 : age < 7 * DAY ? 0.7 : age < 30 * DAY ? 0.4 : 0.2;
  return Math.min(entry.c, 20) * recency;
}
