import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOptionGroups,
  getOptionGroup,
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionValue,
  updateOptionValue,
  deleteOptionValue,
} from "@/app/[locale]/dashboard/warehouse/settings/_actions";
import { toast } from "react-toastify";
import type {
  CreateOptionGroupInput,
  UpdateOptionGroupInput,
} from "@/server/schemas/option-groups.schema";

// Type guard for action responses
type ActionResponse<T> = { success: true; data: T } | { success: false; error: string };

function isErrorResponse<T>(
  response: ActionResponse<T>
): response is { success: false; error: string } {
  return !response.success;
}

export const optionGroupsKeys = {
  all: ["option-groups"] as const,
  lists: () => [...optionGroupsKeys.all, "list"] as const,
  list: () => [...optionGroupsKeys.lists()] as const,
  details: () => [...optionGroupsKeys.all, "detail"] as const,
  detail: (id: string) => [...optionGroupsKeys.details(), id] as const,
};

export function useOptionGroups() {
  return useQuery({
    queryKey: optionGroupsKeys.list(),
    queryFn: async () => {
      const result = await getOptionGroups();
      if (isErrorResponse(result)) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}

export function useOptionGroup(groupId: string | null) {
  return useQuery({
    queryKey: optionGroupsKeys.detail(groupId || ""),
    queryFn: async () => {
      if (!groupId) return null;
      const result = await getOptionGroup(groupId);
      if (isErrorResponse(result)) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!groupId,
  });
}

export function useCreateOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOptionGroupInput) => createOptionGroup(input),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      toast.success("Option group created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create option group");
    },
  });
}

export function useUpdateOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOptionGroupInput) => updateOptionGroup(input),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.details() });
      toast.success("Option group updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update option group");
    },
  });
}

export function useDeleteOptionGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => deleteOptionGroup(groupId),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      toast.success("Option group deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete option group");
    },
  });
}

export function useCreateOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { option_group_id: string; value: string; display_order: number }) =>
      createOptionValue(input),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.details() });
      toast.success("Value added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add value");
    },
  });
}

export function useUpdateOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; value: string }) => updateOptionValue(input),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.details() });
      toast.success("Value updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update value");
    },
  });
}

export function useDeleteOptionValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (valueId: string) => deleteOptionValue(valueId),
    onSuccess: (result) => {
      if (isErrorResponse(result)) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: optionGroupsKeys.details() });
      toast.success("Value deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete value");
    },
  });
}
