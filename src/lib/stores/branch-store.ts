import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Tables } from "@/lib/types";
import { mockBranches, getLocationsByBranch } from "@/lib/mock/branches";

interface BranchState {
  activeBranchId: string;
  branches: Tables<"branches">[];
  _hasHydrated: boolean;
  setActiveBranch: (branchId: string) => void;
  getActiveBranch: () => Tables<"branches"> | undefined;
  getActiveBranchLocations: () => Tables<"locations">[];
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      activeBranchId: "550e8400-e29b-41d4-a716-446655440001", // Default to Warsaw main branch
      branches: mockBranches,
      _hasHydrated: false,

      setActiveBranch: (branchId: string) => {
        set({ activeBranchId: branchId });
      },

      getActiveBranch: () => {
        const { activeBranchId, branches } = get();
        return branches.find((branch) => branch.id === activeBranchId);
      },

      getActiveBranchLocations: () => {
        const { activeBranchId } = get();
        return getLocationsByBranch(activeBranchId);
      },

      setHasHydrated: (hasHydrated: boolean) => {
        set({ _hasHydrated: hasHydrated });
      },
    }),
    {
      name: "branch-storage",
      partialize: (state) => ({ activeBranchId: state.activeBranchId }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
