import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getOrganizationAction,
  updateOrganizationAction,
  getBranchesAction,
  getBranchAction,
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
} from "@/app/[locale]/dashboard/organization/_actions";
import type {
  CreateBranchInput,
  UpdateBranchInput,
  UpdateOrganizationInput,
} from "@/server/schemas/organization.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const organizationKeys = {
  all: ["organization"] as const,
  detail: () => [...organizationKeys.all, "detail"] as const,
  branches: () => [...organizationKeys.all, "branches"] as const,
  branchDetail: (id: string) => [...organizationKeys.branches(), id] as const,
};

// ==========================================
// ORGANIZATION QUERIES
// ==========================================

/**
 * Hook to fetch organization details
 */
export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.detail(),
    queryFn: async () => {
      const result = await getOrganizationAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all branches
 */
export function useBranches() {
  return useQuery({
    queryKey: organizationKeys.branches(),
    queryFn: async () => {
      const result = await getBranchesAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single branch by ID
 */
export function useBranch(branchId: string | null) {
  return useQuery({
    queryKey: organizationKeys.branchDetail(branchId || ""),
    queryFn: async () => {
      if (!branchId) {
        throw new Error("Branch ID is required");
      }

      const result = await getBranchAction(branchId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// ORGANIZATION MUTATIONS
// ==========================================

/**
 * Hook to update organization profile
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const result = await updateOrganizationAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail() });
      toast.success("Organization updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update organization");
    },
  });
}

// ==========================================
// BRANCH MUTATIONS
// ==========================================

/**
 * Hook to create a new branch
 */
export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateBranchInput, "organization_id">) => {
      const result = await createBranchAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      toast.success("Branch created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create branch");
    },
  });
}

/**
 * Hook to update a branch
 */
export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ branchId, input }: { branchId: string; input: UpdateBranchInput }) => {
      const result = await updateBranchAction(branchId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      queryClient.invalidateQueries({ queryKey: organizationKeys.branchDetail(data.id) });
      toast.success("Branch updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update branch");
    },
  });
}

/**
 * Hook to delete a branch
 */
export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branchId: string) => {
      const result = await deleteBranchAction(branchId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, branchId) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      queryClient.removeQueries({ queryKey: organizationKeys.branchDetail(branchId) });
      toast.success("Branch deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete branch");
    },
  });
}
