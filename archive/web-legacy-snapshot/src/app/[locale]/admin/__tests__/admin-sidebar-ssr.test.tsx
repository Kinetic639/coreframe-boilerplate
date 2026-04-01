import { describe, it, expect, afterEach } from "vitest";
import { buildAdminSidebarModelUncached } from "@/server/sidebar/build-admin-sidebar-model";
import { clearPermissionRegexCache } from "@/lib/utils/permissions";
import type { SidebarItem, SidebarModel } from "@/lib/types/v2/sidebar";

// ---------------------------------------------------------------------------
// Helper: recursive item search across main + footer
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Admin Sidebar SSR Integration", () => {
  afterEach(() => {
    // Prevent regex cache pollution between tests
    clearPermissionRegexCache();
  });

  // A.1 — Non-admin sees no items (empty snapshot)
  it("should return empty model for user with no admin permissions", () => {
    const model = buildAdminSidebarModelUncached({ allow: [], deny: [] }, "en");

    expect(model.main).toHaveLength(0);
    expect(model.footer).toHaveLength(0);
  });

  // A.2 — Superadmin wildcard grants access to all admin items
  it("should show all admin items for user with superadmin wildcard", () => {
    const model = buildAdminSidebarModelUncached({ allow: ["superadmin.*"], deny: [] }, "en");

    expect(findItemById(model, "admin.home")).toBeDefined();
    expect(findItemById(model, "admin.plans")).toBeDefined();
    expect(findItemById(model, "admin.pricing")).toBeDefined();
  });

  // A.3 — Granular permissions gate individual items
  it("should show only plans item when user has superadmin.plans.read only", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: ["superadmin.plans.read"], deny: [] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeUndefined(); // requires superadmin.admin.read
    expect(findItemById(model, "admin.plans")).toBeDefined(); // has superadmin.plans.read
    expect(findItemById(model, "admin.pricing")).toBeUndefined(); // requires superadmin.pricing.read
  });

  // A.4 — Deny overrides wildcard (deny-first semantics)
  it("should hide plans item when superadmin.plans.read is explicitly denied", () => {
    const model = buildAdminSidebarModelUncached(
      { allow: ["superadmin.*"], deny: ["superadmin.plans.read"] },
      "en"
    );

    expect(findItemById(model, "admin.home")).toBeDefined(); // allowed by superadmin.*
    expect(findItemById(model, "admin.plans")).toBeUndefined(); // denied explicitly
    expect(findItemById(model, "admin.pricing")).toBeDefined(); // allowed by superadmin.*
  });

  // A.5 — Model is deterministic (same inputs → identical output)
  it("should produce identical models for identical inputs", () => {
    const snapshot = { allow: ["superadmin.*"], deny: [] };
    const model1 = buildAdminSidebarModelUncached(snapshot, "en");
    const model2 = buildAdminSidebarModelUncached(snapshot, "en");

    expect(model1).toEqual(model2);
  });
});
