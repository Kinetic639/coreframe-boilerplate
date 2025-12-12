import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getAvailableContextsAction,
  getContextsWithAccessAction,
  getSystemContextsAction,
  getOrganizationContextsAction,
  createCustomContextAction,
  updateContextConfigurationAction,
  deleteContextAction,
  getContextFieldVisibilityAction,
  setFieldVisibilityAction,
  getContextByNameAction,
  isContextApiEnabledAction,
  getApiEnabledContextsAction,
  cloneSystemContextAction,
} from "@/app/[locale]/dashboard/warehouse/settings/contexts/_actions";
import type {
  CreateCustomContextInput,
  UpdateContextConfigurationInput,
  SetFieldVisibilityInput,
  CloneSystemContextInput,
  ContextFilters,
} from "@/server/schemas/context.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const contextsKeys = {
  all: ["contexts"] as const,
  lists: () => [...contextsKeys.all, "list"] as const,
  available: (includeSystem: boolean) =>
    [...contextsKeys.lists(), "available", includeSystem] as const,
  withAccess: (tier?: string) => [...contextsKeys.lists(), "with-access", tier] as const,
  system: () => [...contextsKeys.lists(), "system"] as const,
  organization: (filters?: ContextFilters) =>
    [...contextsKeys.lists(), "organization", filters] as const,
  apiEnabled: () => [...contextsKeys.lists(), "api-enabled"] as const,
  details: () => [...contextsKeys.all, "detail"] as const,
  detail: (id: string) => [...contextsKeys.details(), id] as const,
  byName: (name: string) => [...contextsKeys.details(), "by-name", name] as const,
  fieldVisibility: (contextId: string) =>
    [...contextsKeys.all, "field-visibility", contextId] as const,
  apiStatus: (contextId: string) => [...contextsKeys.all, "api-status", contextId] as const,
};

// ==========================================
// CONTEXT QUERIES
// ==========================================

/**
 * Hook to fetch all available contexts
 */
export function useAvailableContexts(includeSystemContexts = true) {
  return useQuery({
    queryKey: contextsKeys.available(includeSystemContexts),
    queryFn: async () => {
      const result = await getAvailableContextsAction(includeSystemContexts);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch contexts with access information
 */
export function useContextsWithAccess(userSubscriptionTier?: string) {
  return useQuery({
    queryKey: contextsKeys.withAccess(userSubscriptionTier),
    queryFn: async () => {
      const result = await getContextsWithAccessAction(userSubscriptionTier);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch all system contexts
 */
export function useSystemContexts() {
  return useQuery({
    queryKey: contextsKeys.system(),
    queryFn: async () => {
      const result = await getSystemContextsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - system contexts rarely change
  });
}

/**
 * Hook to fetch organization contexts
 */
export function useOrganizationContexts(filters?: ContextFilters) {
  return useQuery({
    queryKey: contextsKeys.organization(filters),
    queryFn: async () => {
      const result = await getOrganizationContextsAction(filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch API-enabled contexts
 */
export function useApiEnabledContexts() {
  return useQuery({
    queryKey: contextsKeys.apiEnabled(),
    queryFn: async () => {
      const result = await getApiEnabledContextsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a context by name
 */
export function useContextByName(name: string | null) {
  return useQuery({
    queryKey: contextsKeys.byName(name || ""),
    queryFn: async () => {
      if (!name) {
        throw new Error("Context name is required");
      }

      const result = await getContextByNameAction(name);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!name,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to check if a context has API enabled
 */
export function useIsContextApiEnabled(contextId: string | null) {
  return useQuery({
    queryKey: contextsKeys.apiStatus(contextId || ""),
    queryFn: async () => {
      if (!contextId) {
        throw new Error("Context ID is required");
      }

      const result = await isContextApiEnabledAction(contextId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!contextId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// FIELD VISIBILITY QUERIES
// ==========================================

/**
 * Hook to fetch field visibility rules for a context
 */
export function useContextFieldVisibility(contextId: string | null) {
  return useQuery({
    queryKey: contextsKeys.fieldVisibility(contextId || ""),
    queryFn: async () => {
      if (!contextId) {
        throw new Error("Context ID is required");
      }

      const result = await getContextFieldVisibilityAction(contextId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!contextId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// CONTEXT MUTATIONS
// ==========================================

/**
 * Hook to create a custom context
 */
export function useCreateCustomContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateCustomContextInput, "organization_id">) => {
      const result = await createCustomContextAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextsKeys.lists() });
      toast.success("Custom context created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create custom context");
    },
  });
}

/**
 * Hook to update a context configuration
 */
export function useUpdateContextConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contextId,
      input,
    }: {
      contextId: string;
      input: UpdateContextConfigurationInput;
    }) => {
      const result = await updateContextConfigurationAction(contextId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contextsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contextsKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: contextsKeys.apiStatus(data.id) });
      toast.success("Context configuration updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update context configuration");
    },
  });
}

/**
 * Hook to delete a context
 */
export function useDeleteContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contextId: string) => {
      const result = await deleteContextAction(contextId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, contextId) => {
      queryClient.invalidateQueries({ queryKey: contextsKeys.lists() });
      queryClient.removeQueries({ queryKey: contextsKeys.detail(contextId) });
      queryClient.removeQueries({ queryKey: contextsKeys.fieldVisibility(contextId) });
      queryClient.removeQueries({ queryKey: contextsKeys.apiStatus(contextId) });
      toast.success("Context deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete context");
    },
  });
}

/**
 * Hook to clone a system context
 */
export function useCloneSystemContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CloneSystemContextInput, "organization_id">) => {
      const result = await cloneSystemContextAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextsKeys.lists() });
      toast.success("System context cloned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clone system context");
    },
  });
}

// ==========================================
// FIELD VISIBILITY MUTATIONS
// ==========================================

/**
 * Hook to set field visibility rule
 */
export function useSetFieldVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetFieldVisibilityInput) => {
      const result = await setFieldVisibilityAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: contextsKeys.fieldVisibility(data.context_id) });
      toast.success("Field visibility rule updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to set field visibility rule");
    },
  });
}
