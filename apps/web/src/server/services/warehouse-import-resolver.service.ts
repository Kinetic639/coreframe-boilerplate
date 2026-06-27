import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeImportToken, skuCollisionFingerprint } from "@/lib/warehouse/import-utils";
import type { ServiceResult } from "./inventory-products.service";

export type ImportResolution<T> =
  | { status: "resolved"; value: T; matches: T[] }
  | { status: "missing"; value: null; matches: [] }
  | { status: "ambiguous"; value: null; matches: T[] };

export type VariantImportCandidate = {
  id: string;
  sku: string | null;
  barcode: string | null;
};

export type UnitImportCandidate = {
  id: string;
  code: string | null;
  name: string | null;
};

export type WarehouseImportResolverContext = {
  variantsByExactToken: Map<string, VariantImportCandidate[]>;
  variantsByFingerprint: Map<string, VariantImportCandidate[]>;
  unitsByExactToken: Map<string, UnitImportCandidate[]>;
  unitsByFingerprint: Map<string, UnitImportCandidate[]>;
};

function pushCandidate<T>(map: Map<string, T[]>, key: string, candidate: T) {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), candidate]);
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function resolutionFromMatches<T extends { id: string }>(matches: T[]): ImportResolution<T> {
  const uniqueMatches = uniqueById(matches);
  if (uniqueMatches.length === 1) {
    return { status: "resolved", value: uniqueMatches[0], matches: uniqueMatches };
  }
  if (uniqueMatches.length > 1) {
    return { status: "ambiguous", value: null, matches: uniqueMatches };
  }
  return { status: "missing", value: null, matches: [] };
}

export class WarehouseImportResolverService {
  static async buildContext(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<WarehouseImportResolverContext>> {
    const [variantsRes, unitsRes] = await Promise.all([
      (supabase as any)
        .from("inventory_variants")
        .select("id, sku, barcode")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .is("deleted_at", null),
      (supabase as any)
        .from("inventory_units")
        .select("id, code, name")
        .eq("organization_id", orgId)
        .is("deleted_at", null),
    ]);

    if (variantsRes.error) return { success: false, error: variantsRes.error.message };
    if (unitsRes.error) return { success: false, error: unitsRes.error.message };

    const context: WarehouseImportResolverContext = {
      variantsByExactToken: new Map(),
      variantsByFingerprint: new Map(),
      unitsByExactToken: new Map(),
      unitsByFingerprint: new Map(),
    };

    for (const row of (variantsRes.data ?? []) as VariantImportCandidate[]) {
      for (const raw of [row.sku, row.barcode]) {
        pushCandidate(context.variantsByExactToken, normalizeImportToken(raw), row);
        pushCandidate(context.variantsByFingerprint, skuCollisionFingerprint(raw), row);
      }
    }

    for (const row of (unitsRes.data ?? []) as UnitImportCandidate[]) {
      for (const raw of [row.code, row.name]) {
        pushCandidate(context.unitsByExactToken, normalizeImportToken(raw), row);
        pushCandidate(context.unitsByFingerprint, skuCollisionFingerprint(raw), row);
      }
    }

    return { success: true, data: context };
  }

  static resolveVariant(
    context: WarehouseImportResolverContext,
    rawValue: string | null | undefined
  ): ImportResolution<VariantImportCandidate> {
    const exact = normalizeImportToken(rawValue);
    if (!exact) return { status: "missing", value: null, matches: [] };
    const exactResolution = resolutionFromMatches(context.variantsByExactToken.get(exact) ?? []);
    if (exactResolution.status !== "missing") return exactResolution;

    const fingerprint = skuCollisionFingerprint(rawValue);
    if (!fingerprint) return exactResolution;
    return resolutionFromMatches(context.variantsByFingerprint.get(fingerprint) ?? []);
  }

  static resolveUnit(
    context: WarehouseImportResolverContext,
    rawValue: string | null | undefined
  ): ImportResolution<UnitImportCandidate> {
    const exact = normalizeImportToken(rawValue);
    if (!exact) return { status: "missing", value: null, matches: [] };
    const exactResolution = resolutionFromMatches(context.unitsByExactToken.get(exact) ?? []);
    if (exactResolution.status !== "missing") return exactResolution;

    const fingerprint = skuCollisionFingerprint(rawValue);
    if (!fingerprint) return exactResolution;
    return resolutionFromMatches(context.unitsByFingerprint.get(fingerprint) ?? []);
  }
}
