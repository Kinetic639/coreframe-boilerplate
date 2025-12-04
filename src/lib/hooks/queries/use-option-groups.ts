import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getOptionGroupsAction,
  getOptionGroupAction,
  createOptionGroupAction,
  updateOptionGroupAction,
  deleteOptionGroupAction,
  getOptionValuesAction,
  createOptionValueAction,
  updateOptionValueAction,
  deleteOptionValueAction,
} from "@/app/[locale]/dashboard/warehouse/settings/option-groups/_actions";
import type {
  CreateOptionGroupInput,
  UpdateOptionGroupInput,
  CreateOptionValueInput,
  UpdateOptionValueInput,
} from "@/server/schemas/option-groups.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const optionGroupsKeys = {
  all: ["option-groups"] as const,
  lists: () => [...optionGroupsKeys.all, "list"] as const,
  list: () => [...optionGroupsKeys.lists()] as const,
  details: () => [...optionGroupsKeys.all, "detail"] as const,
  detail: (id: string) => [...optionGroupsKeys.details(), id] as const,
  values: (groupId: string) => [...optionGroupsKeys.all, "values", groupId] as const,
};

// ==========================================
// OPTION GROUPS QUERIES
// ==========================================

/**
 * Hook to fetch all option groups for the organization
 */
export function useOptionGroups() {
  return useQuery({
    queryKey: optionGroupsKeys.list(),
    queryFn: async () => {
      const result = await getOptionGroupsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single option group by ID
 */
export function useOptionGroup(groupId: string | null) {
  return useQuery({
    queryKey: optionGroupsKeys.detail(groupId || ""),
    queryFn: async () => {
      if (!groupId) {
        throw new Error("Option group ID is required");
      }

      const result = await getOptionGroupAction(groupId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch option values for a group
 */
export function useOptionValues(groupId: string | null) {
  return useQuery({
    queryKey: optionGroupsKeys.values(groupId || ""),
    queryFn: async () => {
      if (!groupId) {
        throw new Error("Option group ID is required");
      }

      const result = await getOptionValuesAction(groupId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// OPTION GROUPS MUTATIONS
// ==========================================

/**
 * Hook to create a new option group
 */
export function useCreateOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateOptionGroupInput, "organization_id">) => {
      const result = await createOptionGroupAction(input as CreateOptionGroupInput);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      toast.success("Option group created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create option group");
    },
  });
}

/**
 * Hook to update an existing option group
 */
export function useUpdateOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOptionGroupInput) => {
      const result = await updateOptionGroupAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.detail(data.id) });
      toast.success("Option group updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update option group");
    },
  });
}

/**
 * Hook to delete an option group
 */
export function useDeleteOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const result = await deleteOptionGroupAction(groupId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, groupId) => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.removeQueries({ queryKey: optionGroupsKeys.detail(groupId) });
      toast.success("Option group deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete option group");
    },
  });
}

// ==========================================
// OPTION VALUES MUTATIONS
// ==========================================

/**
 * Hook to create a new option value
 */
export function useCreateOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOptionValueInput) => {
      const result = await createOptionValueAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.values(data.option_group_id) });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.detail(data.option_group_id) });
      toast.success("Option value created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create option value");
    },
  });
}

/**
 * Hook to update an existing option value
 */
export function useUpdateOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOptionValueInput) => {
      const result = await updateOptionValueAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.values(data.option_group_id) });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.detail(data.option_group_id) });
      toast.success("Option value updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update option value");
    },
  });
}

/**
 * Hook to delete an option value
 */
export function useDeleteOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ valueId, groupId }: { valueId: string; groupId: string }) => {
      const result = await deleteOptionValueAction(valueId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return { valueId, groupId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.values(data.groupId) });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.detail(data.groupId) });
      toast.success("Option value deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete option value");
    },
  });
}
