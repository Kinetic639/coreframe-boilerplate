"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { CustomFieldsService } from "@/server/services/custom-fields.service";
import {
  createFieldDefinitionSchema,
  updateFieldDefinitionSchema,
  reorderFieldDefinitionsSchema,
  createFieldValueSchema,
  type CreateFieldDefinitionInput,
  type UpdateFieldDefinitionInput,
  type ReorderFieldDefinitionsInput,
  type CreateFieldValueInput,
} from "@/server/schemas/custom-fields.schema";

// ==========================================
// FIELD DEFINITIONS ACTIONS
// ==========================================

/**
 * Get all custom field definitions for the organization
 */
export async function getFieldDefinitionsAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const definitions = await CustomFieldsService.getFieldDefinitions(supabase, organizationId);

    return { success: true, data: definitions };
  } catch (error) {
    console.error("[getFieldDefinitionsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch field definitions",
    };
  }
}

/**
 * Create a new custom field definition
 */
export async function createFieldDefinitionAction(
  input: Omit<CreateFieldDefinitionInput, "organization_id">
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = createFieldDefinitionSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const definition = await CustomFieldsService.createFieldDefinition(supabase, validatedInput);

    return { success: true, data: definition };
  } catch (error) {
    console.error("[createFieldDefinitionAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create field definition",
    };
  }
}

/**
 * Update a custom field definition
 */
export async function updateFieldDefinitionAction(
  definitionId: string,
  input: UpdateFieldDefinitionInput
) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateFieldDefinitionSchema.parse(input);

    const definition = await CustomFieldsService.updateFieldDefinition(
      supabase,
      definitionId,
      validatedInput
    );

    return { success: true, data: definition };
  } catch (error) {
    console.error("[updateFieldDefinitionAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update field definition",
    };
  }
}

/**
 * Delete a custom field definition
 */
export async function deleteFieldDefinitionAction(definitionId: string) {
  try {
    const { supabase } = await getUserContext();

    await CustomFieldsService.deleteFieldDefinition(supabase, definitionId);

    return { success: true };
  } catch (error) {
    console.error("[deleteFieldDefinitionAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete field definition",
    };
  }
}

/**
 * Reorder custom field definitions
 */
export async function reorderFieldDefinitionsAction(updates: ReorderFieldDefinitionsInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = reorderFieldDefinitionsSchema.parse(updates);

    await CustomFieldsService.reorderFieldDefinitions(supabase, validatedInput);

    return { success: true };
  } catch (error) {
    console.error("[reorderFieldDefinitionsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder field definitions",
    };
  }
}

// ==========================================
// FIELD VALUES ACTIONS
// ==========================================

/**
 * Get custom field values for a product
 */
export async function getProductFieldValuesAction(productId: string) {
  try {
    const { supabase } = await getUserContext();

    const values = await CustomFieldsService.getProductFieldValues(supabase, productId);

    return { success: true, data: values };
  } catch (error) {
    console.error("[getProductFieldValuesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product field values",
    };
  }
}

/**
 * Get custom field values for a variant
 */
export async function getVariantFieldValuesAction(variantId: string) {
  try {
    const { supabase } = await getUserContext();

    const values = await CustomFieldsService.getVariantFieldValues(supabase, variantId);

    return { success: true, data: values };
  } catch (error) {
    console.error("[getVariantFieldValuesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch variant field values",
    };
  }
}

/**
 * Set a custom field value
 */
export async function setFieldValueAction(input: CreateFieldValueInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = createFieldValueSchema.parse(input);

    const value = await CustomFieldsService.setFieldValue(supabase, validatedInput);

    return { success: true, data: value };
  } catch (error) {
    console.error("[setFieldValueAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set field value",
    };
  }
}

/**
 * Delete a custom field value
 */
export async function deleteFieldValueAction(fieldValueId: string) {
  try {
    const { supabase } = await getUserContext();

    await CustomFieldsService.deleteFieldValue(supabase, fieldValueId);

    return { success: true };
  } catch (error) {
    console.error("[deleteFieldValueAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete field value",
    };
  }
}

/**
 * Get product field values with their definitions
 */
export async function getProductFieldValuesWithDefinitionsAction(productId: string) {
  try {
    const { supabase } = await getUserContext();

    const values = await CustomFieldsService.getProductFieldValuesWithDefinitions(
      supabase,
      productId
    );

    return { success: true, data: values };
  } catch (error) {
    console.error("[getProductFieldValuesWithDefinitionsAction] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch field values with definitions",
    };
  }
}
