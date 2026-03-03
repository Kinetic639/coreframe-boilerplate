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
  accessibleBranches: [],
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
        avatar_signed_url: null,
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
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: [
          "module.organization-management.access",
          "org.read",
          "org.update",
          "members.read",
          "members.manage",
        ],
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
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["module.organization-management.access", "org.read", "members.read"],
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
        avatar_signed_url: null,
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
        avatar_signed_url: null,
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

  // 7.4a — account.profile visible when user has ACCOUNT_PROFILE_READ
  it("should show account.profile item when user has account.profile.read", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["account.profile.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const profileItem = findItemById(model, "account.profile");
    expect(profileItem).toBeDefined(); // Shown: user has account.profile.read
  });

  // 7.4b — account.profile hidden when user lacks ACCOUNT_PROFILE_READ
  it("should hide account.profile item when user lacks account.profile.read", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["org.read"], // Has other permissions but NOT account.profile.read
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const profileItem = findItemById(model, "account.profile");
    expect(profileItem).toBeUndefined(); // Hidden: no account.profile.read
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
        avatar_signed_url: null,
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

  // ── Organization Management Module ─────────────────────────────────────────

  // org-1: group absent when module not entitled
  it("should hide organization group when organization-management is NOT in enabled_modules", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["org.read", "org.update", "members.read", "members.manage", "branches.read"],
        deny: [],
      },
    };

    const noOrgMgmtEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "warehouse"], // organization-management NOT present
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      noOrgMgmtEntitlements,
      "en"
    );

    const orgGroup = findItemById(model, "organization");
    expect(orgGroup).toBeUndefined(); // Hidden: module not entitled
  });

  // org-2: organization.profile absent when ORG_READ missing
  it("should hide organization.profile when user lacks org.read permission", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["members.read"], // Has members.read but NOT org.read
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const profileItem = findItemById(model, "organization.profile");
    expect(profileItem).toBeUndefined(); // Hidden: no org.read
  });

  // org-3: organization.profile visible when ORG_READ present
  it("should show organization.profile when user has org.read permission", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["module.organization-management.access", "org.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const profileItem = findItemById(model, "organization.profile");
    expect(profileItem).toBeDefined(); // Shown: has org.read
  });

  // org-4: organization.branches absent when BRANCHES_READ missing
  it("should hide organization.branches when user lacks branches.read permission", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["org.read", "members.read"], // No branches.read
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const branchesItem = findItemById(model, "organization.branches");
    expect(branchesItem).toBeUndefined(); // Hidden: no branches.read
  });

  // org-5: organization.branches visible when BRANCHES_READ present
  it("should show organization.branches when user has branches.read permission", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["module.organization-management.access", "org.read", "branches.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const branchesItem = findItemById(model, "organization.branches");
    expect(branchesItem).toBeDefined(); // Shown: has branches.read
  });

  // org-6: branch-access visible when user has BRANCH_ROLES_MANAGE but NOT MEMBERS_READ (G2)
  it("should show organization.branch-access when user has branch.roles.manage but not members.read", () => {
    const userContext = {
      user: {
        id: "user-123",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: {
        allow: ["module.organization-management.access", "branch.roles.manage"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      plan_name: "free",
      enabled_modules: ["home", "organization-management"],
      enabled_contexts: [],
      features: {},
      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    // branch-access uses requiresAnyPermissions: [MEMBERS_READ, BRANCH_ROLES_MANAGE] (OR logic)
    const branchAccessItem = findItemById(model, "organization.branch-access");
    expect(branchAccessItem).toBeDefined(); // Shown: branch.roles.manage satisfies OR gate

    // organization.users requires MEMBERS_READ (AND logic) — must NOT be visible
    const usersItem = findItemById(model, "organization.users");
    expect(usersItem).toBeUndefined(); // Hidden: no members.read
  });
});
