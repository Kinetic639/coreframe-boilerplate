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

  // 7.1 — SSR renders expected items (Tools + Organization for entitled user)
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
      permissionSnapshot: { allow: ["tools.read", "org.read", "members.read"], deny: [] },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: ["organization-management"],
      contexts: [],

      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    expect(model.main.length).toBeGreaterThan(0);
    // Tools is always present for users with tools.read (no module gate)
    expect(model.main.find((item) => item.id === "tools")).toBeDefined();
  });

  // 7.2 — org_owner sees billing; org_member does not
  it("should show more items for org_owner than org_member", () => {
    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: ["organization-management"],
      contexts: [],

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

  // 7.3a — tools item hidden when user lacks tools.read
  it("should hide tools item when user lacks tools.read permission", () => {
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

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: ["organization-management"],
      contexts: [],

      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const toolsItem = findItemById(model, "tools");
    expect(toolsItem).toBeUndefined(); // Hidden: no tools.read
  });

  // 7.3b — tools item visible when user has tools.read (no module gate)
  it("should show tools item when user has tools.read permission", () => {
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
      permissionSnapshot: { allow: ["tools.read"], deny: [] },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: [],
      contexts: [],

      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const toolsItem = findItemById(model, "tools");
    expect(toolsItem).toBeDefined(); // Shown: has tools.read (no module gate required)
  });

  // 7.4 — account.profile is never in the sidebar (accessible via NavUser dropdown only)
  it("should never show account.profile in sidebar regardless of permissions", () => {
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
        allow: ["account.*", "account.profile.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: [],
      contexts: [],

      limits: {},
      updated_at: "2026-02-13T10:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    // Account items removed from sidebar — accessible via NavUser dropdown instead
    const profileItem = findItemById(model, "account.profile");
    expect(profileItem).toBeUndefined();
    const preferencesItem = findItemById(model, "account.preferences");
    expect(preferencesItem).toBeUndefined();
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

      enabled_modules: [], // organization-management NOT present
      contexts: [],

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

      enabled_modules: ["organization-management"],
      contexts: [],

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

      enabled_modules: ["organization-management"],
      contexts: [],

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

      enabled_modules: ["organization-management"],
      contexts: [],

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

      enabled_modules: ["organization-management"],
      contexts: [],

      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    const branchesItem = findItemById(model, "organization.branches");
    expect(branchesItem).toBeDefined(); // Shown: has branches.read
  });

  // ── Warehouse Module ───────────────────────────────────────────────────────

  // wh-1: warehouse group visible when MODULE_WAREHOUSE is in enabled_modules + user has access
  it("should show warehouse group when MODULE_WAREHOUSE is entitled", () => {
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
        allow: [
          "module.warehouse.access",
          "warehouse.read",
          "warehouse.inventory.read",
          "warehouse.products.read",
          "warehouse.locations.read",
        ],
        deny: [],
      },
    };

    const entitledEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["warehouse"],
      contexts: [],
      limits: {},
      updated_at: "2026-03-29T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      entitledEntitlements,
      "en"
    );

    const warehouseGroup = findItemById(model, "warehouse");
    expect(warehouseGroup).toBeDefined(); // Shown: module entitled
    // Implemented Phase 1 inventory children are visible with exact read permissions.
    expect(findItemById(model, "warehouse.inventory")).toBeDefined();
    expect(findItemById(model, "warehouse.inventory.movements")).toBeDefined();
    expect(findItemById(model, "warehouse.items")).toBeDefined();
    expect(findItemById(model, "warehouse.locations")).toBeDefined();
    expect(findItemById(model, "warehouse.purchases")).toBeDefined();
    expect(findItemById(model, "warehouse.deliveries")).toBeDefined();
    expect(findItemById(model, "warehouse.suppliers")).toBeDefined();
    expect(findItemById(model, "warehouse.settings")).toBeDefined();
  });

  // wh-2: warehouse group absent when MODULE_WAREHOUSE is NOT in enabled_modules
  it("should hide warehouse group when MODULE_WAREHOUSE is NOT entitled", () => {
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
      permissionSnapshot: { allow: [], deny: [] },
    };

    const noWarehouseEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["organization-management"], // warehouse NOT present
      contexts: [],
      limits: {},
      updated_at: "2026-03-29T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      noWarehouseEntitlements,
      "en"
    );

    const warehouseGroup = findItemById(model, "warehouse");
    expect(warehouseGroup).toBeUndefined(); // Hidden: module not entitled
  });

  // wh-3: warehouse group absent when entitlements are null (fail-closed)
  it("should hide warehouse group when entitlements are null", () => {
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
      permissionSnapshot: { allow: ["warehouse.*"], deny: [] },
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, null, "en");

    const warehouseGroup = findItemById(model, "warehouse");
    expect(warehouseGroup).toBeUndefined(); // Hidden: fail-closed with null entitlements
  });

  // wh-4: existing modules unaffected by warehouse addition (regression guard)
  it("should still show tools when warehouse is entitled (regression guard)", () => {
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
      permissionSnapshot: { allow: ["tools.read", "module.warehouse.access"], deny: [] },
    };

    const bothEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["warehouse"],
      contexts: [],
      limits: {},
      updated_at: "2026-03-29T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, bothEntitlements, "en");

    // Warehouse visible (module entitled + user has module.warehouse.access)
    expect(findItemById(model, "warehouse")).toBeDefined();
    // Tools still visible (no regression)
    expect(findItemById(model, "tools")).toBeDefined();
  });

  // ── Analytics & Reports Module ─────────────────────────────────────────────

  // an-1: analytics group visible when module entitled + user has access + analytics.read
  it("should show analytics group when MODULE_ANALYTICS is entitled and user has access", () => {
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
        allow: [
          "module.analytics.access",
          "analytics.read",
          "analytics.activity.read",
          "analytics.audit.read",
        ],
        deny: [],
      },
    };

    const analyticsEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["analytics"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      analyticsEntitlements,
      "en"
    );

    const analyticsGroup = findItemById(model, "analytics");
    expect(analyticsGroup).toBeDefined(); // Shown: module entitled + user has access
    expect(findItemById(model, "analytics.overview")).toBeDefined();
    expect(findItemById(model, "analytics.activity")).toBeDefined();
    expect(findItemById(model, "analytics.audit")).toBeDefined();
  });

  // an-2: analytics group absent when MODULE_ANALYTICS is NOT in enabled_modules
  it("should hide analytics group when MODULE_ANALYTICS is NOT entitled", () => {
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
        allow: ["module.analytics.access", "analytics.read", "analytics.activity.read"],
        deny: [],
      },
    };

    const noAnalyticsEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["organization-management"], // analytics NOT present
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      noAnalyticsEntitlements,
      "en"
    );

    const analyticsGroup = findItemById(model, "analytics");
    expect(analyticsGroup).toBeUndefined(); // Hidden: module not entitled
  });

  // an-3: analytics group absent when MODULE_ANALYTICS_ACCESS permission missing
  it("should hide analytics group when user lacks module.analytics.access", () => {
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
        allow: ["analytics.read"], // module.analytics.access NOT present
        deny: [],
      },
    };

    const analyticsEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["analytics"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      analyticsEntitlements,
      "en"
    );

    const analyticsGroup = findItemById(model, "analytics");
    expect(analyticsGroup).toBeUndefined(); // Hidden: no module.analytics.access
  });

  // an-4: analytics.activity hidden when user lacks analytics.activity.read
  it("should hide analytics.activity when user lacks analytics.activity.read", () => {
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
        allow: ["module.analytics.access", "analytics.read"], // no analytics.activity.read
        deny: [],
      },
    };

    const analyticsEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["analytics"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      analyticsEntitlements,
      "en"
    );

    expect(findItemById(model, "analytics.activity")).toBeUndefined();
  });

  // an-5: analytics.audit hidden when user lacks analytics.audit.read
  it("should hide analytics.audit when user lacks analytics.audit.read", () => {
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
        allow: ["module.analytics.access", "analytics.read", "analytics.activity.read"],
        deny: [],
      },
    };

    const analyticsEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["analytics"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      analyticsEntitlements,
      "en"
    );

    expect(findItemById(model, "analytics.audit")).toBeUndefined();
  });

  // an-6: organization.activity and organization.audit no longer exist (moved to analytics)
  it("should never show organization.activity or organization.audit in sidebar", () => {
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
        allow: ["module.organization-management.access", "org.read", "audit.events.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["organization-management"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    // These items were moved to the analytics module — must not appear under organization
    expect(findItemById(model, "organization.activity")).toBeUndefined();
    expect(findItemById(model, "organization.audit")).toBeUndefined();
  });

  // org-6: organization.branch-access no longer exists in the sidebar registry
  it("should never show organization.branch-access (page removed)", () => {
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
        allow: ["module.organization-management.access", "branch.roles.manage", "members.read"],
        deny: [],
      },
    };

    const entitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",

      enabled_modules: ["organization-management"],
      contexts: [],

      limits: {},
      updated_at: "2026-02-26T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, entitlements, "en");

    // branch-access page removed — item must never appear regardless of permissions
    const branchAccessItem = findItemById(model, "organization.branch-access");
    expect(branchAccessItem).toBeUndefined();
  });

  // ── Workshop Module ────────────────────────────────────────────────────────

  // ws-1: workshop visible when MODULE_WORKSHOP entitled + user has module access + workshop.read
  it("should show workshop item when MODULE_WORKSHOP is entitled and user has access", () => {
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
        allow: ["module.workshop.access", "workshop.read"],
        deny: [],
      },
    };

    const workshopEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["workshop"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      workshopEntitlements,
      "en"
    );

    const workshopItem = findItemById(model, "workshop");
    expect(workshopItem).toBeDefined(); // Shown: module entitled + user has access
  });

  // ws-2: workshop hidden when MODULE_WORKSHOP is NOT in enabled_modules
  it("should hide workshop item when MODULE_WORKSHOP is NOT entitled", () => {
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
        allow: ["module.workshop.access", "workshop.read"],
        deny: [],
      },
    };

    const noWorkshopEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-free",
      enabled_modules: ["organization-management"], // workshop NOT present
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      noWorkshopEntitlements,
      "en"
    );

    const workshopItem = findItemById(model, "workshop");
    expect(workshopItem).toBeUndefined(); // Hidden: module not entitled
  });

  // ws-3: workshop hidden when user lacks module.workshop.access
  it("should hide workshop item when user lacks module.workshop.access", () => {
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
        allow: ["workshop.read"], // module.workshop.access NOT present
        deny: [],
      },
    };

    const workshopEntitlements = {
      organization_id: "org-123",
      plan_id: "plan-professional",
      enabled_modules: ["workshop"],
      contexts: [],
      limits: {},
      updated_at: "2026-05-25T00:00:00.000Z",
    };

    const model = buildSidebarModelUncached(
      BASE_APP_CONTEXT,
      userContext,
      workshopEntitlements,
      "en"
    );

    const workshopItem = findItemById(model, "workshop");
    expect(workshopItem).toBeUndefined(); // Hidden: no module.workshop.access
  });

  // ws-4: workshop hidden when entitlements are null (fail-closed)
  it("should hide workshop item when entitlements are null", () => {
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
        allow: ["module.workshop.access", "workshop.*"],
        deny: [],
      },
    };

    const model = buildSidebarModelUncached(BASE_APP_CONTEXT, userContext, null, "en");

    const workshopItem = findItemById(model, "workshop");
    expect(workshopItem).toBeUndefined(); // Hidden: fail-closed with null entitlements
  });
});
