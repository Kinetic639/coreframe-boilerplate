"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  extractToken,
  type QrScanLookup,
  type ResolvedScan,
  type TokenLookupResult,
} from "@/components/features/qr/qr-camera-scanner";
import type {
  LocationContents,
  QrIndexEntry,
  ScannedContainer,
} from "@/server/services/putaway-scan.service";
import type { RepairOrderInfo } from "./putaway-utils";

/**
 * Scans on the putaway screen are recognised on the phone: the screen comes
 * with every QR code of the organization and what it is assigned to, and
 * with the containers of the orders it shows. Only a code the phone does not
 * know yet (e.g. assigned a moment ago on another device) costs ONE light
 * request (/api/warehouse/putaway/scan), which then joins the index. The
 * putaway itself is checked again by the engine.
 */

export type ScanResolution =
  | {
      ok: true;
      lookup: QrScanLookup;
      /** Known on the phone (no request was made). */
      local: boolean;
      /** For a container code: the container, when the request already brought it. */
      container?: ScannedContainer | null;
      /** For a location code: what lies there, when the request already brought it. */
      location?: LocationContents | null;
    }
  | { ok: false; reason: "invalidToken" | "notFound" | "revoked" | "offline" };

type Options = {
  qrCodes: QrIndexEntry[];
  organizationId: string;
  branchId: string;
  orders: Record<string, RepairOrderInfo>;
};

async function getJson(params: Record<string, string>) {
  const res = await fetch(`/api/warehouse/putaway/scan?${new URLSearchParams(params)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as {
    success: boolean;
    data?: {
      lookup?: QrScanLookup | null;
      container?: ScannedContainer | null;
      location?: LocationContents | null;
    };
  };
}

export function useScanIndex({ qrCodes, organizationId, branchId, orders }: Options) {
  const byToken = useRef(new Map<string, QrIndexEntry>());
  // A fresh page load (router.refresh after a putaway) brings the newest codes.
  useEffect(() => {
    for (const entry of qrCodes) byToken.current.set(entry.token, entry);
  }, [qrCodes]);
  if (byToken.current.size === 0 && qrCodes.length > 0) {
    for (const entry of qrCodes) byToken.current.set(entry.token, entry);
  }

  /** Containers of the orders on the screen, by id. */
  const containers = useMemo(() => {
    const map = new Map<string, ScannedContainer>();
    for (const [repairOrderId, info] of Object.entries(orders)) {
      for (const c of info.containers) {
        map.set(c.id, {
          ...c,
          repairOrderId,
          zlNumber: info.zlNumber,
          clientName: info.clientName,
          vehicleBrand: info.vehicleBrand,
        });
      }
    }
    return map;
  }, [orders]);

  const resolve = useCallback(
    async (text: string): Promise<ScanResolution> => {
      const token = extractToken(text);
      if (!token) return { ok: false, reason: "invalidToken" };

      const known = byToken.current.get(token);
      const target = known?.assignment;
      // Known code, and nothing more to fetch for it: answer at once.
      if (
        known &&
        (target?.target_type !== "inventory.container" || containers.has(target.target_id))
      ) {
        return {
          ok: true,
          local: true,
          lookup: {
            id: known.id,
            token,
            label: null,
            status: "active",
            assignment: target ?? null,
          },
          container: target ? (containers.get(target.target_id) ?? undefined) : undefined,
        };
      }

      try {
        const res = await getJson({ organizationId, branchId, token });
        const lookup = res.data?.lookup ?? null;
        if (!res.success || !lookup) return { ok: false, reason: "notFound" };
        if (lookup.status !== "active") return { ok: false, reason: "revoked" };
        byToken.current.set(token, { id: lookup.id, token, assignment: lookup.assignment });
        return {
          ok: true,
          local: false,
          lookup,
          container: res.data?.container,
          location: res.data?.location,
        };
      } catch {
        return { ok: false, reason: "offline" };
      }
    },
    [containers, organizationId, branchId]
  );

  /** What lies at a location (loaded in the background after a location scan). */
  const locationContents = useCallback(
    async (locationId: string): Promise<LocationContents | null> => {
      const res = await getJson({ organizationId, branchId, locationId });
      return res.success ? (res.data?.location ?? null) : null;
    },
    [organizationId, branchId]
  );

  /** A sticker just put on a new container: its next scan is known at once. */
  const bindSticker = useCallback((qrCodeId: string, containerId: string) => {
    for (const entry of byToken.current.values()) {
      if (entry.id === qrCodeId) {
        entry.assignment = { target_type: "inventory.container", target_id: containerId };
        return;
      }
    }
  }, []);

  /** Same answer shape as the server lookup, for QrCameraScanner (the dialog). */
  const lookupToken = useCallback(
    async (token: string): Promise<TokenLookupResult> => {
      const r = await resolve(token);
      if (!r.ok) {
        // Cast: this tsconfig does not narrow the union on `ok` (strictNullChecks).
        return (r as Extract<ScanResolution, { ok: false }>).reason === "offline"
          ? { success: false, error: "offline" }
          : { success: true, data: null };
      }
      const { id, label, status, assignment } = (r as Extract<ScanResolution, { ok: true }>).lookup;
      return { success: true, data: { id, label, status, assignment } };
    },
    [resolve]
  );

  /** ResolvedScan for code paths that only need the lookup. */
  const resolveLookup = useCallback(
    async (text: string): Promise<ResolvedScan> => {
      const r = await resolve(text);
      if (r.ok) return { ok: true, lookup: (r as Extract<ScanResolution, { ok: true }>).lookup };
      const reason = (r as Extract<ScanResolution, { ok: false }>).reason;
      return { ok: false, reason: reason === "offline" ? "notFound" : reason };
    },
    [resolve]
  );

  return { resolve, resolveLookup, lookupToken, locationContents, bindSticker, containers };
}

export type ScanIndex = ReturnType<typeof useScanIndex>;
