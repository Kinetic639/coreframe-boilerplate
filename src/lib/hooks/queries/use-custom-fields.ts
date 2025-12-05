import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getFieldDefinitionsAction,
  createFieldDefinitionAction,
  updateFieldDefinitionAction,
  deleteFieldDefinitionAction,
  reorderFieldDefinitionsAction,
  getProductFieldValuesAction,
  getVariantFieldValuesAction,
  setFieldValueAction,
  deleteFieldValueAction,
  getProductFieldValuesWithDefinitionsAction,
} from "@/app/[locale]/dashboard/warehouse/settings/custom-fields/_actions";
import type {
  CreateFieldDefinitionInput,
  UpdateFieldDefinitionInput,
  ReorderFieldDefinitionsInput,
  CreateFieldValueInput,
} from "@/server/schemas/custom-fields.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const customFieldsKeys = {
  all: ["custom-fields"] as const,
  definitions: () => [...customFieldsKeys.all, "definitions"] as const,
  productValues: (productId: string) =>
    [...customFieldsKeys.all, "product-values", productId] as const,
  variantValues: (variantId: string) =>
    [...customFieldsKeys.all, "variant-values", variantId] as const,
  productValuesWithDefinitions: (productId: string) =>
    [...customFieldsKeys.all, "product-values-with-definitions", productId] as const,
};

// ==========================================
// FIELD DEFINITIONS QUERIES
// ==========================================

/**
 * Hook to fetch all field definitions for the organization
 */
export function useFieldDefinitions() {
  return useQuery({
    queryKey: customFieldsKeys.definitions(),
    queryFn: async () => {
      const result = await getFieldDefinitionsAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==========================================
// FIELD VALUES QUERIES
// ==========================================

/**
 * Hook to fetch field values for a product
 */
export function useProductFieldValues(productId: string | null) {
  return useQuery({
    queryKey: customFieldsKeys.productValues(productId || ""),
    queryFn: async () => {
      if (!productId) {
        throw new Error("Product ID is required");
      }

      const result = await getProductFieldValuesAction(productId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch field values for a variant
 */
export function useVariantFieldValues(variantId: string | null) {
  return useQuery({
    queryKey: customFieldsKeys.variantValues(variantId || ""),
    queryFn: async () => {
      if (!variantId) {
        throw new Error("Variant ID is required");
      }

      const result = await getVariantFieldValuesAction(variantId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!variantId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch product field values with their definitions
 */
export function useProductFieldValuesWithDefinitions(productId: string | null) {
  return useQuery({
    queryKey: customFieldsKeys.productValuesWithDefinitions(productId || ""),
    queryFn: async () => {
      if (!productId) {
        throw new Error("Product ID is required");
      }

      const result = await getProductFieldValuesWithDefinitionsAction(productId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// FIELD DEFINITIONS MUTATIONS
// ==========================================

/**
 * Hook to create a new field definition
 */
export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateFieldDefinitionInput, "organization_id">) => {
      const result = await createFieldDefinitionAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.definitions() });
      toast.success("Field definition created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create field definition");
    },
  });
}

/**
 * Hook to update an existing field definition
 */
export function useUpdateFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      definitionId,
      input,
    }: {
      definitionId: string;
      input: UpdateFieldDefinitionInput;
    }) => {
      const result = await updateFieldDefinitionAction(definitionId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.definitions() });
      toast.success("Field definition updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update field definition");
    },
  });
}

/**
 * Hook to delete a field definition
 */
export function useDeleteFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (definitionId: string) => {
      const result = await deleteFieldDefinitionAction(definitionId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.definitions() });
      toast.success("Field definition deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete field definition");
    },
  });
}

/**
 * Hook to reorder field definitions
 */
export function useReorderFieldDefinitions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: ReorderFieldDefinitionsInput) => {
      const result = await reorderFieldDefinitionsAction(updates);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldsKeys.definitions() });
      toast.success("Field definitions reordered successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reorder field definitions");
    },
  });
}

// ==========================================
// FIELD VALUES MUTATIONS
// ==========================================

/**
 * Hook to set a field value
 */
export function useSetFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFieldValueInput) => {
      const result = await setFieldValueAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries based on product or variant
      if (data.product_id) {
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.productValues(data.product_id),
        });
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.productValuesWithDefinitions(data.product_id),
        });
      }
      if (data.variant_id) {
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.variantValues(data.variant_id),
        });
      }
      toast.success("Field value saved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save field value");
    },
  });
}

/**
 * Hook to delete a field value
 */
export function useDeleteFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fieldValueId,
      productId,
      variantId,
    }: {
      fieldValueId: string;
      productId?: string;
      variantId?: string;
    }) => {
      const result = await deleteFieldValueAction(fieldValueId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return { productId, variantId };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      if (data.productId) {
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.productValues(data.productId),
        });
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.productValuesWithDefinitions(data.productId),
        });
      }
      if (data.variantId) {
        queryClient.invalidateQueries({
          queryKey: customFieldsKeys.variantValues(data.variantId),
        });
      }
      toast.success("Field value deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete field value");
    },
  });
}
