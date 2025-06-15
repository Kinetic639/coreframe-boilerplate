import { create } from "zustand";
import type { Tables } from "../../../supabase/types/types";

// 🔸 Typ jednego modułu użytkownika
export type LoadedUserModule = {
  id: string;
  slug: string;
  label: string;
  settings: Record<string, unknown>;
};

// 🔹 Typ contextu aplikacji (dane z loadAppContextServer)
export type AppContext = {
  activeOrg: Tables<"organization_profiles"> | null;
  activeBranch: Tables<"branch_profiles"> | null;
  activeOrgId: string | null;
  activeBranchId: string | null;
  availableBranches: Tables<"branch_profiles">[];
  userModules: LoadedUserModule[];
};

// 🧠 Zustand store
type AppStore = AppContext & {
  isLoaded: boolean;
  setContext: (context: AppContext) => void;
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

  setContext: (context) =>
    set({
      ...context,
      isLoaded: true,
    }),

  clear: () =>
    set({
      activeOrg: null,
      activeBranch: null,
      activeOrgId: null,
      activeBranchId: null,
      availableBranches: [],
      userModules: [],
      isLoaded: false,
    }),
}));
