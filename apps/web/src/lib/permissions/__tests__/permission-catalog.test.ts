import { describe, expect, it } from "vitest";
import { groupCatalog, isAssignablePermission, permissionLabelKey } from "../permission-catalog";

const catalog = [
  { slug: "members.manage", category: "members", name: "Members Manage" },
  { slug: "warehouse.structure.manage", category: "warehouse", name: null },
  { slug: "warehouse.*", category: "warehouse", name: null },
  { slug: "module.warehouse.access", category: "module", name: null },
  { slug: "superadmin.*", category: "superadmin", name: null },
];

describe("permission catalog", () => {
  it("groups modules first, puts the wildcard on top and leaves platform permissions out", () => {
    const groups = groupCatalog(catalog, "org");
    expect(groups.map((g) => g.category)).toEqual(["module", "warehouse", "members"]);
    expect(groups[1].permissions.map((p) => p.slug)).toEqual([
      "warehouse.*",
      "warehouse.structure.manage",
    ]);
  });

  it("does not offer org-only permissions to a branch role", () => {
    const slugs = groupCatalog(catalog, "branch").flatMap((g) => g.permissions.map((p) => p.slug));
    expect(slugs).toContain("warehouse.structure.manage");
    expect(slugs).not.toContain("members.manage");
  });

  it("refuses superadmin permissions", () => {
    expect(isAssignablePermission({ slug: "superadmin.admin.read", category: null })).toBe(false);
    expect(isAssignablePermission({ slug: "warehouse.read", category: "warehouse" })).toBe(true);
  });

  it("builds message keys without dots or stars", () => {
    expect(permissionLabelKey("module.organization-management.access")).toBe(
      "module__organization-management__access"
    );
    expect(permissionLabelKey("warehouse.*")).toBe("warehouse__all");
  });
});
