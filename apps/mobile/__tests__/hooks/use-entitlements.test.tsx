import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

import { useEntitlements } from "@/hooks/use-entitlements";
import { LIMIT_KEYS } from "@repo/contracts/entitlements";
import type { OrganizationEntitlements } from "@repo/contracts/entitlements";
import type { AppState, AppBootstrapState } from "@/contexts/app-context";

import { useAppContext } from "@/contexts/app-context";

// ─── Mock AppContext ──────────────────────────────────────────────────────────

function makeContextValue(entitlements: OrganizationEntitlements | null) {
  const appState: AppState = {
    userId: "u1",
    email: "test@example.com",
    roles: [],
    activeOrgId: "org-1",
    orgRoles: [],
    activeBranchId: null,
    branchRoles: [],
    branchPermissions: null,
    permissions: { allow: [], deny: [] },
    entitlements,
    orgName: null,
    orgName2: null,
  };
  return {
    bootstrapState: "resolved" as AppBootstrapState,
    appState,
    retryBootstrap: () => {},
  };
}

vi.mock("@/contexts/app-context", () => ({
  useAppContext: vi.fn(() => makeContextValue(null)),
}));
const mockUseAppContext = vi.mocked(useAppContext);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ENTITLEMENTS_WITH_WAREHOUSE: OrganizationEntitlements = {
  organization_id: "org-1",
  plan_id: "plan-pro",
  enabled_modules: ["warehouse", "tools"],
  contexts: ["mobile"],
  limits: {
    [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: 500,
    [LIMIT_KEYS.ORGANIZATION_MAX_USERS]: -1,
  },
  updated_at: "2026-01-01T00:00:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useEntitlements", () => {
  // ── 1. Returns null entitlements when context has none (free tier) ────────
  it("returns null entitlements when AppContext has no entitlements", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(null));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.entitlements).toBeNull();
  });

  // ── 2. hasModuleAccess returns false when entitlements are null ───────────
  it("hasModuleAccess returns false when entitlements are null", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(null));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.hasModuleAccess("warehouse")).toBe(false);
  });

  // ── 3. hasModuleAccess returns true for an enabled module ─────────────────
  it("hasModuleAccess returns true for a module in enabled_modules", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.hasModuleAccess("warehouse")).toBe(true);
  });

  // ── 4. hasModuleAccess returns false for a module not in enabled_modules ──
  it("hasModuleAccess returns false for a module not in enabled_modules", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.hasModuleAccess("analytics")).toBe(false);
  });

  // ── 5. getEffectiveLimit returns 0 when entitlements are null ─────────────
  it("getEffectiveLimit returns 0 when entitlements are null", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(null));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.getEffectiveLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(0);
  });

  // ── 6. getEffectiveLimit returns the numeric limit ─────────────────────────
  it("getEffectiveLimit returns the correct limit value", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.getEffectiveLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS)).toBe(500);
  });

  // ── 7. getEffectiveLimit returns -1 for unlimited ─────────────────────────
  it("getEffectiveLimit returns -1 for an unlimited limit", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.getEffectiveLimit(LIMIT_KEYS.ORGANIZATION_MAX_USERS)).toBe(-1);
  });

  // ── 8. Returns the raw entitlements snapshot ──────────────────────────────
  it("exposes the raw entitlements object from context", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.entitlements).toBe(ENTITLEMENTS_WITH_WAREHOUSE);
  });

  // ── 9. No network calls — hook is synchronous ─────────────────────────────
  it("does not trigger any async operations (sync result on first render)", () => {
    mockUseAppContext.mockReturnValue(makeContextValue(ENTITLEMENTS_WITH_WAREHOUSE));

    // If this throws or returns a Promise, the test will fail.
    const { result } = renderHook(() => useEntitlements());

    // Result is immediately available — no loading state
    expect(result.current.entitlements).not.toBeUndefined();
    expect(typeof result.current.hasModuleAccess).toBe("function");
    expect(typeof result.current.getEffectiveLimit).toBe("function");
  });
});
