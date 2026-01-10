import { create } from "zustand";

// Types - Minimal snapshots only
export interface BranchDataV2 {
  id: string; // UUID - this is the primary key
  name: string;
  organization_id: string;
  slug: string | null;
  created_at: string;
}

export interface LoadedUserModuleV2 {
  id: string;
  slug: string;
  label: string;
  settings: Record<string, any>;
}

// Minimal org snapshot (normalized from DB)
export interface ActiveOrgV2 {
  id: string; // Normalized from DB organization_id
  name: string;
  slug: string;
}

export interface AppContextV2 {
  activeOrgId: string | null;
  activeBranchId: string | null;
  activeOrg: ActiveOrgV2 | null;
  activeBranch: BranchDataV2 | null;
  availableBranches: BranchDataV2[];
  userModules: LoadedUserModuleV2[];
  // ❌ NO subscription field
}

// Store State
interface AppStoreV2State {
  activeOrgId: string | null;
  activeBranchId: string | null;
  activeOrg: ActiveOrgV2 | null;
  activeBranch: BranchDataV2 | null;
  availableBranches: BranchDataV2[];
  userModules: LoadedUserModuleV2[];
  isLoaded: boolean;
}

// Store Actions
interface AppStoreV2Actions {
  hydrateFromServer: (context: AppContextV2 | null) => void;
  setActiveBranch: (branchId: string) => void;
  clear: () => void;
}

// Initial State
const initialState: AppStoreV2State = {
  activeOrgId: null,
  activeBranchId: null,
  activeOrg: null,
  activeBranch: null,
  availableBranches: [],
  userModules: [],
  isLoaded: false,
};

// Store
export const useAppStoreV2 = create<AppStoreV2State & AppStoreV2Actions>((set, get) => ({
  ...initialState,

  hydrateFromServer: (context: AppContextV2 | null) => {
    if (!context) {
      set({ ...initialState, isLoaded: true });
      return;
    }

    set({
      activeOrgId: context.activeOrgId,
      activeBranchId: context.activeBranchId,
      activeOrg: context.activeOrg,
      activeBranch: context.activeBranch,
      availableBranches: context.availableBranches || [],
      userModules: context.userModules || [],
      isLoaded: true,
    });
  },

  setActiveBranch: (branchId: string) => {
    const state = get();
    const branch = state.availableBranches.find((b) => b.id === branchId);

    set({
      activeBranchId: branchId,
      activeBranch: branch || null,
    });

    // CRITICAL: Store ONLY updates IDs. NO fetching, NO auto-loading!
    // React Query hooks detect activeBranchId change via query keys and refetch automatically
    // PermissionsSync component syncs new permissions snapshot into user store
  },

  clear: () => {
    set(initialState);
  },
}));
