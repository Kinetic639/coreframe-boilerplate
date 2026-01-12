/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { checkPermission, matchesAnyPattern, type PermissionSnapshot } from "../permissions";

describe("Permission Matching Utilities", () => {
  describe("matchesAnyPattern()", () => {
    it("should match exact permission strings", () => {
      expect(matchesAnyPattern(["warehouse.products.read"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["teams.members.view"], "teams.members.view")).toBe(true);
    });

    it("should not match different permission strings", () => {
      expect(matchesAnyPattern(["warehouse.products.read"], "warehouse.products.create")).toBe(
        false
      );
      expect(matchesAnyPattern(["teams.members.view"], "teams.members.edit")).toBe(false);
    });

    it("should match with universal wildcard (*)", () => {
      expect(matchesAnyPattern(["*"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["*"], "teams.members.view")).toBe(true);
      expect(matchesAnyPattern(["*"], "any.permission.here")).toBe(true);
    });

    it("should match with module-level wildcard", () => {
      expect(matchesAnyPattern(["warehouse.*"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["warehouse.*"], "warehouse.inventory.view")).toBe(true);
      expect(matchesAnyPattern(["warehouse.*"], "warehouse.anything.action")).toBe(true);
    });

    it("should match with entity-level wildcard", () => {
      expect(matchesAnyPattern(["warehouse.products.*"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["warehouse.products.*"], "warehouse.products.create")).toBe(true);
      expect(matchesAnyPattern(["warehouse.products.*"], "warehouse.products.delete")).toBe(true);

      // Should not match different entity
      expect(matchesAnyPattern(["warehouse.products.*"], "warehouse.locations.read")).toBe(false);
    });

    it("should support multiple patterns", () => {
      expect(
        matchesAnyPattern(
          ["warehouse.products.read", "warehouse.inventory.view"],
          "warehouse.products.read"
        )
      ).toBe(true);

      expect(
        matchesAnyPattern(
          ["warehouse.products.read", "warehouse.inventory.view"],
          "warehouse.inventory.view"
        )
      ).toBe(true);

      expect(
        matchesAnyPattern(
          ["warehouse.products.read", "warehouse.inventory.view"],
          "warehouse.products.create"
        )
      ).toBe(false);
    });

    it("should support wildcards in any position", () => {
      expect(matchesAnyPattern(["*.products.read"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["warehouse.*.read"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["warehouse.products.*"], "warehouse.products.read")).toBe(true);
    });

    it("should support multiple wildcards in pattern", () => {
      expect(matchesAnyPattern(["*.*.read"], "warehouse.products.read")).toBe(true);
      expect(matchesAnyPattern(["warehouse.*.*"], "warehouse.products.read")).toBe(true);
    });

    it("should return false for empty pattern array", () => {
      expect(matchesAnyPattern([], "warehouse.products.read")).toBe(false);
    });

    it("should handle patterns in any order", () => {
      expect(
        matchesAnyPattern(["teams.members.read", "warehouse.*"], "warehouse.products.read")
      ).toBe(true);
    });

    it("should NOT allow partial prefix matches without wildcard", () => {
      expect(matchesAnyPattern(["warehouse"], "warehouse.products.read")).toBe(false);
      expect(matchesAnyPattern(["warehouse.products"], "warehouse.products.read")).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(matchesAnyPattern(["Warehouse.Products.Read"], "warehouse.products.read")).toBe(false);
      expect(matchesAnyPattern(["warehouse.products.read"], "warehouse.Products.read")).toBe(false);
    });

    it("should handle special characters in segment names", () => {
      expect(matchesAnyPattern(["warehouse.products-v2.read"], "warehouse.products-v2.read")).toBe(
        true
      );
      expect(matchesAnyPattern(["warehouse.*.read"], "warehouse.products-v2.read")).toBe(true);
      expect(
        matchesAnyPattern(["warehouse.products_list.read"], "warehouse.products_list.read")
      ).toBe(true);
    });
  });

  describe("checkPermission()", () => {
    describe("Allow-Only Snapshots", () => {
      it("should return true for exact matches in allow list", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.products.read", "warehouse.inventory.view"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.inventory.view")).toBe(true);
      });

      it("should return false for permissions not in allow list", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.products.read"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.create")).toBe(false);
        expect(checkPermission(snapshot, "teams.members.read")).toBe(false);
      });

      it("should support wildcards in allow list", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*", "teams.members.read"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.inventory.view")).toBe(true);
        expect(checkPermission(snapshot, "teams.members.read")).toBe(true);
        expect(checkPermission(snapshot, "teams.members.create")).toBe(false);
      });

      it("should support universal wildcard", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["*"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "teams.members.create")).toBe(true);
        expect(checkPermission(snapshot, "anything.you.want")).toBe(true);
      });
    });

    describe("Deny-First Semantics", () => {
      it("should deny permissions in deny list even if allowed", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: ["warehouse.products.delete"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.create")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false); // Denied
      });

      it("should support wildcards in deny list", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: ["warehouse.settings.*"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.settings.update")).toBe(false); // Denied
        expect(checkPermission(snapshot, "warehouse.settings.view")).toBe(false); // Denied
      });

      it("should prioritize deny over allow (deny wins)", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["*"],
          deny: ["warehouse.products.delete"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false); // Deny wins
      });

      it("should deny entire wildcard range when denied", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: ["warehouse.admin.*"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.extra.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.admin.users")).toBe(false); // Denied
        expect(checkPermission(snapshot, "warehouse.admin.settings")).toBe(false); // Denied
      });
    });

    describe("Empty Snapshots", () => {
      it("should return false for empty snapshot", () => {
        const snapshot: PermissionSnapshot = {
          allow: [],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
        expect(checkPermission(snapshot, "teams.members.read")).toBe(false);
      });

      it("should return false for deny-only snapshot", () => {
        const snapshot: PermissionSnapshot = {
          allow: [],
          deny: ["warehouse.products.delete"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false);
      });
    });

    describe("Real-World Scenarios", () => {
      it("should handle warehouse manager permissions", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: ["warehouse.settings.*", "warehouse.admin.*"],
        };

        // Can manage products
        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.create")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.inventory.view")).toBe(true);

        // Cannot access settings or admin
        expect(checkPermission(snapshot, "warehouse.settings.update")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.admin.users")).toBe(false);
      });

      it("should handle read-only user permissions", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["*.read", "*.view"],
          deny: ["*.create", "*.update", "*.delete"],
        };

        // Can read
        expect(checkPermission(snapshot, "warehouse.read")).toBe(true);
        expect(checkPermission(snapshot, "teams.view")).toBe(true);

        // Cannot write
        expect(checkPermission(snapshot, "warehouse.create")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.update")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.delete")).toBe(false);
      });

      it("should handle complex nested permissions", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.products.*", "warehouse.inventory.view"],
          deny: ["warehouse.products.delete"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.edit")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false); // Denied
        expect(checkPermission(snapshot, "warehouse.inventory.view")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.inventory.edit")).toBe(false); // Not allowed
      });
    });

    describe("Edge Cases", () => {
      it("should handle single-segment permissions", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["read"],
          deny: [],
        };

        expect(checkPermission(snapshot, "read")).toBe(true);
        expect(checkPermission(snapshot, "create")).toBe(false);
      });

      it("should handle deeply nested permissions", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["a.b.c.d.e.f"],
          deny: [],
        };

        expect(checkPermission(snapshot, "a.b.c.d.e.f")).toBe(true);
        expect(checkPermission(snapshot, "a.b.c.d.e.g")).toBe(false);
      });

      it("should handle wildcard matching deep nesting", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["a.*"],
          deny: [],
        };

        expect(checkPermission(snapshot, "a.b")).toBe(true);
        expect(checkPermission(snapshot, "a.b.c")).toBe(true);
        expect(checkPermission(snapshot, "a.b.c.d.e.f")).toBe(true);
      });

      it("should not match partial prefixes without wildcard", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false); // No wildcard
      });

      it("should handle redundant patterns (exact + wildcard)", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*", "warehouse.products.read"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
      });
    });

    describe("Compatibility with PermissionService", () => {
      it("should match PermissionService wildcard behavior - module level", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.locations.create")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.anything.action")).toBe(true);
      });

      it("should match PermissionService wildcard behavior - entity level", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.products.*"],
          deny: [],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.create")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.locations.read")).toBe(false);
      });

      it("should match PermissionService deny behavior", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.*"],
          deny: ["warehouse.products.delete"],
        };

        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(true);
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false);
      });

      it("should deny wildcard beats exact allow (critical edge case)", () => {
        const snapshot: PermissionSnapshot = {
          allow: ["warehouse.products.delete"],
          deny: ["warehouse.*"],
        };

        // Deny wildcard should override exact allow
        expect(checkPermission(snapshot, "warehouse.products.delete")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.products.read")).toBe(false);
        expect(checkPermission(snapshot, "warehouse.inventory.view")).toBe(false);
      });
    });
  });
});
