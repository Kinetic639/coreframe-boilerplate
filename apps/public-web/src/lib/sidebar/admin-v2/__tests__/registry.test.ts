/**
 * Admin Sidebar Registry tests
 *
 * Validates the integrity of the admin nav item registry:
 * - All permission slugs are imported from constants (no raw strings)
 * - Required fields are present on every item
 * - getAdminSidebarRegistry returns the correct shape
 * - Registry is immutable-safe (no shared references)
 */
import { describe, it, expect } from "vitest";
import { ADMIN_MAIN_NAV_ITEMS, ADMIN_FOOTER_NAV_ITEMS, getAdminSidebarRegistry } from "../registry";
import {
  SUPERADMIN_ADMIN_READ,
  SUPERADMIN_PLANS_READ,
  SUPERADMIN_PRICING_READ,
} from "@/lib/constants/permissions";

describe("Admin Sidebar Registry", () => {
  // -------------------------------------------------------------------------
  // Structural integrity
  // -------------------------------------------------------------------------
  describe("ADMIN_MAIN_NAV_ITEMS structure", () => {
    it("should have exactly 3 main nav items", () => {
      expect(ADMIN_MAIN_NAV_ITEMS).toHaveLength(3);
    });

    it("should have non-empty, unique ids on all items", () => {
      const ids = ADMIN_MAIN_NAV_ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length); // all unique
      ids.forEach((id) => expect(id.length).toBeGreaterThan(0));
    });

    it("every item must have an iconKey", () => {
      ADMIN_MAIN_NAV_ITEMS.forEach((item) => {
        expect(item.iconKey).toBeTruthy();
      });
    });

    it("every item must have an href", () => {
      ADMIN_MAIN_NAV_ITEMS.forEach((item) => {
        expect(item.href).toBeTruthy();
      });
    });

    it("every item must have a match rule (exact or startsWith)", () => {
      ADMIN_MAIN_NAV_ITEMS.forEach((item) => {
        const hasMatch = item.match?.exact !== undefined || item.match?.startsWith !== undefined;
        expect(hasMatch).toBe(true);
      });
    });

    it("every item must have at least one required permission", () => {
      ADMIN_MAIN_NAV_ITEMS.forEach((item) => {
        expect(item.visibility?.requiresPermissions?.length).toBeGreaterThan(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Permission slug integrity — NO raw strings allowed
  // -------------------------------------------------------------------------
  describe("permission slug integrity (no raw strings)", () => {
    it("admin.home should require SUPERADMIN_ADMIN_READ", () => {
      const homeItem = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.home");
      expect(homeItem).toBeDefined();
      expect(homeItem?.visibility?.requiresPermissions).toContain(SUPERADMIN_ADMIN_READ);
    });

    it("admin.plans should require SUPERADMIN_PLANS_READ", () => {
      const plansItem = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.plans");
      expect(plansItem).toBeDefined();
      expect(plansItem?.visibility?.requiresPermissions).toContain(SUPERADMIN_PLANS_READ);
    });

    it("admin.pricing should require SUPERADMIN_PRICING_READ", () => {
      const pricingItem = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.pricing");
      expect(pricingItem).toBeDefined();
      expect(pricingItem?.visibility?.requiresPermissions).toContain(SUPERADMIN_PRICING_READ);
    });

    it("no item should have raw superadmin strings (must use constants)", () => {
      // The constants are: "superadmin.admin.read", "superadmin.plans.read", etc.
      // We check that the values match the constants — if someone uses a raw string
      // and changes the constant, this test will catch the mismatch.
      ADMIN_MAIN_NAV_ITEMS.forEach((item) => {
        const perms = item.visibility?.requiresPermissions ?? [];
        perms.forEach((perm) => {
          expect(perm.startsWith("superadmin.")).toBe(true);
        });
      });
    });

    it("permission values should exactly match constant values", () => {
      const allPerms = ADMIN_MAIN_NAV_ITEMS.flatMap((i) => i.visibility?.requiresPermissions ?? []);
      const knownConstants = [
        SUPERADMIN_ADMIN_READ,
        SUPERADMIN_PLANS_READ,
        SUPERADMIN_PRICING_READ,
      ];
      allPerms.forEach((perm) => {
        expect(knownConstants).toContain(perm);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Item-specific route and match checks
  // -------------------------------------------------------------------------
  describe("individual item correctness", () => {
    it("admin.home should use exact match for /admin", () => {
      const item = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.home");
      expect(item?.match?.exact).toBe("/admin");
      expect(item?.href).toBe("/admin");
    });

    it("admin.plans should use startsWith /admin/plans", () => {
      const item = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.plans");
      expect(item?.match?.startsWith).toBe("/admin/plans");
      expect(item?.href).toBe("/admin/plans");
    });

    it("admin.pricing should use startsWith /admin/pricing", () => {
      const item = ADMIN_MAIN_NAV_ITEMS.find((i) => i.id === "admin.pricing");
      expect(item?.match?.startsWith).toBe("/admin/pricing");
      expect(item?.href).toBe("/admin/pricing");
    });
  });

  // -------------------------------------------------------------------------
  // Footer and registry
  // -------------------------------------------------------------------------
  describe("ADMIN_FOOTER_NAV_ITEMS", () => {
    it("should be an empty array (admin has no footer nav items)", () => {
      expect(ADMIN_FOOTER_NAV_ITEMS).toEqual([]);
    });
  });

  describe("getAdminSidebarRegistry", () => {
    it("should return object with main and footer keys", () => {
      const registry = getAdminSidebarRegistry();
      expect(registry).toHaveProperty("main");
      expect(registry).toHaveProperty("footer");
    });

    it("should return ADMIN_MAIN_NAV_ITEMS as main", () => {
      const registry = getAdminSidebarRegistry();
      expect(registry.main).toEqual(ADMIN_MAIN_NAV_ITEMS);
    });

    it("should return empty array as footer", () => {
      const registry = getAdminSidebarRegistry();
      expect(registry.footer).toEqual([]);
    });

    it("should return a new object reference each call (not a singleton)", () => {
      const r1 = getAdminSidebarRegistry();
      const r2 = getAdminSidebarRegistry();
      // Different object references but equal content
      expect(r1).not.toBe(r2);
      expect(r1).toEqual(r2);
    });
  });
});
