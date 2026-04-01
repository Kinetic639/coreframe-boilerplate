/**
 * Sidebar V2 Contract Tests
 *
 * NOTE:
 * This file tests only TYPE CONTRACT SHAPE.
 * Raw permission/module strings used here are for TYPE TESTING ONLY.
 * Enforcement tests MUST use imported permission/module constants.
 * Raw strings here do NOT represent canonical enforcement practice.
 */
import { describe, it, expect } from "vitest";
import type { SidebarModel, SidebarItem } from "../sidebar";

describe("Sidebar Contract Types", () => {
  it("should allow JSON serialization of complete model", () => {
    const model: SidebarModel = {
      main: [
        {
          id: "home",
          title: "Home",
          iconKey: "home",
          href: "/dashboard/start",
          match: { exact: "/dashboard/start" },
        },
      ],
      footer: [],
    };

    const serialized = JSON.stringify(model);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.main[0].id).toBe("home");
    expect(deserialized.main[0].iconKey).toBe("home");

    // Verify determinism: same model serializes to same JSON every time
    const serialized2 = JSON.stringify(model);
    expect(serialized).toBe(serialized2);
  });

  it("should support nested children", () => {
    const parent: SidebarItem = {
      id: "warehouse",
      title: "Warehouse",
      iconKey: "warehouse",
      children: [
        {
          id: "warehouse.products",
          title: "Products",
          iconKey: "products",
          href: "/dashboard/warehouse/products",
        },
      ],
    };

    expect(parent.children).toHaveLength(1);
    expect(parent.children![0].id).toBe("warehouse.products");
  });

  it("should support visibility rules", () => {
    const item: SidebarItem = {
      id: "billing",
      title: "Billing",
      iconKey: "settings",
      href: "/dashboard/organization/billing",
      visibility: {
        requiresPermissions: ["org.update"],
        requiresModules: ["organization-management"],
      },
    };

    expect(item.visibility?.requiresPermissions).toHaveLength(1);
    expect(item.visibility?.requiresModules).toContain("organization-management");
  });

  it("should support match rules", () => {
    const exactItem: SidebarItem = {
      id: "home",
      title: "Home",
      iconKey: "home",
      href: "/dashboard/start",
      match: { exact: "/dashboard/start" },
    };

    const prefixItem: SidebarItem = {
      id: "warehouse",
      title: "Warehouse",
      iconKey: "warehouse",
      href: "/dashboard/warehouse",
      match: { startsWith: "/dashboard/warehouse" },
    };

    expect(exactItem.match?.exact).toBe("/dashboard/start");
    expect(prefixItem.match?.startsWith).toBe("/dashboard/warehouse");
  });

  it("should support badge and disabledReason", () => {
    const item: SidebarItem = {
      id: "analytics",
      title: "Analytics",
      iconKey: "analytics",
      badge: "New",
      disabledReason: "entitlement",
    };

    expect(item.badge).toBe("New");
    expect(item.disabledReason).toBe("entitlement");
  });

  it("should enforce footer as required (may be empty array)", () => {
    const model: SidebarModel = {
      main: [],
      footer: [],
    };

    expect(model.footer).toBeDefined();
    expect(Array.isArray(model.footer)).toBe(true);
  });

  it("should support OR visibility rules", () => {
    const item: SidebarItem = {
      id: "data",
      title: "Data",
      iconKey: "analytics",
      visibility: {
        requiresAnyPermissions: ["org.update", "branches.update"],
        requiresAnyModules: ["analytics", "development"],
      },
    };

    expect(item.visibility?.requiresAnyPermissions).toHaveLength(2);
    expect(item.visibility?.requiresAnyModules).toHaveLength(2);
  });
});
