/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useUserStoreV2, UserContextV2, UserV2 } from "../user-store";
import type { JWTRole } from "@/server/services/auth.service";
import type { PermissionSnapshot } from "@/server/services/permission.service";

describe("useUserStoreV2", () => {
  beforeEach(() => {
    // Clear store state before each test
    useUserStoreV2.getState().clear();
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useUserStoreV2.getState();

      expect(state.user).toBeNull();
      expect(state.roles).toEqual([]);
      expect(state.permissionSnapshot).toEqual({ allow: [], deny: [] });
      expect(state.isLoaded).toBe(false);
    });
  });

  describe("hydrateFromServer", () => {
    it("should hydrate store with valid user context", () => {
      const mockUser: UserV2 = {
        id: "user-123",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        avatar_url: "https://example.com/avatar.jpg",
      };

      const mockRoles: JWTRole[] = [
        {
          role_id: "role-1",
          role: "admin",
          org_id: "org-1",
          branch_id: null,
          scope: "org" as const,
          scope_id: "org-1",
        },
        {
          role_id: "role-2",
          role: "warehouse_manager",
          org_id: null,
          branch_id: "branch-1",
          scope: "branch" as const,
          scope_id: "branch-1",
        },
      ];

      const mockPermissionSnapshot: PermissionSnapshot = {
        allow: ["warehouse.inventory.view", "warehouse.products.edit"],
        deny: ["warehouse.settings.*"],
      };

      const context: UserContextV2 = {
        user: mockUser,
        roles: mockRoles,
        permissionSnapshot: mockPermissionSnapshot,
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      const state = useUserStoreV2.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.roles).toEqual(mockRoles);
      expect(state.permissionSnapshot).toEqual(mockPermissionSnapshot);
      expect(state.isLoaded).toBe(true);
    });

    it("should replace arrays (not merge) when hydrating", () => {
      // First hydration
      const firstContext: UserContextV2 = {
        user: {
          id: "user-1",
          email: "first@example.com",
          first_name: "First",
          last_name: "User",
          avatar_url: null,
        },
        roles: [
          {
            role_id: "role-1",
            role: "admin",
            org_id: "org-1",
            branch_id: null,
            scope: "org" as const,
            scope_id: "org-1",
          },
        ],
        permissionSnapshot: {
          allow: ["permission.one"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(firstContext);

      // Second hydration - should replace, not merge
      const secondContext: UserContextV2 = {
        user: {
          id: "user-2",
          email: "second@example.com",
          first_name: "Second",
          last_name: "User",
          avatar_url: null,
        },
        roles: [
          {
            role_id: "role-2",
            role: "viewer",
            org_id: "org-2",
            branch_id: null,
            scope: "org" as const,
            scope_id: "org-2",
          },
        ],
        permissionSnapshot: {
          allow: ["permission.two"],
          deny: ["permission.three"],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(secondContext);

      const state = useUserStoreV2.getState();

      expect(state.user?.id).toBe("user-2");
      expect(state.roles).toHaveLength(1);
      expect(state.roles[0].role_id).toBe("role-2");
      expect(state.permissionSnapshot.allow).toEqual(["permission.two"]);
      expect(state.permissionSnapshot.deny).toEqual(["permission.three"]);
    });

    it("should set isLoaded=true and reset to initial state when context is null", () => {
      // First hydrate with data
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [
          {
            role_id: "role-1",
            role: "admin",
            org_id: "org-1",
            branch_id: null,
            scope: "org" as const,
            scope_id: "org-1",
          },
        ],
        permissionSnapshot: {
          allow: ["test.permission"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      // Then hydrate with null
      useUserStoreV2.getState().hydrateFromServer(null);

      const state = useUserStoreV2.getState();

      expect(state.user).toBeNull();
      expect(state.roles).toEqual([]);
      expect(state.permissionSnapshot).toEqual({ allow: [], deny: [] });
      expect(state.isLoaded).toBe(true); // CRITICAL: should be true, not false
    });

    it("should handle context with missing optional fields", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: null,
          last_name: null,
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: { allow: [], deny: [] },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      const state = useUserStoreV2.getState();

      expect(state.user).toEqual(context.user);
      expect(state.roles).toEqual([]);
      expect(state.permissionSnapshot).toEqual({ allow: [], deny: [] });
      expect(state.isLoaded).toBe(true);
    });
  });

  describe("setPermissionSnapshot", () => {
    it("should update permission snapshot without affecting other state", () => {
      // First hydrate with initial data
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [
          {
            role_id: "role-1",
            role: "admin",
            org_id: "org-1",
            branch_id: null,
            scope: "org" as const,
            scope_id: "org-1",
          },
        ],
        permissionSnapshot: {
          allow: ["initial.permission"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      // Update permission snapshot
      const newSnapshot: PermissionSnapshot = {
        allow: ["new.permission.one", "new.permission.two"],
        deny: ["denied.permission"],
      };

      useUserStoreV2.getState().setPermissionSnapshot(newSnapshot);

      const state = useUserStoreV2.getState();

      // Permission snapshot should be updated
      expect(state.permissionSnapshot).toEqual(newSnapshot);

      // Other state should remain unchanged
      expect(state.user).toEqual(context.user);
      expect(state.roles).toEqual(context.roles);
      expect(state.isLoaded).toBe(true);
    });

    it("should replace permission snapshot (not merge)", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: {
          allow: ["old.one", "old.two"],
          deny: ["old.deny"],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      const newSnapshot: PermissionSnapshot = {
        allow: ["new.one"],
        deny: [],
      };

      useUserStoreV2.getState().setPermissionSnapshot(newSnapshot);

      const state = useUserStoreV2.getState();

      expect(state.permissionSnapshot.allow).toEqual(["new.one"]);
      expect(state.permissionSnapshot.deny).toEqual([]);
      expect(state.permissionSnapshot.allow).not.toContain("old.one");
      expect(state.permissionSnapshot.allow).not.toContain("old.two");
    });

    it("should handle empty permission snapshot", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: {
          allow: ["some.permission"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      const emptySnapshot: PermissionSnapshot = {
        allow: [],
        deny: [],
      };

      useUserStoreV2.getState().setPermissionSnapshot(emptySnapshot);

      const state = useUserStoreV2.getState();

      expect(state.permissionSnapshot).toEqual({ allow: [], deny: [] });
    });
  });

  describe("clear", () => {
    it("should reset store to initial state", () => {
      // First hydrate with data
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: "https://example.com/avatar.jpg",
        },
        roles: [
          {
            role_id: "role-1",
            role: "admin",
            org_id: "org-1",
            branch_id: null,
            scope: "org" as const,
            scope_id: "org-1",
          },
        ],
        permissionSnapshot: {
          allow: ["test.permission"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      // Then clear
      useUserStoreV2.getState().clear();

      const state = useUserStoreV2.getState();

      expect(state.user).toBeNull();
      expect(state.roles).toEqual([]);
      expect(state.permissionSnapshot).toEqual({ allow: [], deny: [] });
      expect(state.isLoaded).toBe(false); // CRITICAL: should be false after clear
    });

    it("should be idempotent (clearing twice should have same effect)", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: {
          allow: ["test.permission"],
          deny: [],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);
      useUserStoreV2.getState().clear();

      const stateAfterFirstClear = useUserStoreV2.getState();

      useUserStoreV2.getState().clear();

      const stateAfterSecondClear = useUserStoreV2.getState();

      expect(stateAfterFirstClear).toEqual(stateAfterSecondClear);
    });
  });

  describe("Store Behavior", () => {
    it("should be a Zustand singleton", () => {
      const state1 = useUserStoreV2.getState();
      const state2 = useUserStoreV2.getState();

      expect(state1).toBe(state2); // Same instance (Zustand singleton)
    });

    it("should allow subscribers to react to changes", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: {
          allow: ["test.permission"],
          deny: [],
        },
      };

      let callCount = 0;
      const unsubscribe = useUserStoreV2.subscribe(() => {
        callCount++;
      });

      useUserStoreV2.getState().hydrateFromServer(context);

      expect(callCount).toBeGreaterThan(0);

      unsubscribe();
    });
  });

  describe("Architecture Compliance", () => {
    it("should NOT have any data fetching methods", () => {
      const store = useUserStoreV2.getState();

      // Verify no fetch-like methods exist
      expect(store).not.toHaveProperty("fetchUser");
      expect(store).not.toHaveProperty("loadPermissions");
      expect(store).not.toHaveProperty("refreshRoles");
    });

    it("should use PermissionSnapshot pattern (allow/deny arrays)", () => {
      const context: UserContextV2 = {
        user: {
          id: "user-123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          avatar_url: null,
        },
        roles: [],
        permissionSnapshot: {
          allow: ["warehouse.*"],
          deny: ["warehouse.settings.*"],
        },
      };

      useUserStoreV2.getState().hydrateFromServer(context);

      const state = useUserStoreV2.getState();

      expect(state.permissionSnapshot).toHaveProperty("allow");
      expect(state.permissionSnapshot).toHaveProperty("deny");
      expect(Array.isArray(state.permissionSnapshot.allow)).toBe(true);
      expect(Array.isArray(state.permissionSnapshot.deny)).toBe(true);
    });
  });
});
