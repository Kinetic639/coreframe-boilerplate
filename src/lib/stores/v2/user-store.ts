import { create } from "zustand";
import type { JWTRole } from "@/lib/types/auth";
import type { PermissionSnapshot } from "@/lib/types/permissions";

// Types
export interface UserV2 {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface UserContextV2 {
  user: UserV2 | null;
  roles: JWTRole[];
  permissionSnapshot: PermissionSnapshot; // Snapshot with allow/deny for proper wildcard + deny semantics
}

// Store State
interface UserStoreV2State {
  user: UserV2 | null;
  roles: JWTRole[];
  permissionSnapshot: PermissionSnapshot; // Snapshot with allow/deny for proper wildcard + deny semantics
  isLoaded: boolean;
}

// Store Actions
interface UserStoreV2Actions {
  hydrateFromServer: (context: UserContextV2 | null) => void;
  setPermissionSnapshot: (snapshot: PermissionSnapshot) => void; // NEW: For reactive updates from PermissionsSync
  clear: () => void;
}

// Initial State
const initialState: UserStoreV2State = {
  user: null,
  roles: [],
  permissionSnapshot: { allow: [], deny: [] },
  isLoaded: false,
};

// Store
export const useUserStoreV2 = create<UserStoreV2State & UserStoreV2Actions>((set) => ({
  ...initialState,

  hydrateFromServer: (context: UserContextV2 | null) => {
    if (!context) {
      set({ ...initialState, isLoaded: true });
      return;
    }

    set({
      user: context.user,
      roles: context.roles || [],
      permissionSnapshot: context.permissionSnapshot || { allow: [], deny: [] },
      isLoaded: true,
    });
  },

  // NEW: Update permission snapshot (NO fetching, dumb setter)
  // Called by PermissionsSync component when React Query detects branch change
  setPermissionSnapshot: (snapshot: PermissionSnapshot) => {
    set({ permissionSnapshot: snapshot });
  },

  clear: () => {
    set(initialState);
  },
}));
