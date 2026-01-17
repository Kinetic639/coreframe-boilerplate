/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePermissions } from "../use-permissions";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import type { PermissionSnapshot } from "@/lib/types/permissions";

// Helper function to reduce test repetition
function setSnapshot(snapshot: PermissionSnapshot) {
  act(() => {
    useUserStoreV2.getState().setPermissionSnapshot(snapshot);
  });
}

describe("usePermissions", () => {
  beforeEach(() => {
    // Clear user store before each test
    useUserStoreV2.getState().clear();
  });

  describe("can()", () => {
    it("should return true for exact permission match", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read", "warehouse.inventory.view"],
        deny: [],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.inventory.view")).toBe(true);
    });

    it("should return false for permission not in allow list", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.create")).toBe(false);
      expect(result.current.can("teams.members.read")).toBe(false);
    });

    it("should support wildcard patterns in allow list", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*", "teams.members.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.inventory.view")).toBe(true);
      expect(result.current.can("warehouse.anything.else")).toBe(true);
      expect(result.current.can("teams.members.read")).toBe(true);
      expect(result.current.can("teams.members.create")).toBe(false);
    });

    it("should support nested wildcard patterns", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.*"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(true);
      expect(result.current.can("warehouse.products.delete")).toBe(true);
      expect(result.current.can("warehouse.inventory.view")).toBe(false);
    });

    it("should support universal wildcard (*)", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["*"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("teams.members.create")).toBe(true);
      expect(result.current.can("anything.you.want")).toBe(true);
    });

    it("should deny permissions in deny list (deny-first semantics)", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.products.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(true);
      expect(result.current.can("warehouse.products.delete")).toBe(false); // Denied
      expect(result.current.can("warehouse.inventory.view")).toBe(true);
    });

    it("should support wildcard patterns in deny list", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.settings.*"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.settings.update")).toBe(false); // Denied
      expect(result.current.can("warehouse.settings.view")).toBe(false); // Denied
    });

    it("should prioritize deny over allow (deny wins)", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["*"],
        deny: ["warehouse.products.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.products.delete")).toBe(false); // Deny wins
    });

    it("should return false for empty permission snapshot", () => {
      const snapshot: PermissionSnapshot = {
        allow: [],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(false);
      expect(result.current.can("teams.members.read")).toBe(false);
    });

    it("should react to permission snapshot changes", async () => {
      const snapshot1: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot1);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(false);

      // Update permissions
      const snapshot2: PermissionSnapshot = {
        allow: ["warehouse.products.*"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot2);
      });

      // Use waitFor to ensure React batching/subscription updates complete
      await waitFor(() => {
        expect(result.current.can("warehouse.products.read")).toBe(true);
        expect(result.current.can("warehouse.products.create")).toBe(true);
      });
    });
  });

  describe("cannot()", () => {
    it("should return true when user does not have permission", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.cannot("warehouse.products.create")).toBe(true);
      expect(result.current.cannot("teams.members.read")).toBe(true);
    });

    it("should return false when user has permission", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read", "warehouse.inventory.view"],
        deny: [],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.cannot("warehouse.products.read")).toBe(false);
      expect(result.current.cannot("warehouse.inventory.view")).toBe(false);
    });

    it("should respect deny list (return true when denied)", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.products.delete"],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.cannot("warehouse.products.delete")).toBe(true);
      expect(result.current.cannot("warehouse.products.read")).toBe(false);
    });

    it("should work with wildcard patterns", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: [],
      };

      setSnapshot(snapshot);

      const { result } = renderHook(() => usePermissions());

      expect(result.current.cannot("warehouse.products.read")).toBe(false);
      expect(result.current.cannot("teams.members.read")).toBe(true);
    });
  });

  describe("canAny()", () => {
    it("should return true if user has ANY of the permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read", "warehouse.inventory.view"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAny(["warehouse.products.read", "warehouse.products.create"])).toBe(
        true
      );
      expect(result.current.canAny(["warehouse.inventory.view", "teams.members.read"])).toBe(true);
    });

    it("should return false if user has NONE of the permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(
        result.current.canAny(["warehouse.products.create", "warehouse.products.delete"])
      ).toBe(false);
      expect(result.current.canAny(["teams.members.read", "teams.members.create"])).toBe(false);
    });

    it("should work with wildcard patterns", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(
        result.current.canAny([
          "warehouse.products.read",
          "warehouse.inventory.view",
          "teams.members.read",
        ])
      ).toBe(true);
    });

    it("should respect deny list", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.products.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(
        result.current.canAny([
          "warehouse.products.delete", // Denied
          "warehouse.products.create", // Allowed
        ])
      ).toBe(true);

      expect(
        result.current.canAny([
          "warehouse.products.delete", // Denied
          "teams.members.read", // Not allowed
        ])
      ).toBe(false);
    });

    it("should handle empty array", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAny([])).toBe(false);
    });
  });

  describe("canAll()", () => {
    it("should return true if user has ALL of the permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read", "warehouse.inventory.view", "teams.members.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAll(["warehouse.products.read", "warehouse.inventory.view"])).toBe(
        true
      );
      expect(
        result.current.canAll([
          "warehouse.products.read",
          "warehouse.inventory.view",
          "teams.members.read",
        ])
      ).toBe(true);
    });

    it("should return false if user is missing ANY of the permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAll(["warehouse.products.read", "warehouse.products.create"])).toBe(
        false
      );
      expect(
        result.current.canAll([
          "warehouse.products.read",
          "warehouse.inventory.view",
          "teams.members.read",
        ])
      ).toBe(false);
    });

    it("should work with wildcard patterns", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(
        result.current.canAll([
          "warehouse.products.read",
          "warehouse.inventory.view",
          "warehouse.anything.else",
        ])
      ).toBe(true);

      expect(
        result.current.canAll([
          "warehouse.products.read",
          "warehouse.inventory.view",
          "teams.members.read", // Not allowed
        ])
      ).toBe(false);
    });

    it("should respect deny list", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.products.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(
        result.current.canAll([
          "warehouse.products.read",
          "warehouse.products.delete", // Denied
        ])
      ).toBe(false);

      expect(result.current.canAll(["warehouse.products.read", "warehouse.inventory.view"])).toBe(
        true
      );
    });

    it("should handle empty array", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAll([])).toBe(true); // Empty array = all conditions met
    });

    it("should handle single permission", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.canAll(["warehouse.products.read"])).toBe(true);
      expect(result.current.canAll(["warehouse.products.create"])).toBe(false);
    });
  });

  describe("getSnapshot()", () => {
    it("should return current permission snapshot", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.read", "teams.members.view"],
        deny: ["warehouse.settings.*"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      const returnedSnapshot = result.current.getSnapshot();

      expect(returnedSnapshot).toEqual(snapshot);
      expect(returnedSnapshot.allow).toEqual(["warehouse.products.read", "teams.members.view"]);
      expect(returnedSnapshot.deny).toEqual(["warehouse.settings.*"]);
    });

    it("should return empty snapshot when none is set", () => {
      const { result } = renderHook(() => usePermissions());

      const snapshot = result.current.getSnapshot();

      expect(snapshot).toEqual({ allow: [], deny: [] });
    });

    it("should react to permission changes", async () => {
      const snapshot1: PermissionSnapshot = {
        allow: ["permission.one"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot1);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.getSnapshot()).toEqual(snapshot1);

      const snapshot2: PermissionSnapshot = {
        allow: ["permission.two"],
        deny: ["permission.three"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot2);
      });

      // Use waitFor to ensure React batching/subscription updates complete
      await waitFor(() => {
        expect(result.current.getSnapshot()).toEqual(snapshot2);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle permissions with special characters", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products-v2.read", "teams.members_list.view"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products-v2.read")).toBe(true);
      expect(result.current.can("teams.members_list.view")).toBe(true);
    });

    it("should handle deeply nested permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.inventory.locations.buildings.floors.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.inventory.locations.buildings.floors.read")).toBe(true);
      expect(result.current.can("warehouse.inventory.locations.buildings.floors.create")).toBe(
        false
      );
    });

    it("should handle wildcard at different nesting levels", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.inventory.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(false);
    });

    it("should handle case-sensitive permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.Products.Read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.Products.Read")).toBe(true);
      expect(result.current.can("warehouse.products.read")).toBe(false); // Case mismatch
    });

    it("should handle multiple wildcards in same pattern", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["*.*.read"],
        deny: [],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("teams.members.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(false);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle warehouse manager permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.*"],
        deny: ["warehouse.settings.*", "warehouse.admin.*"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      // Can manage products
      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("warehouse.products.create")).toBe(true);
      expect(result.current.can("warehouse.inventory.view")).toBe(true);

      // Cannot access settings or admin
      expect(result.current.can("warehouse.settings.update")).toBe(false);
      expect(result.current.can("warehouse.admin.users")).toBe(false);
    });

    it("should handle read-only user permissions", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["*.*.read", "*.*.view"],
        deny: ["*.*.create", "*.*.update", "*.*.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      // Can read
      expect(result.current.can("warehouse.products.read")).toBe(true);
      expect(result.current.can("teams.members.view")).toBe(true);

      // Cannot write
      expect(result.current.can("warehouse.products.create")).toBe(false);
      expect(result.current.can("warehouse.products.update")).toBe(false);
      expect(result.current.can("warehouse.products.delete")).toBe(false);
    });

    it("should handle complex permission checks for UI components", () => {
      const snapshot: PermissionSnapshot = {
        allow: ["warehouse.products.*", "warehouse.inventory.view"],
        deny: ["warehouse.products.delete"],
      };

      act(() => {
        useUserStoreV2.getState().setPermissionSnapshot(snapshot);
      });

      const { result } = renderHook(() => usePermissions());

      // Show product edit button
      expect(result.current.can("warehouse.products.edit")).toBe(true);

      // Show either edit or delete button
      expect(result.current.canAny(["warehouse.products.edit", "warehouse.products.delete"])).toBe(
        true
      );

      // Show product management section (requires all permissions)
      expect(result.current.canAll(["warehouse.products.read", "warehouse.inventory.view"])).toBe(
        true
      );

      // Don't show admin panel
      expect(result.current.canAll(["warehouse.products.read", "warehouse.admin.access"])).toBe(
        false
      );
    });
  });
});
