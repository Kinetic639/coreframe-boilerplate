/**
 * @repo/domain — Entitlements Tests
 *
 * Tests the four pure entitlement decision functions.
 *
 * Suites:
 *   T-ENT-MODULE:   hasModuleAccess()
 *   T-ENT-FEATURE:  hasFeatureAccess()
 *   T-ENT-LIMIT:    getEffectiveLimit()
 *   T-ENT-CHECK:    checkLimitStatus()
 */

import { describe, it, expect } from "vitest";
import {
  hasModuleAccess,
  hasFeatureAccess,
  getEffectiveLimit,
  checkLimitStatus,
} from "../entitlements.js";
import {
  makeOrganizationEntitlements,
  makeEntitlementsWithModules,
  makeEntitlementsWithFeatures,
  makeEntitlementsWithLimits,
} from "@repo/testing/factories/entitlements";
import { LIMIT_KEYS } from "@repo/contracts/entitlements";

// ---------------------------------------------------------------------------
// T-ENT-MODULE: hasModuleAccess()
// ---------------------------------------------------------------------------

describe("T-ENT-MODULE: hasModuleAccess()", () => {
  it("returns true when module is in enabled_modules", () => {
    const ents = makeEntitlementsWithModules("warehouse", "analytics");
    expect(hasModuleAccess(ents, "warehouse")).toBe(true);
    expect(hasModuleAccess(ents, "analytics")).toBe(true);
  });

  it("returns false when module is not in enabled_modules", () => {
    const ents = makeEntitlementsWithModules("warehouse");
    expect(hasModuleAccess(ents, "analytics")).toBe(false);
  });

  it("returns false when enabled_modules is empty", () => {
    const ents = makeOrganizationEntitlements({ enabled_modules: [] });
    expect(hasModuleAccess(ents, "warehouse")).toBe(false);
  });

  it("returns false when entitlements is null", () => {
    expect(hasModuleAccess(null, "warehouse")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-ENT-FEATURE: hasFeatureAccess()
// ---------------------------------------------------------------------------

describe("T-ENT-FEATURE: hasFeatureAccess()", () => {
  it("returns true when feature is true", () => {
    const ents = makeEntitlementsWithFeatures({ basic_support: true, advanced_reporting: true });
    expect(hasFeatureAccess(ents, "basic_support")).toBe(true);
    expect(hasFeatureAccess(ents, "advanced_reporting")).toBe(true);
  });

  it("returns false when feature is false", () => {
    const ents = makeEntitlementsWithFeatures({ basic_support: false });
    expect(hasFeatureAccess(ents, "basic_support")).toBe(false);
  });

  it("returns false when feature key is absent", () => {
    const ents = makeOrganizationEntitlements({ features: {} });
    expect(hasFeatureAccess(ents, "basic_support")).toBe(false);
  });

  it("returns false when entitlements is null", () => {
    expect(hasFeatureAccess(null, "basic_support")).toBe(false);
  });

  it("returns false when feature value is a number (not boolean true)", () => {
    const ents = makeEntitlementsWithFeatures({ seats: 5 as unknown as boolean });
    expect(hasFeatureAccess(ents, "seats")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-ENT-LIMIT: getEffectiveLimit()
// ---------------------------------------------------------------------------

describe("T-ENT-LIMIT: getEffectiveLimit()", () => {
  it("returns the limit value for a known key", () => {
    const ents = makeEntitlementsWithLimits({
      [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: 100,
    });
    expect(getEffectiveLimit(ents, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(100);
  });

  it("returns -1 for unlimited", () => {
    const ents = makeEntitlementsWithLimits({
      [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: -1,
    });
    expect(getEffectiveLimit(ents, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(-1);
  });

  it("returns 0 when key is absent", () => {
    const ents = makeOrganizationEntitlements({ limits: {} });
    expect(getEffectiveLimit(ents, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(0);
  });

  it("returns 0 when entitlements is null", () => {
    expect(getEffectiveLimit(null, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T-ENT-CHECK: checkLimitStatus()
// ---------------------------------------------------------------------------

describe("T-ENT-CHECK: checkLimitStatus()", () => {
  it("returns canProceed=true and current=0 for unlimited (-1)", () => {
    const result = checkLimitStatus(-1, 0);
    expect(result.limit).toBe(-1);
    expect(result.current).toBe(0);
    expect(result.canProceed).toBe(true);
    expect(result.percentageUsed).toBeUndefined();
  });

  it("returns canProceed=true when current < limit", () => {
    const result = checkLimitStatus(10, 5);
    expect(result.canProceed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.percentageUsed).toBe(50);
  });

  it("returns canProceed=false when current >= limit (at limit)", () => {
    const result = checkLimitStatus(10, 10);
    expect(result.canProceed).toBe(false);
    expect(result.percentageUsed).toBe(100);
  });

  it("returns canProceed=false when current > limit (over limit)", () => {
    const result = checkLimitStatus(10, 15);
    expect(result.canProceed).toBe(false);
    expect(result.percentageUsed).toBe(150);
  });

  it("percentageUsed rounds to nearest integer", () => {
    const result = checkLimitStatus(3, 1);
    // 1/3 ≈ 33.33... → rounds to 33
    expect(result.percentageUsed).toBe(33);
  });

  it("percentageUsed is 0 when limit is 0", () => {
    const result = checkLimitStatus(0, 0);
    expect(result.percentageUsed).toBe(0);
    expect(result.canProceed).toBe(false);
  });
});
