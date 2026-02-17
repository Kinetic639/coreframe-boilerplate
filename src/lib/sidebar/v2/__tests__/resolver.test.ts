import { describe, it, expect } from "vitest";
import { resolveSidebarModel } from "../resolver";
import type { SidebarResolverInput, SidebarItem } from "@/lib/types/v2/sidebar";

// Import canonical permission constants
import {
  ORG_UPDATE,
  ORG_READ,
  MEMBERS_MANAGE,
  BRANCHES_UPDATE,
  MEMBERS_READ,
  ACCOUNT_PROFILE_READ,
  ACCOUNT_WILDCARD,
} from "@/lib/constants/permissions";

// Import canonical module constants
import {
  MODULE_ANALYTICS,
  MODULE_DEVELOPMENT,
  MODULE_HOME,
  MODULE_WAREHOUSE,
  MODULE_TEAMS,
  MODULE_SUPPORT,
} from "@/lib/constants/modules";

describe("resolveSidebarModel", () => {
  const baseInput: SidebarResolverInput = {
    locale: "en",
    permissionSnapshot: { allow: [], deny: [] },
    entitlements: {
      enabled_modules: [],
      enabled_contexts: [],
      features: {},
      limits: {},
    },
    context: {
      activeOrgId: "org-123",
      activeBranchId: null,
    },
  };

  const publicItem: SidebarItem = {
    id: "home",
    title: "Home",
    iconKey: "home",
    href: "/dashboard/start",
  };

  it("should show public items (no visibility rules)", () => {
    const registry = { main: [publicItem], footer: [] };
    const result = resolveSidebarModel(baseInput, registry);

    expect(result.main).toHaveLength(1);
    expect(result.main[0].id).toBe("home");
  });

  it("should always return footer (may be empty array)", () => {
    const registry = { main: [publicItem], footer: [] };
    const result = resolveSidebarModel(baseInput, registry);

    expect(result.footer).toBeDefined();
    expect(Array.isArray(result.footer)).toBe(true);
  });

  it("should hide item when requiresPermissions not satisfied (AND)", () => {
    const protectedItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: [ORG_UPDATE],
      },
    };

    const registry = { main: [protectedItem], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_READ], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should show item when ALL requiresPermissions satisfied (AND)", () => {
    const protectedItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: [ORG_UPDATE],
      },
    };

    const registry = { main: [protectedItem], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_UPDATE], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1);
  });

  it("should require ALL permissions when multiple in requiresPermissions (AND)", () => {
    const item: SidebarItem = {
      id: "admin",
      title: "Admin",
      iconKey: "settings",
      visibility: {
        requiresPermissions: [ORG_UPDATE, MEMBERS_MANAGE],
      },
    };

    const registry = { main: [item], footer: [] };

    // Has only one of two required
    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_UPDATE], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);

    // Has both
    const input2 = {
      ...baseInput,
      permissionSnapshot: {
        allow: [ORG_UPDATE, MEMBERS_MANAGE],
        deny: [],
      },
    };

    const result2 = resolveSidebarModel(input2, registry);
    expect(result2.main).toHaveLength(1);
  });

  it("should show item when ANY requiresAnyPermissions satisfied (OR)", () => {
    const item: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/settings",
      visibility: {
        requiresAnyPermissions: [ORG_UPDATE, BRANCHES_UPDATE],
      },
    };

    const registry = { main: [item], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [BRANCHES_UPDATE], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1);
  });

  it("should hide item when NO requiresAnyPermissions satisfied (OR)", () => {
    const item: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/settings",
      visibility: {
        requiresAnyPermissions: [ORG_UPDATE, BRANCHES_UPDATE],
      },
    };

    const registry = { main: [item], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [MEMBERS_READ], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should hide module-gated item when module not enabled", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: [MODULE_ANALYTICS],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_WAREHOUSE],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should show module-gated item when module enabled", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: [MODULE_ANALYTICS],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_WAREHOUSE, MODULE_ANALYTICS],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1);
  });

  it("should fail-closed when entitlements null and item requires module", () => {
    const analyticsItem: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      href: "/dashboard/analytics",
      visibility: {
        requiresModules: [MODULE_ANALYTICS],
      },
    };

    const registry = { main: [analyticsItem], footer: [] };

    const input = {
      ...baseInput,
      entitlements: null,
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should show item when ANY required module is enabled (OR logic)", () => {
    const dataItem: SidebarItem = {
      id: "data",
      title: "Data",
      iconKey: "analytics",
      href: "/dashboard/data",
      visibility: {
        requiresAnyModules: [MODULE_ANALYTICS, MODULE_DEVELOPMENT],
      },
    };

    const registry = { main: [dataItem], footer: [] };

    // Has analytics (one of two)
    const input1 = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_ANALYTICS],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input1, registry).main).toHaveLength(1);

    // Has development (other one)
    const input2 = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_DEVELOPMENT],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input2, registry).main).toHaveLength(1);

    // Has both
    const input3 = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_ANALYTICS, MODULE_DEVELOPMENT],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input3, registry).main).toHaveLength(1);

    // Has neither
    const input4 = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_WAREHOUSE],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input4, registry).main).toHaveLength(0);
  });

  it("should fail-closed for requiresAnyModules when entitlements are null", () => {
    const dataItem: SidebarItem = {
      id: "data",
      title: "Data",
      iconKey: "analytics",
      href: "/dashboard/data",
      visibility: {
        requiresAnyModules: [MODULE_ANALYTICS, MODULE_DEVELOPMENT],
      },
    };

    const registry = { main: [dataItem], footer: [] };

    const input = {
      ...baseInput,
      entitlements: null,
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should hide parent group when all children hidden", () => {
    const warehouseGroup: SidebarItem = {
      id: "warehouse",
      title: "Warehouse",
      iconKey: "warehouse",
      children: [
        {
          id: "warehouse.products",
          title: "Products",
          iconKey: "products",
          href: "/dashboard/warehouse/products",
          visibility: {
            requiresModules: [MODULE_WAREHOUSE],
          },
        },
      ],
    };

    const registry = { main: [warehouseGroup], footer: [] };

    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should show parent group when at least one child visible", () => {
    const settingsGroup: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      children: [
        {
          id: "settings.general",
          title: "General",
          iconKey: "settings",
          href: "/dashboard/settings/general",
        },
        {
          id: "settings.analytics",
          title: "Analytics Settings",
          iconKey: "analytics",
          href: "/dashboard/settings/analytics",
          visibility: {
            requiresModules: [MODULE_ANALYTICS],
          },
        },
      ],
    };

    const registry = { main: [settingsGroup], footer: [] };

    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_WAREHOUSE, MODULE_TEAMS],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1);
    expect(result.main[0].children).toHaveLength(1);
    expect(result.main[0].children![0].id).toBe("settings.general");
  });

  it("should use canonical permission matcher for wildcards", () => {
    const accountItem: SidebarItem = {
      id: "account",
      title: "Account",
      iconKey: "settings",
      href: "/dashboard/account/profile",
      visibility: {
        requiresPermissions: [ACCOUNT_PROFILE_READ],
      },
    };

    const registry = { main: [accountItem], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ACCOUNT_WILDCARD], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(1);
  });

  it("should respect deny permissions (deny-first semantics)", () => {
    const billingItem: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: [ORG_UPDATE],
      },
    };

    const registry = { main: [billingItem], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_UPDATE], deny: [ORG_UPDATE] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should fail-closed when permissionSnapshot.allow is empty", () => {
    const settingsItem: SidebarItem = {
      id: "settings",
      title: "Settings",
      iconKey: "settings",
      href: "/dashboard/organization/settings",
      visibility: {
        requiresPermissions: [ORG_UPDATE],
      },
    };

    const registry = { main: [settingsItem], footer: [] };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [], deny: [] },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.main).toHaveLength(0);
  });

  it("should AND permission rules with module rules", () => {
    const item: SidebarItem = {
      id: "analytics-admin",
      title: "Analytics Admin",
      iconKey: "analytics",
      visibility: {
        requiresPermissions: [ORG_UPDATE],
        requiresModules: [MODULE_ANALYTICS],
      },
    };

    const registry = { main: [item], footer: [] };

    // Has permission but not module
    const input1 = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_UPDATE], deny: [] },
      entitlements: {
        enabled_modules: [MODULE_HOME],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input1, registry).main).toHaveLength(0);

    // Has module but not permission
    const input2 = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_READ], deny: [] },
      entitlements: {
        enabled_modules: [MODULE_ANALYTICS],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input2, registry).main).toHaveLength(0);

    // Has both
    const input3 = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_UPDATE], deny: [] },
      entitlements: {
        enabled_modules: [MODULE_ANALYTICS],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };
    expect(resolveSidebarModel(input3, registry).main).toHaveLength(1);
  });

  it("should be 100% deterministic (same inputs → identical outputs)", () => {
    const registry = {
      main: [
        {
          id: "home",
          title: "Home",
          iconKey: "home" as const,
          href: "/dashboard/start",
        },
        {
          id: "warehouse",
          title: "Warehouse",
          iconKey: "warehouse" as const,
          children: [
            {
              id: "warehouse.products",
              title: "Products",
              iconKey: "products" as const,
              href: "/dashboard/warehouse/products",
            },
          ],
        },
      ],
      footer: [],
    };

    const input = {
      ...baseInput,
      permissionSnapshot: { allow: [ORG_READ], deny: [] },
      entitlements: {
        enabled_modules: [MODULE_HOME, MODULE_WAREHOUSE],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result1 = resolveSidebarModel(input, registry);
    const result2 = resolveSidebarModel(input, registry);
    const result3 = resolveSidebarModel(input, registry);

    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);

    const json1 = JSON.stringify(result1);
    const json2 = JSON.stringify(result2);
    const json3 = JSON.stringify(result3);

    expect(json1).toBe(json2);
    expect(json2).toBe(json3);

    // No timestamp fields
    expect(json1).not.toMatch(/generatedAt/);
    expect(json1).not.toMatch(/timestamp/);
    expect(json1).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("should not mutate registry input", () => {
    const registry = {
      main: [
        {
          id: "group",
          title: "Group",
          iconKey: "settings" as const,
          children: [
            {
              id: "child1",
              title: "Child 1",
              iconKey: "settings" as const,
              href: "/a",
            },
            {
              id: "child2",
              title: "Child 2",
              iconKey: "settings" as const,
              href: "/b",
              visibility: { requiresPermissions: [ORG_UPDATE] },
            },
          ],
        },
      ],
      footer: [],
    };

    const registryBefore = JSON.stringify(registry);

    resolveSidebarModel(baseInput, registry);

    const registryAfter = JSON.stringify(registry);
    expect(registryBefore).toBe(registryAfter);
  });

  it("should filter footer items with same rules as main", () => {
    const registry = {
      main: [],
      footer: [
        {
          id: "support",
          title: "Support",
          iconKey: "support" as const,
          href: "/dashboard/support",
          visibility: {
            requiresModules: [MODULE_SUPPORT],
          },
        },
      ],
    };

    // No support module
    const input = {
      ...baseInput,
      entitlements: {
        enabled_modules: [MODULE_HOME],
        enabled_contexts: [],
        features: {},
        limits: {},
      },
    };

    const result = resolveSidebarModel(input, registry);
    expect(result.footer).toHaveLength(0);
  });
});
