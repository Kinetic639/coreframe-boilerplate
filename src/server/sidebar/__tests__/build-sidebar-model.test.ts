import { describe, it, expect } from "vitest";
// Use uncached entrypoint so tests validate pure computation,
// not cache() memoization artifacts (cache() is for production SSR deduplication only).
import { buildSidebarModelUncached as buildSidebarModel } from "../build-sidebar-model";
import type { AppContextV2 } from "@/lib/stores/v2/app-store";
import type { UserContextV2 } from "@/lib/stores/v2/user-store";
import type { OrganizationEntitlements } from "@/lib/types/entitlements";
import {
  MODULE_WAREHOUSE,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_SUPPORT,
} from "@/lib/constants/modules";
import {
  ORG_READ,
  ORG_UPDATE,
  MEMBERS_READ,
  ACCOUNT_PROFILE_READ,
  ACCOUNT_PREFERENCES_READ,
} from "@/lib/constants/permissions";

describe("buildSidebarModel (Phase 4 - SSR Assembly)", () => {
  // Test fixtures
  const baseAppContext: AppContextV2 = {
    activeOrgId: "org-123",
    activeBranchId: "branch-456",
    activeOrg: {
      id: "org-123",
      name: "Test Org",
      name_2: null,
      slug: "test-org",
      logo_url: null,
    },
    activeBranch: {
      id: "branch-456",
      name: "Main Branch",
      organization_id: "org-123",
      slug: "main",
      created_at: "2024-01-01T00:00:00Z",
    },
    availableBranches: [],
    userModules: [],
  };

  const baseUserContext: UserContextV2 = {
    user: {
      id: "user-789",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      avatar_url: null,
    },
    roles: [],
    permissionSnapshot: { allow: [], deny: [] },
  };

  const baseEntitlements: OrganizationEntitlements = {
    organization_id: "org-123",
    plan_id: "plan-free",
    plan_name: "Free",
    enabled_modules: [MODULE_WAREHOUSE, MODULE_ORGANIZATION_MANAGEMENT, MODULE_SUPPORT],
    enabled_contexts: [],
    features: {},
    limits: {},
    updated_at: "2024-01-01T00:00:00Z",
  };

  describe("Fail-Closed Security", () => {
    it("should hide module-gated items when entitlements is null", () => {
      const model = buildSidebarModel(
        baseAppContext,
        baseUserContext,
        null, // No entitlements
        "en"
      );

      // Warehouse requires MODULE_WAREHOUSE → should be hidden
      const warehouseItem = model.main.find((item) => item.id === "warehouse");
      expect(warehouseItem).toBeUndefined();

      // Analytics requires MODULE_ANALYTICS → should be hidden
      const analyticsItem = model.main.find((item) => item.id === "analytics");
      expect(analyticsItem).toBeUndefined();
    });

    it("should hide module-gated items when module not in enabled_modules", () => {
      const entitlementsWithoutAnalytics: OrganizationEntitlements = {
        ...baseEntitlements,
        enabled_modules: [MODULE_WAREHOUSE, MODULE_ORGANIZATION_MANAGEMENT], // No analytics
      };

      const model = buildSidebarModel(
        baseAppContext,
        baseUserContext,
        entitlementsWithoutAnalytics,
        "en"
      );

      // Analytics requires MODULE_ANALYTICS → should be hidden
      const analyticsItem = model.main.find((item) => item.id === "analytics");
      expect(analyticsItem).toBeUndefined();

      // Warehouse is in enabled_modules → should be visible (if permissions allow)
      const warehouseItem = model.main.find((item) => item.id === "warehouse");
      expect(warehouseItem).toBeDefined();
    });

    it("should hide permission-gated items when allow array is empty", () => {
      const userWithNoPermissions: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: { allow: [], deny: [] }, // No permissions
      };

      const model = buildSidebarModel(
        baseAppContext,
        userWithNoPermissions,
        baseEntitlements,
        "en"
      );

      // Organization.profile requires ORG_READ → should be hidden
      const orgItem = model.main.find((item) => item.id === "organization");
      expect(
        orgItem?.children?.find((child) => child.id === "organization.profile")
      ).toBeUndefined();

      // Organization.billing requires ORG_UPDATE → should be hidden
      expect(
        orgItem?.children?.find((child) => child.id === "organization.billing")
      ).toBeUndefined();
    });

    it("should show items when permissions and modules are both satisfied", () => {
      const userWithPermissions: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: {
          allow: [
            ORG_READ,
            ORG_UPDATE,
            MEMBERS_READ,
            ACCOUNT_PROFILE_READ,
            ACCOUNT_PREFERENCES_READ,
          ],
          deny: [],
        },
      };

      const model = buildSidebarModel(baseAppContext, userWithPermissions, baseEntitlements, "en");

      // Warehouse: module enabled + no permissions required → visible
      const warehouseItem = model.main.find((item) => item.id === "warehouse");
      expect(warehouseItem).toBeDefined();

      // Organization: module enabled → visible parent
      const orgItem = model.main.find((item) => item.id === "organization");
      expect(orgItem).toBeDefined();

      // Organization.profile: ORG_READ granted → visible child
      expect(orgItem?.children?.find((child) => child.id === "organization.profile")).toBeDefined();

      // Organization.billing: ORG_UPDATE granted → visible child
      expect(orgItem?.children?.find((child) => child.id === "organization.billing")).toBeDefined();

      // Organization.users: MEMBERS_READ granted → visible child
      expect(orgItem?.children?.find((child) => child.id === "organization.users")).toBeDefined();
    });
  });

  describe("Determinism", () => {
    it("should return identical output for identical inputs", () => {
      const userWithPermissions: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: {
          allow: [ORG_READ, ACCOUNT_PROFILE_READ],
          deny: [],
        },
      };

      const model1 = buildSidebarModel(baseAppContext, userWithPermissions, baseEntitlements, "en");

      const model2 = buildSidebarModel(baseAppContext, userWithPermissions, baseEntitlements, "en");

      // Models should be deep-equal (deterministic)
      expect(JSON.stringify(model1)).toBe(JSON.stringify(model2));
    });

    it("should return different output for different permission inputs", () => {
      const userWithOrgRead: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: { allow: [ORG_READ], deny: [] },
      };

      const userWithOrgUpdate: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: { allow: [ORG_UPDATE], deny: [] },
      };

      const model1 = buildSidebarModel(baseAppContext, userWithOrgRead, baseEntitlements, "en");

      const model2 = buildSidebarModel(baseAppContext, userWithOrgUpdate, baseEntitlements, "en");

      // Models should differ (ORG_READ vs ORG_UPDATE gates different items)
      expect(JSON.stringify(model1)).not.toBe(JSON.stringify(model2));
    });
  });

  describe("No Active State", () => {
    it("should not include isActive field in items", () => {
      const model = buildSidebarModel(baseAppContext, baseUserContext, baseEntitlements, "en");

      // Check all items recursively
      function checkNoActiveState(items: any[]): void {
        items.forEach((item) => {
          expect(item).not.toHaveProperty("isActive");
          if (item.children) {
            checkNoActiveState(item.children);
          }
        });
      }

      checkNoActiveState(model.main);
      checkNoActiveState(model.footer);
    });
  });

  describe("Model Structure", () => {
    it("should return model with main and footer sections", () => {
      const model = buildSidebarModel(baseAppContext, baseUserContext, baseEntitlements, "en");

      expect(model).toHaveProperty("main");
      expect(model).toHaveProperty("footer");
      expect(Array.isArray(model.main)).toBe(true);
      expect(Array.isArray(model.footer)).toBe(true);
    });

    it("should preserve item structure (id, title, iconKey, href, match)", () => {
      const userWithPermissions: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: {
          allow: [ORG_READ, ACCOUNT_PROFILE_READ],
          deny: [],
        },
      };

      const model = buildSidebarModel(baseAppContext, userWithPermissions, baseEntitlements, "en");

      // Check warehouse item structure
      const warehouseItem = model.main.find((item) => item.id === "warehouse");
      expect(warehouseItem).toBeDefined();
      expect(warehouseItem?.id).toBe("warehouse");
      expect(warehouseItem?.title).toBe("Warehouse");
      expect(warehouseItem?.iconKey).toBe("warehouse");
      expect(warehouseItem?.href).toBe("/dashboard/warehouse");
      expect(warehouseItem?.match).toEqual({ startsWith: "/dashboard/warehouse" });
    });
  });

  describe("Parent Pruning", () => {
    it("should hide parent when all children are filtered out", () => {
      const userWithNoOrgPermissions: UserContextV2 = {
        ...baseUserContext,
        permissionSnapshot: {
          allow: [ACCOUNT_PROFILE_READ], // Only account permissions, no org permissions
          deny: [],
        },
      };

      const model = buildSidebarModel(
        baseAppContext,
        userWithNoOrgPermissions,
        baseEntitlements,
        "en"
      );

      // Organization parent should be hidden (all children require ORG_READ/ORG_UPDATE/MEMBERS_READ)
      const orgItem = model.main.find((item) => item.id === "organization");
      expect(orgItem).toBeUndefined();

      // Account parent should be visible (has children with ACCOUNT_PROFILE_READ)
      const accountItem = model.footer.find((item) => item.id === "account");
      expect(accountItem).toBeDefined();
    });
  });
});
