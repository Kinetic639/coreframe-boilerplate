/**
 * "Recently opened" for the global search palette.
 *
 * Per viewer convenience only: kept in localStorage per user + organization,
 * never sent anywhere. Every read and write is guarded — private windows and
 * blocked storage just mean an empty list.
 */

export interface RecentSearchItem {
  /** Palette item id (entry id or hit id) — dedupe key */
  id: string;
  kind: "page" | "hit";
  label: string;
  /** Mono identifier for data hits (order number, SKU, code) */
  code?: string | null;
  subtitle?: string;
  /** Icon: sidebar icon key for pages, hit type for data */
  icon: string;
  href: string;
  query?: Record<string, string>;
}

export const RECENT_LIMIT = 6;
const KEY_PREFIX = "ambra.globalSearch.recent";

function storageKey(userId: string, orgId: string): string {
  return `${KEY_PREFIX}.${userId}.${orgId}`;
}

function isRecentItem(value: unknown): value is RecentSearchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.kind === "page" || item.kind === "hit") &&
    typeof item.label === "string" &&
    typeof item.icon === "string" &&
    typeof item.href === "string" &&
    item.href.startsWith("/dashboard/")
  );
}

export function readRecentSearches(userId: string, orgId: string): RecentSearchItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, orgId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentItem).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Puts `item` first, drops its older copy, keeps RECENT_LIMIT items */
export function pushRecentSearch(
  userId: string,
  orgId: string,
  item: RecentSearchItem
): RecentSearchItem[] {
  const next = [item, ...readRecentSearches(userId, orgId).filter((r) => r.id !== item.id)].slice(
    0,
    RECENT_LIMIT
  );
  try {
    window.localStorage.setItem(storageKey(userId, orgId), JSON.stringify(next));
  } catch {
    // Storage unavailable: the list just is not remembered
  }
  return next;
}
