import { describe, it, expect } from "vitest";
import { isItemActive, isPrefixMatch } from "../active";
import type { SidebarItem } from "@/lib/types/v2/sidebar";

// Minimal SidebarItem factory — only sets fields relevant to active-state logic
function makeItem(overrides: Partial<SidebarItem> & { id: string; title: string }): SidebarItem {
  return {
    iconKey: "home",
    ...overrides,
  };
}

describe("isItemActive", () => {
  describe("exact match", () => {
    it("returns true when pathname equals match.exact", () => {
      const item = makeItem({ id: "home", title: "Home", match: { exact: "/dashboard/start" } });
      expect(isItemActive(item, "/dashboard/start")).toBe(true);
    });

    it("returns false when pathname differs from match.exact", () => {
      const item = makeItem({ id: "home", title: "Home", match: { exact: "/dashboard/start" } });
      expect(isItemActive(item, "/dashboard/warehouse")).toBe(false);
    });

    it("returns false when pathname is a prefix of match.exact", () => {
      const item = makeItem({ id: "home", title: "Home", match: { exact: "/dashboard/start" } });
      expect(isItemActive(item, "/dashboard")).toBe(false);
    });
  });

  describe("startsWith match", () => {
    it("returns true when pathname starts with match.startsWith", () => {
      const item = makeItem({
        id: "warehouse",
        title: "Warehouse",
        match: { startsWith: "/dashboard/warehouse" },
      });
      expect(isItemActive(item, "/dashboard/warehouse")).toBe(true);
    });

    it("returns true for a nested route under match.startsWith", () => {
      const item = makeItem({
        id: "warehouse",
        title: "Warehouse",
        match: { startsWith: "/dashboard/warehouse" },
      });
      expect(isItemActive(item, "/dashboard/warehouse/products/123")).toBe(true);
    });

    it("returns false when pathname does not start with match.startsWith", () => {
      const item = makeItem({
        id: "warehouse",
        title: "Warehouse",
        match: { startsWith: "/dashboard/warehouse" },
      });
      expect(isItemActive(item, "/dashboard/organization")).toBe(false);
    });

    it("returns false for a partial segment match (segment-aware, not raw prefix)", () => {
      const item = makeItem({
        id: "org",
        title: "Organization",
        match: { startsWith: "/dashboard/organization" },
      });
      // /dashboard/organizationx must NOT match /dashboard/organization
      expect(isItemActive(item, "/dashboard/organizationx")).toBe(false);
      // /dashboard/organization-foo must NOT match /dashboard/organization
      expect(isItemActive(item, "/dashboard/organization-foo")).toBe(false);
    });

    it("returns true when pathname has a trailing slash after the prefix", () => {
      const item = makeItem({
        id: "org",
        title: "Organization",
        match: { startsWith: "/dashboard/organization" },
      });
      expect(isItemActive(item, "/dashboard/organization/")).toBe(true);
    });
  });

  describe("isPrefixMatch (segment-aware helper)", () => {
    it("matches when pathname equals prefix exactly", () => {
      expect(isPrefixMatch("/dashboard/org", "/dashboard/org")).toBe(true);
    });

    it("matches when pathname is a sub-route of prefix", () => {
      expect(isPrefixMatch("/dashboard/org/profile", "/dashboard/org")).toBe(true);
    });

    it("does not match a different-name sibling route", () => {
      expect(isPrefixMatch("/dashboard/orgx", "/dashboard/org")).toBe(false);
    });

    it("does not match a hyphenated variant", () => {
      expect(isPrefixMatch("/dashboard/org-settings", "/dashboard/org")).toBe(false);
    });

    it("normalizes trailing slash on prefix", () => {
      expect(isPrefixMatch("/dashboard/org", "/dashboard/org/")).toBe(true);
      expect(isPrefixMatch("/dashboard/org/profile", "/dashboard/org/")).toBe(true);
    });

    it("root edge: prefix /dashboard matches /dashboard and /dashboard/...", () => {
      expect(isPrefixMatch("/dashboard", "/dashboard")).toBe(true);
      expect(isPrefixMatch("/dashboard/warehouse", "/dashboard")).toBe(true);
    });

    it("root edge: prefix /dashboard does not match /dashboardx", () => {
      expect(isPrefixMatch("/dashboardx", "/dashboard")).toBe(false);
    });
  });

  describe("no match rule", () => {
    it("returns false when item has no match and no children", () => {
      const item = makeItem({ id: "group", title: "Group" });
      expect(isItemActive(item, "/dashboard/anything")).toBe(false);
    });
  });

  describe("parent active state (recursive)", () => {
    it("returns true when any child is active via exact match", () => {
      const parent = makeItem({
        id: "org",
        title: "Organization",
        children: [
          makeItem({
            id: "org.profile",
            title: "Profile",
            match: { exact: "/dashboard/organization/profile" },
          }),
          makeItem({
            id: "org.users",
            title: "Users",
            match: { exact: "/dashboard/organization/users" },
          }),
        ],
      });
      expect(isItemActive(parent, "/dashboard/organization/profile")).toBe(true);
    });

    it("returns false when no child matches", () => {
      const parent = makeItem({
        id: "org",
        title: "Organization",
        children: [
          makeItem({
            id: "org.profile",
            title: "Profile",
            match: { exact: "/dashboard/organization/profile" },
          }),
          makeItem({
            id: "org.users",
            title: "Users",
            match: { exact: "/dashboard/organization/users" },
          }),
        ],
      });
      expect(isItemActive(parent, "/dashboard/warehouse")).toBe(false);
    });

    it("returns true when deeply nested grandchild is active", () => {
      const grandparent = makeItem({
        id: "settings",
        title: "Settings",
        children: [
          makeItem({
            id: "settings.team",
            title: "Team",
            children: [
              makeItem({
                id: "settings.team.members",
                title: "Members",
                match: { startsWith: "/dashboard/settings/team/members" },
              }),
            ],
          }),
        ],
      });
      expect(isItemActive(grandparent, "/dashboard/settings/team/members/123")).toBe(true);
    });

    it("returns false when item has empty children array", () => {
      const parent = makeItem({ id: "empty", title: "Empty", children: [] });
      expect(isItemActive(parent, "/dashboard/anything")).toBe(false);
    });
  });

  describe("parent match rule is ignored when children exist", () => {
    it("ignores parent match.exact when children are present — active driven by children", () => {
      // If a parent has children, the parent's own match rule is NOT checked.
      // Active state comes from children only.
      const parent = makeItem({
        id: "org",
        title: "Organization",
        match: { exact: "/dashboard/organization" },
        children: [
          makeItem({
            id: "org.profile",
            title: "Profile",
            match: { exact: "/dashboard/organization/profile" },
          }),
        ],
      });
      // Pathname matches parent's own exact rule but NOT any child
      expect(isItemActive(parent, "/dashboard/organization")).toBe(false);
      // Pathname matches child → parent becomes active
      expect(isItemActive(parent, "/dashboard/organization/profile")).toBe(true);
    });
  });
});
