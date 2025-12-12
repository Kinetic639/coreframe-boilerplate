import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getSystemTemplatesAction,
  getOrganizationTemplatesAction,
  getAllTemplatesAction,
  getTemplateAction,
  createTemplateAction,
  updateTemplateAction,
  cloneTemplateAction,
  deleteTemplateAction,
} from "@/app/[locale]/dashboard/warehouse/settings/templates/_actions";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CloneTemplateInput,
} from "@/server/schemas/templates.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const templatesKeys = {
  all: ["templates"] as const,
  lists: () => [...templatesKeys.all, "list"] as const,
  systemTemplates: () => [...templatesKeys.lists(), "system"] as const,
  organizationTemplates: () => [...templatesKeys.lists(), "organization"] as const,
  allTemplates: () => [...templatesKeys.lists(), "all"] as const,
  details: () => [...templatesKeys.all, "detail"] as const,
  detail: (id: string) => [...templatesKeys.details(), id] as const,
};

// ==========================================
// TEMPLATES QUERIES
// ==========================================

/**
 * Hook to fetch all system templates
 */
export function useSystemTemplates() {
  return useQuery({
    queryKey: templatesKeys.systemTemplates(),
    queryFn: async () => {
      const result = await getSystemTemplatesAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - system templates rarely change
  });
}

/**
 * Hook to fetch organization templates
 */
export function useOrganizationTemplates() {
  return useQuery({
    queryKey: templatesKeys.organizationTemplates(),
    queryFn: async () => {
      const result = await getOrganizationTemplatesAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all templates (system + organization)
 */
export function useAllTemplates() {
  return useQuery({
    queryKey: templatesKeys.allTemplates(),
    queryFn: async () => {
      const result = await getAllTemplatesAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single template by ID
 */
export function useTemplate(templateId: string | null) {
  return useQuery({
    queryKey: templatesKeys.detail(templateId || ""),
    queryFn: async () => {
      if (!templateId) {
        throw new Error("Template ID is required");
      }

      const result = await getTemplateAction(templateId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!templateId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// TEMPLATES MUTATIONS
// ==========================================

/**
 * Hook to create a new template
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const result = await createTemplateAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      toast.success("Template created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create template");
    },
  });
}

/**
 * Hook to update an existing template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      input,
    }: {
      templateId: string;
      input: UpdateTemplateInput;
    }) => {
      const result = await updateTemplateAction(templateId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(data.id) });
      toast.success("Template updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update template");
    },
  });
}

/**
 * Hook to clone a template
 */
export function useCloneTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CloneTemplateInput) => {
      const result = await cloneTemplateAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      toast.success("Template cloned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clone template");
    },
  });
}

/**
 * Hook to delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const result = await deleteTemplateAction(templateId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.removeQueries({ queryKey: templatesKeys.detail(templateId) });
      toast.success("Template deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });
}
