/**
 * Admin Sidebar Model Builder tests (expanded)
 *
 * Tests pure computation: permission filtering, wildcard matching,
 * deny-first semantics, locale passthrough, and security edge cases.
 *
 * Uses `buildAdminSidebarModelUncached` (not `buildAdminSidebarModel`)
 * to avoid React.cache() memoization artifacts.
 */
import { describe, it, expect, afterEach } from "vitest";
import { buildAdminSidebarModelUncached } from "../build-admin-sidebar-model";
import { clearPermissionRegexCache } from "@/lib/utils/permissions";
import {
  SUPERADMIN_ADMIN_READ,
  SUPERADMIN_PLANS_READ,
  SUPERADMIN_PRICING_READ,
  SUPERADMIN_WILDCARD,
} from "@/lib/constants/permissions";
import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function searchItems(items: SidebarItem[], id: string): SidebarItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = searchItems(item.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function findItemById(model: SidebarModel, id: string): SidebarItem | undefined {
  return searchItems([...model.main, ...model.footer], id);
}

const ALL_ITEM_IDS = ["admin.home", "admin.plans", "admin.pricing"];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
afterEach(() => {
  clearPermissionRegexCache();
});

// -------------------------------------------------------------------------
// Security: access denied cases
// -------------------------------------------------------------------------
describe("Access denied (security gate)", () => {
  it("should return empty model for user with no permissions (empty allow)", () => {
    const model = buildAdminSidebarModelUncached({ allow: [], deny: [] }, "en");

    expect(model.main).toHaveLength(0);
    expect(model.footer).toHaveLength(0);
  });

  it("should return empty model for user with unrelated org permissions", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: ["warehouse.*", "teams.*", "org.*"], deny: [] },
      "en"
    );

    expect(model.main).toHaveLength(0);
  });

  it("should return empty model when only deny list is populated", () => {
    const model = buildAdminSidebarModelUncached({ allow: [], deny: ["superadmin.*"] }, "en");

    expect(model.main).toHaveLength(0);
  });

  it("should not expose admin items when enabled=false (empty permission snapshot)", () => {
    // Simulates what loadAdminContextV2 returns for enabled=false
    const model = buildAdminSidebarModelUncached({ allow: [], deny: [] }, "en");

    ALL_ITEM_IDS.forEach((id) => {
      expect(findItemById(model, id)).toBeUndefined();
    });
  });
});

// -------------------------------------------------------------------------
// Security: access granted cases
// -------------------------------------------------------------------------
describe("Access granted", () => {
  it("should show all admin items for user with superadmin wildcard", () => {
    const model = buildAdminSidebarModelUncached({ allow: [SUPERADMIN_WILDCARD], deny: [] }, "en");

    ALL_ITEM_IDS.forEach((id) => {
      expect(findItemById(model, id)).toBeDefined();
    });
  });

  it("should show all admin items when using literal superadmin.* string", () => {
    const model = buildAdminSidebarModelUncached({ allow: ["superadmin.*"], deny: [] }, "en");

    expect(findItemById(model, "admin.home")).toBeDefined();
    expect(findItemById(model, "admin.plans")).toBeDefined();
    expect(findItemById(model, "admin.pricing")).toBeDefined();
  });

  it("should show only admin.home when user has only SUPERADMIN_ADMIN_READ", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: [SUPERADMIN_ADMIN_READ], deny: [] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeDefined();
    expect(findItemById(model, "admin.plans")).toBeUndefined();
    expect(findItemById(model, "admin.pricing")).toBeUndefined();
  });

  it("should show only admin.plans when user has only SUPERADMIN_PLANS_READ", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: [SUPERADMIN_PLANS_READ], deny: [] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeUndefined();
    expect(findItemById(model, "admin.plans")).toBeDefined();
    expect(findItemById(model, "admin.pricing")).toBeUndefined();
  });

  it("should show only admin.pricing when user has only SUPERADMIN_PRICING_READ", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: [SUPERADMIN_PRICING_READ], deny: [] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeUndefined();
    expect(findItemById(model, "admin.plans")).toBeUndefined();
    expect(findItemById(model, "admin.pricing")).toBeDefined();
  });

  it("should show correct count when user has granular admin + plans permissions", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: [SUPERADMIN_ADMIN_READ, SUPERADMIN_PLANS_READ], deny: [] },
      "en"
    );

    expect(model.main).toHaveLength(2);
    expect(findItemById(model, "admin.home")).toBeDefined();
    expect(findItemById(model, "admin.plans")).toBeDefined();
    expect(findItemById(model, "admin.pricing")).toBeUndefined();
  });
});

// -------------------------------------------------------------------------
// Deny-first semantics
// -------------------------------------------------------------------------
describe("Deny-first semantics", () => {
  it("should hide item when explicitly denied even with wildcard allow", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: ["superadmin.*"], deny: ["superadmin.plans.read"] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeDefined();
    expect(findItemById(model, "admin.plans")).toBeUndefined(); // denied
    expect(findItemById(model, "admin.pricing")).toBeDefined();
  });

  it("should hide all items when entire superadmin namespace is denied", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: ["superadmin.*"], deny: ["superadmin.*"] },
      "en"
    );

    expect(model.main).toHaveLength(0);
  });

  it("should deny all three items when each is individually denied", () => {
    const model = buildAdminSidebarModelUncached(
      {
        allow: ["superadmin.*"],
        deny: [SUPERADMIN_ADMIN_READ, SUPERADMIN_PLANS_READ, SUPERADMIN_PRICING_READ],
      },
      "en"
    );

    expect(model.main).toHaveLength(0);
  });

  it("deny takes precedence over exact allow for same permission", () => {
    const model = buildAdminSidebarModelUncached(
      {
        allow: [SUPERADMIN_ADMIN_READ],
        deny: [SUPERADMIN_ADMIN_READ],
      },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeUndefined();
  });
});

// -------------------------------------------------------------------------
// Locale handling
// -------------------------------------------------------------------------
describe("Locale handling", () => {
  it("should produce structurally identical models for 'en' and 'pl' locales", () => {
    const snapshot = { allow: ["superadmin.*"], deny: [] };
    const enModel = buildAdminSidebarModelUncached(snapshot, "en");
    const plModel = buildAdminSidebarModelUncached(snapshot, "pl");

    expect(enModel.main.length).toBe(plModel.main.length);
    enModel.main.forEach((item, i) => {
      expect(item.id).toBe(plModel.main[i].id);
    });
  });

  it("should not return undefined for any locale", () => {
    const snapshot = { allow: ["superadmin.*"], deny: [] };
    ["en", "pl", "de", "fr"].forEach((locale) => {
      const model = buildAdminSidebarModelUncached(snapshot, locale);
      expect(model).toBeDefined();
      expect(model.main).toBeDefined();
    });
  });
});

// -------------------------------------------------------------------------
// Determinism and correctness
// -------------------------------------------------------------------------
describe("Determinism and correctness", () => {
  it("should produce identical models for identical inputs", () => {
    const snapshot = { allow: ["superadmin.*"], deny: [] };
    const model1 = buildAdminSidebarModelUncached(snapshot, "en");
    const model2 = buildAdminSidebarModelUncached(snapshot, "en");

    expect(model1).toEqual(model2);
  });

  it("should return a valid SidebarModel shape (main and footer arrays)", () => {
    const model = buildAdminSidebarModelUncached({ allow: ["superadmin.*"], deny: [] }, "en");

    expect(Array.isArray(model.main)).toBe(true);
    expect(Array.isArray(model.footer)).toBe(true);
  });

  it("should return empty footer (admin sidebar has no footer nav items)", () => {
    const model = buildAdminSidebarModelUncached({ allow: ["superadmin.*"], deny: [] }, "en");
    expect(model.footer).toHaveLength(0);
  });

  it("should not mutate the input snapshot object", () => {
    const snapshot = { allow: ["superadmin.*"], deny: [] };
    const originalAllow = [...snapshot.allow];
    const originalDeny = [...snapshot.deny];

    buildAdminSidebarModelUncached(snapshot, "en");

    expect(snapshot.allow).toEqual(originalAllow);
    expect(snapshot.deny).toEqual(originalDeny);
  });

  it("should return items with correct hrefs (not transformed)", () => {
    const model = buildAdminSidebarModelUncached({ allow: ["superadmin.*"], deny: [] }, "en");

    const home = findItemById(model, "admin.home");
    const plans = findItemById(model, "admin.plans");
    const pricing = findItemById(model, "admin.pricing");

    expect(home?.href).toBe("/admin");
    expect(plans?.href).toBe("/admin/plans");
    expect(pricing?.href).toBe("/admin/pricing");
  });
});
