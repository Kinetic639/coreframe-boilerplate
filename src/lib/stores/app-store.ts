import { create } from "zustand";
import type { Tables } from "../../../supabase/types/types";
import { UserLocation } from "../types";

// 🔸 Typ jednego modułu użytkownika
export type LoadedUserModule = {
  id: string;
  slug: string;
  label: string;
  settings: Record<string, unknown>;
};

// 🔸 Type for branch that works with both branches and branch_profiles
export type BranchData = Tables<"branches"> & {
  branch_id: string; // For compatibility with existing code
  bio?: string | null;
  logo_url?: string | null;
  website?: string | null;
};

// 🔹 Typ contextu aplikacji (dane z loadAppContextServer)
export type AppContext = {
  activeOrg: Tables<"organization_profiles"> | null;
  activeBranch: BranchData | null;
  activeOrgId: string | null;
  activeBranchId: string | null;
  availableBranches: BranchData[];
  userModules: LoadedUserModule[];
  location: UserLocation | null;
  locations: Tables<"locations">[];
};

// 🧠 Zustand store
type AppStore = AppContext & {
  isLoaded: boolean;
  setContext: (context: AppContext) => void;
  setLocation: (location: UserLocation | null) => void;
  setLocations: (locations: Tables<"locations">[]) => void;
  updateAvailableBranches: (branches: BranchData[]) => void;
  setActiveBranch: (branchId: string) => void;
  clear: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  activeOrg: null,
  activeBranch: null,
  activeOrgId: null,
  activeBranchId: null,
  availableBranches: [],
  userModules: [],
  isLoaded: false,
  location: null,
  locations: [],

  setContext: (context) =>
    set({
      ...context,
      isLoaded: true,
    }),
  setLocation: (location) => set({ location }),

  setLocations: (locations) => set({ locations }),

  updateAvailableBranches: (branches) =>
    set((state) => ({
      availableBranches: branches,
      // Update active branch if it exists in the new list
      activeBranch:
        branches.find((b) => b.branch_id === state.activeBranchId) || state.activeBranch,
    })),

  setActiveBranch: (branchId) =>
    set((state) => ({
      activeBranchId: branchId,
      activeBranch: state.availableBranches.find((b) => b.branch_id === branchId) || null,
      // Clear locations when branch changes - they will be reloaded
      locations: [],
    })),

  clear: () =>
    set({
      activeOrg: null,
      activeBranch: null,
      activeOrgId: null,
      activeBranchId: null,
      availableBranches: [],
      userModules: [],
      isLoaded: false,
      location: null,
      locations: [],
    }),
}));
