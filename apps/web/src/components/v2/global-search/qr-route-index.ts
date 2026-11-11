"use client";

import { useCallback, useEffect } from "react";

/**
 * Where the organization's QR labels point, kept in memory for the session
 * (loaded when the scanner opens, refreshed when older than a minute), so a
 * scanned location or container label opens its page straight away instead
 * of going through /qr first. Anything else -- an unknown code, another
 * branch, a ticket or a task (their page needs a number lookup) -- keeps
 * going through /qr, which validates it and offers the branch switch.
 */

export type QrRouteEntry = {
  token: string;
  targetType: string;
  targetId: string;
  branchId: string | null;
};

const REFRESH_AFTER_MS = 60_000;

const cache: {
  organizationId: string | null;
  loadedAt: number;
  byToken: Map<string, QrRouteEntry>;
  pending: Promise<void> | null;
} = { organizationId: null, loadedAt: 0, byToken: new Map(), pending: null };

function load(organizationId: string) {
  if (cache.pending) return cache.pending;
  const fresh =
    cache.organizationId === organizationId && Date.now() - cache.loadedAt < REFRESH_AFTER_MS;
  if (fresh) return Promise.resolve();
  cache.pending = fetch(`/api/qr/index?${new URLSearchParams({ organizationId })}`, {
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) return;
      const body = (await res.json()) as { success: boolean; data?: QrRouteEntry[] };
      if (!body.success || !body.data) return;
      cache.organizationId = organizationId;
      cache.loadedAt = Date.now();
      cache.byToken = new Map(body.data.map((e) => [e.token, e]));
    })
    .catch(() => {
      /* offline: scans keep going through /qr */
    })
    .finally(() => {
      cache.pending = null;
    });
  return cache.pending;
}

/** The page a known label opens directly, or null to go through /qr. */
export function directQrHref(entry: QrRouteEntry | undefined, activeBranchId: string | null) {
  if (!entry || !activeBranchId || entry.branchId !== activeBranchId) return null;
  if (entry.targetType === "warehouse.location") {
    return {
      pathname: "/dashboard/warehouse/locations" as const,
      query: { selected: entry.targetId, view: "tree" },
    };
  }
  if (entry.targetType === "inventory.container") {
    return {
      pathname: "/dashboard/warehouse/containers/[id]" as const,
      params: { id: entry.targetId },
    };
  }
  return null;
}

export function useQrRouteIndex(organizationId: string | null, enabled: boolean) {
  useEffect(() => {
    if (enabled && organizationId) void load(organizationId);
  }, [enabled, organizationId]);

  return useCallback(
    (token: string) =>
      cache.organizationId === organizationId ? cache.byToken.get(token) : undefined,
    [organizationId]
  );
}

/** Test hook: forget what was loaded. */
export function resetQrRouteIndex() {
  cache.organizationId = null;
  cache.loadedAt = 0;
  cache.byToken = new Map();
  cache.pending = null;
}
