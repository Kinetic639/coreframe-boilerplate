import type { OrganizationEntitlements } from "@repo/contracts/entitlements";

/**
 * Safely maps a raw `organization_entitlements` DB row to the shared
 * OrganizationEntitlements contract shape.
 *
 * This function exists because PostgREST returns JSONB columns (limits)
 * as Record<string, unknown> at runtime — there is no generated Supabase
 * type database for apps/mobile. Each field is validated and defaulted
 * independently. There is no blind cast.
 *
 * Unexpected types are handled conservatively:
 * - Scalar fields (strings, nulls) default to safe empty values.
 * - Array fields default to [].
 * - JSONB map fields drop entries whose values are not of the declared type.
 *   No coercion is performed; unknown values are silently omitted.
 */
export function normalizeEntitlements(row: Record<string, unknown>): OrganizationEntitlements {
  return {
    organization_id: typeof row.organization_id === "string" ? row.organization_id : "",
    plan_id: typeof row.plan_id === "string" ? row.plan_id : null,
    enabled_modules: normalizeStringArray(row.enabled_modules),
    contexts: normalizeStringArray(row.contexts),
    limits: normalizeLimitMap(row.limits),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string");
}

/**
 * Extracts numeric limits from a JSONB object.
 * Only finite numbers are kept. NaN and Infinity are dropped (not valid limits).
 */
function normalizeLimitMap(val: unknown): Record<string, number> {
  if (typeof val !== "object" || val === null || Array.isArray(val)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return out;
}
