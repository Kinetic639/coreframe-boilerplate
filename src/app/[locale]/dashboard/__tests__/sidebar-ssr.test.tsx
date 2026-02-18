import { describe, it, expect, afterEach } from "vitest";
import { buildSidebarModelUncached } from "@/server/sidebar/build-sidebar-model";
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
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_APP_CONTEXT = {
  activeOrgId: "org-123",
  activeBranchId: null,
  activeOrg: null,
  activeBranch: null,
  availableBranches: [],
  userModules: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar SSR Integration", () => {
  afterEach(() => {
    // Prevent regex cache pollution between tests
    clearPermissionRegexCache();
  });

  // 7.1 — SSR renders expected items
  it("should render sidebar model with expected items", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["org.read", "members.read"], deny: [] },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "warehouse", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    expect(model.main.length).toBeGreaterThan(0);
    expect(model.main.find((item) => item.id === "home")).toBeDefined();
  });

  // 7.2 — org_owner sees billing; org_member does not
  it("should show more items for org_owner than org_member", () => {
    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "warehouse", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const ownerContext = {
      user: {
        id: "user-owner",
        email: "owner@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["org.read", "org.update", "members.read", "members.manage"],
        deny: [],
      },
    };

    const memberContext = {
      user: {
        id: "user-member",
        email: "member@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["org.read", "members.read"],
        deny: [],
      },
    };

    const ownerModel = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      ownerContext,
      entitlements,
      "en"
    );
    const memberModel = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      memberContext,
      entitlements,
      "en"
    );

    const ownerBilling = findItemById(ownerModel, "organization.billing");
    const memberBilling = findItemById(memberModel, "organization.billing");

    expect(ownerBilling).toBeDefined(); // Owner sees billing
    expect(memberBilling).toBeUndefined(); // Member does NOT see billing
  });

  // 7.3a — free plan hides analytics
  it("should hide analytics module for free plan", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["org.read"], deny: [] },
    };

    const freeEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "warehouse", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, freeEntitlements, "en");

    const analyticsItem = findItemById(model, "analytics");
    expect(analyticsItem).toBeUndefined(); // Hidden on free plan
  });

  // 7.3b — professional plan shows analytics
  it("should show analytics module for professional plan", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: ["org.read"], deny: [] },
    };

    const proEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-pro",
      plan_name: "professional",
      enabled_modules: ["home", "warehouse", "organization-management", "analytics"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, proEntitlements, "en");

    const analyticsItem = findItemById(model, "analytics");
    expect(analyticsItem).toBeDefined(); // Shown on professional plan
  });

  // 7.4 — wildcard permission matching
  it("should grant access when wildcard permission matches", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["account.*"], // Wildcard
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "warehouse", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    // account.profile requires "account.profile.read"; "account.*" should match it
    const profileItem = findItemById(model, "account.profile");
    expect(profileItem).toBeDefined(); // Shown (account.* matches account.profile.read)
  });
});
