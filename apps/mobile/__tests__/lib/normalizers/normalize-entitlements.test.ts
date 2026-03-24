import { describe, it, expect } from "vitest";
import { normalizeEntitlements } from "@/lib/normalizers/normalize-entitlements";

describe("normalizeEntitlements", () => {
  // ── 1. Well-formed row ───────────────────────────────────────────────────
  it("maps a fully-populated row to the contract shape", () => {
    // Live DB column is "contexts" (not "enabled_contexts") — normalizer maps it
    // to the contract field enabled_contexts.
    const row = {
      organization_id: "org-1",
      plan_id: "plan-pro",
      plan_name: "Pro",
      enabled_modules: ["warehouse", "teams"],
      contexts: ["web", "mobile"],
      features: { advanced_reports: true, max_users: 50, tier: "pro" },
      limits: { api_calls: 10000, storage_gb: 100 },
      updated_at: "2026-01-01T00:00:00Z",
    };

    const result = normalizeEntitlements(row);

    expect(result).toEqual({
      organization_id: "org-1",
      plan_id: "plan-pro",
      plan_name: "Pro",
      enabled_modules: ["warehouse", "teams"],
      enabled_contexts: ["web", "mobile"],
      features: { advanced_reports: true, max_users: 50, tier: "pro" },
      limits: { api_calls: 10000, storage_gb: 100 },
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  // ── 2. Missing scalar fields default to safe empty values ───────────────
  it("defaults organization_id to empty string when missing", () => {
    const result = normalizeEntitlements({});
    expect(result.organization_id).toBe("");
  });

  it("defaults plan_name to empty string when missing", () => {
    const result = normalizeEntitlements({});
    expect(result.plan_name).toBe("");
  });

  it("defaults updated_at to empty string when missing", () => {
    const result = normalizeEntitlements({});
    expect(result.updated_at).toBe("");
  });

  // ── 3. plan_id type mismatch → null ─────────────────────────────────────
  it("returns null for plan_id when value is a number instead of string", () => {
    const result = normalizeEntitlements({ plan_id: 42 });
    expect(result.plan_id).toBeNull();
  });

  it("returns null for plan_id when value is missing", () => {
    const result = normalizeEntitlements({});
    expect(result.plan_id).toBeNull();
  });

  // ── 4. enabled_modules not array → [] ───────────────────────────────────
  it("returns [] for enabled_modules when value is not an array", () => {
    expect(normalizeEntitlements({ enabled_modules: "warehouse" }).enabled_modules).toEqual([]);
    expect(normalizeEntitlements({ enabled_modules: null }).enabled_modules).toEqual([]);
    expect(normalizeEntitlements({ enabled_modules: 42 }).enabled_modules).toEqual([]);
  });

  // ── 5. Mixed-type arrays — only strings pass through ────────────────────
  it("filters non-string entries from enabled_modules", () => {
    const result = normalizeEntitlements({
      enabled_modules: ["warehouse", 42, null, true, "teams"],
    });
    expect(result.enabled_modules).toEqual(["warehouse", "teams"]);
  });

  // ── 6. null features → {} ────────────────────────────────────────────────
  it("returns {} for features when value is null", () => {
    const result = normalizeEntitlements({ features: null });
    expect(result.features).toEqual({});
  });

  // ── 7. Nested object in features is dropped ──────────────────────────────
  it("drops nested object values from features", () => {
    const result = normalizeEntitlements({
      features: { valid: true, nested: { deep: 1 }, also_valid: "yes" },
    });
    expect(result.features).toEqual({ valid: true, also_valid: "yes" });
  });

  // ── 8. null feature values are dropped ──────────────────────────────────
  it("drops null values from features map", () => {
    const result = normalizeEntitlements({ features: { a: null, b: true } });
    expect(result.features).toEqual({ b: true });
  });

  // ── 9. Boolean, number, and string feature values are all kept ───────────
  it("retains boolean, number, and string feature values", () => {
    const result = normalizeEntitlements({
      features: { flag: true, count: 99, label: "premium" },
    });
    expect(result.features).toEqual({ flag: true, count: 99, label: "premium" });
  });

  // ── 10. NaN limit is dropped ─────────────────────────────────────────────
  it("drops NaN values from limits map", () => {
    const result = normalizeEntitlements({ limits: { bad: NaN, good: 100 } });
    expect(result.limits).toEqual({ good: 100 });
  });

  // ── 11. Infinity limit is dropped ────────────────────────────────────────
  it("drops Infinity values from limits map", () => {
    const result = normalizeEntitlements({ limits: { inf: Infinity, ok: 50 } });
    expect(result.limits).toEqual({ ok: 50 });
  });

  // ── 12. Negative finite limit is valid ───────────────────────────────────
  it("retains negative finite numbers in limits map", () => {
    const result = normalizeEntitlements({ limits: { overdraft: -1 } });
    expect(result.limits).toEqual({ overdraft: -1 });
  });

  // ── 13. Completely empty row ──────────────────────────────────────────────
  it("returns fully-defaulted shape for a completely empty row", () => {
    const result = normalizeEntitlements({});
    expect(result).toEqual({
      organization_id: "",
      plan_id: null,
      plan_name: "",
      enabled_modules: [],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "",
    });
  });

  // ── 14. Array as limits → {} ─────────────────────────────────────────────
  it("returns {} for limits when value is an array", () => {
    const result = normalizeEntitlements({ limits: [1, 2, 3] });
    expect(result.limits).toEqual({});
  });

  // ── 15. String values in limits are dropped ──────────────────────────────
  it("drops non-numeric values from limits map", () => {
    const result = normalizeEntitlements({ limits: { a: "many", b: 5 } });
    expect(result.limits).toEqual({ b: 5 });
  });
});
