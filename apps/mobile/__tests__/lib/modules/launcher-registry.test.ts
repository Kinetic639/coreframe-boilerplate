import { describe, it, expect } from "vitest";

import { getVisibleModules } from "@/lib/modules/launcher-registry";
import type { AccessContext } from "@/lib/modules/launcher-registry";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@repo/contracts/modules";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_ENTITLEMENTS = {
  organization_id: "org-1",
  plan_id: "plan-pro",
  enabled_modules: [MODULE_ORGANIZATION_MANAGEMENT, "warehouse", "teams"],
  contexts: [],
  limits: {},
  updated_at: "2026-01-01T00:00:00Z",
};

const FULL_PERMISSIONS = {
  allow: ["module.organization-management.access", "members.read", "tools.read"],
  deny: [],
};

const NO_ACCESS: AccessContext = {
  permissions: { allow: [], deny: [] },
  entitlements: FULL_ENTITLEMENTS,
};

const NULL_ENTITLEMENTS: AccessContext = {
  permissions: FULL_PERMISSIONS,
  entitlements: null,
};

const FULL_ACCESS: AccessContext = {
  permissions: FULL_PERMISSIONS,
  entitlements: FULL_ENTITLEMENTS,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getVisibleModules", () => {
  // ── 1. Nominal: both gates pass ───────────────────────────────────────────
  it("returns org-management when entitlement present and permission present", () => {
    const modules = getVisibleModules(FULL_ACCESS);
    expect(modules.length).toBe(1);
    expect(modules[0]!.slug).toBe(MODULE_ORGANIZATION_MANAGEMENT);
  });

  // ── 2. Fail-closed: null entitlements ────────────────────────────────────
  it("returns empty when entitlements is null (fail-closed)", () => {
    const modules = getVisibleModules(NULL_ENTITLEMENTS);
    expect(modules).toHaveLength(0);
  });

  // ── 3. Fail on missing permission ────────────────────────────────────────
  it("returns empty when module.organization-management.access permission is missing", () => {
    const modules = getVisibleModules(NO_ACCESS);
    expect(modules).toHaveLength(0);
  });

  // ── 4. Fail when module not in enabled_modules ───────────────────────────
  it("returns empty when org-management is not in enabled_modules", () => {
    const ctx: AccessContext = {
      permissions: FULL_PERMISSIONS,
      entitlements: { ...FULL_ENTITLEMENTS, enabled_modules: ["warehouse"] },
    };
    const modules = getVisibleModules(ctx);
    expect(modules).toHaveLength(0);
  });

  // ── 5. `implemented: false` exclusion ────────────────────────────────────
  it("excludes a module when implemented is false even if access would pass", () => {
    // Verify via the route: if we had a module with implemented=false it would
    // not appear. We can test this indirectly by checking only implemented modules
    // are returned, and that the registry contract holds for future entries.
    // All currently returned modules must have implemented === true.
    const modules = getVisibleModules(FULL_ACCESS);
    modules.forEach((m) => {
      expect(m.implemented).toBe(true);
    });
  });

  // ── 6. `showInLauncher: false` exclusion ─────────────────────────────────
  it("only returns modules with showInLauncher true", () => {
    const modules = getVisibleModules(FULL_ACCESS);
    modules.forEach((m) => {
      expect(m.showInLauncher).toBe(true);
    });
  });
});
