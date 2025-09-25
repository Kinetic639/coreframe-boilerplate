import { create } from "zustand";
import type { Tables } from "../../../supabase/types/types";
import { UserLocation } from "../types";
import { createClient } from "@/utils/supabase/client";
import type { OrganizationSubscriptionWithPlan } from "@/lib/services/subscription-service";

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

// 🔸 Type for organization user with role and branch info
export type OrganizationUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  default_branch_id: string | null;
  role: {
    name: string;
    color: string | null;
  } | null;
  branch: {
    name: string;
    id: string;
  } | null;
};

// 🔸 Type for private contacts (could be external users or saved contacts)
export type PrivateContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  organization?: string | null;
  notes?: string | null;
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
  suppliers: Tables<"suppliers">[];
  productTemplates: Tables<"product_templates">[];
  organizationUsers: OrganizationUser[];
  privateContacts: PrivateContact[];
  subscription: OrganizationSubscriptionWithPlan | null;
};

// 🧠 Zustand store
type AppStore = AppContext & {
  isLoaded: boolean;
  isLoadingLocations: boolean;
  isLoadingSuppliers: boolean;
  isLoadingUsers: boolean;
  setContext: (context: AppContext) => void;
  setLocation: (location: UserLocation | null) => void;
  setLocations: (locations: Tables<"locations">[]) => void;
  setSuppliers: (suppliers: Tables<"suppliers">[]) => void;
  setProductTemplates: (productTemplates: Tables<"product_templates">[]) => void;
  setOrganizationUsers: (users: OrganizationUser[]) => void;
  setPrivateContacts: (contacts: PrivateContact[]) => void;
  updateAvailableBranches: (branches: BranchData[]) => void;
  setActiveBranch: (branchId: string) => void;
  loadBranchData: (branchId: string) => Promise<void>;
  loadOrganizationUsers: () => Promise<void>;
  clear: () => void;
};

export const useAppStore = create<AppStore>((set, get) => ({
  activeOrg: null,
  activeBranch: null,
  activeOrgId: null,
  activeBranchId: null,
  availableBranches: [],
  userModules: [],
  isLoaded: false,
  isLoadingLocations: false,
  isLoadingSuppliers: false,
  isLoadingUsers: false,
  location: null,
  locations: [],
  suppliers: [],
  productTemplates: [],
  organizationUsers: [],
  privateContacts: [],
  subscription: null,

  setContext: (context) =>
    set({
      ...context,
      isLoaded: true,
    }),
  setLocation: (location) => set({ location }),

  setLocations: (locations) => set({ locations }),

  setSuppliers: (suppliers) => set({ suppliers }),

  setProductTemplates: (productTemplates) => set({ productTemplates }),

  setOrganizationUsers: (users) => set({ organizationUsers: users }),

  setPrivateContacts: (contacts) => set({ privateContacts: contacts }),

  updateAvailableBranches: (branches) =>
    set((state) => ({
      availableBranches: branches,
      // Update active branch if it exists in the new list
      activeBranch:
        branches.find((b) => b.branch_id === state.activeBranchId) || state.activeBranch,
    })),

  setActiveBranch: async (branchId) => {
    const state = get();
    const branch = state.availableBranches.find((b) => b.branch_id === branchId);

    set({
      activeBranchId: branchId,
      activeBranch: branch || null,
      // Clear branch-specific data when branch changes
      locations: [],
    });

    // Auto-load branch-specific data
    if (branchId) {
      const store = get();
      store.loadBranchData(branchId);
    }
  },

  loadBranchData: async (branchId: string) => {
    if (!branchId) return;

    const supabase = createClient();

    // Load locations for the branch
    set({ isLoadingLocations: true });
    try {
      const { data: locations, error: locationsError } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (locationsError) {
        console.error("Error loading locations:", locationsError);
      } else {
        set({ locations: locations || [] });
      }
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      set({ isLoadingLocations: false });
    }

    // Load suppliers for the organization (suppliers are org-level, not branch-level)
    const state = get();
    if (state.activeOrgId) {
      set({ isLoadingSuppliers: true });
      try {
        const { data: suppliers, error: suppliersError } = await supabase
          .from("suppliers")
          .select("*")
          .eq("organization_id", state.activeOrgId)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        const { data: productTemplates, error: productTemplatesError } = await supabase
          .from("product_templates")
          .select("*")
          .or(`organization_id.eq.${state.activeOrgId},is_system.eq.true`)
          .is("deleted_at", null)
          .order("name", { ascending: true });

        if (suppliersError) {
          console.error("Error loading suppliers:", suppliersError);
        } else {
          set({ suppliers: suppliers || [] });
        }

        if (productTemplatesError) {
          console.error("Error loading product templates:", productTemplatesError);
        } else {
          set({ productTemplates: productTemplates || [] });
        }
      } catch (error) {
        console.error("Error loading org data:", error);
      } finally {
        set({ isLoadingSuppliers: false });
      }
    }
  },

  loadOrganizationUsers: async () => {
    const state = get();
    if (!state.activeOrgId) return;

    set({ isLoadingUsers: true });
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_organization_users_mvp", {
        org_id: state.activeOrgId,
      });

      if (error) {
        console.error("Error fetching organization users:", error);
        set({ organizationUsers: [] });
      } else {
        set({ organizationUsers: data || [] });
      }
    } catch (error) {
      console.error("Error loading organization users:", error);
      set({ organizationUsers: [] });
    } finally {
      set({ isLoadingUsers: false });
    }
  },

  clear: () =>
    set({
      activeOrg: null,
      activeBranch: null,
      activeOrgId: null,
      activeBranchId: null,
      availableBranches: [],
      userModules: [],
      isLoaded: false,
      isLoadingLocations: false,
      isLoadingSuppliers: false,
      isLoadingUsers: false,
      location: null,
      locations: [],
      suppliers: [],
      organizationUsers: [],
      privateContacts: [],
    }),
}));
