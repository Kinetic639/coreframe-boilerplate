"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { OptionGroupsService } from "@/server/services/option-groups.service";
import {
  createOptionGroupSchema,
  updateOptionGroupSchema,
  createOptionValueSchema,
  updateOptionValueSchema,
  type CreateOptionGroupInput,
  type UpdateOptionGroupInput,
  type CreateOptionValueInput,
  type UpdateOptionValueInput,
} from "@/server/schemas/option-groups.schema";

// ==========================================
// OPTION GROUPS SERVER ACTIONS
// ==========================================

/**
 * Get all option groups for the organization
 */
export async function getOptionGroupsAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const optionGroups = await OptionGroupsService.getOptionGroups(supabase, organizationId);

    return { success: true, data: optionGroups };
  } catch (error) {
    console.error("[getOptionGroupsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch option groups",
    };
  }
}

/**
 * Get a single option group by ID
 */
export async function getOptionGroupAction(groupId: string) {
  try {
    const { supabase } = await getUserContext();

    const optionGroup = await OptionGroupsService.getOptionGroup(supabase, groupId);

    if (!optionGroup) {
      return { success: false, error: "Option group not found" };
    }

    return { success: true, data: optionGroup };
  } catch (error) {
    console.error("[getOptionGroupAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch option group",
    };
  }
}

/**
 * Create a new option group
 */
export async function createOptionGroupAction(input: CreateOptionGroupInput) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = createOptionGroupSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const optionGroup = await OptionGroupsService.createOptionGroup(supabase, validatedInput);

    return { success: true, data: optionGroup };
  } catch (error) {
    console.error("[createOptionGroupAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create option group",
    };
  }
}

/**
 * Update an existing option group
 */
export async function updateOptionGroupAction(input: UpdateOptionGroupInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateOptionGroupSchema.parse(input);

    const optionGroup = await OptionGroupsService.updateOptionGroup(supabase, validatedInput);

    return { success: true, data: optionGroup };
  } catch (error) {
    console.error("[updateOptionGroupAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update option group",
    };
  }
}

/**
 * Delete an option group (soft delete)
 */
export async function deleteOptionGroupAction(groupId: string) {
  try {
    const { supabase } = await getUserContext();

    await OptionGroupsService.deleteOptionGroup(supabase, groupId);

    return { success: true };
  } catch (error) {
    console.error("[deleteOptionGroupAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete option group",
    };
  }
}

// ==========================================
// OPTION VALUES SERVER ACTIONS
// ==========================================

/**
 * Get all values for an option group
 */
export async function getOptionValuesAction(groupId: string) {
  try {
    const { supabase } = await getUserContext();

    const optionValues = await OptionGroupsService.getOptionValues(supabase, groupId);

    return { success: true, data: optionValues };
  } catch (error) {
    console.error("[getOptionValuesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch option values",
    };
  }
}

/**
 * Create a new option value
 */
export async function createOptionValueAction(input: CreateOptionValueInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = createOptionValueSchema.parse(input);

    const optionValue = await OptionGroupsService.createOptionValue(supabase, validatedInput);

    return { success: true, data: optionValue };
  } catch (error) {
    console.error("[createOptionValueAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create option value",
    };
  }
}

/**
 * Update an existing option value
 */
export async function updateOptionValueAction(input: UpdateOptionValueInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateOptionValueSchema.parse(input);

    const optionValue = await OptionGroupsService.updateOptionValue(supabase, validatedInput);

    return { success: true, data: optionValue };
  } catch (error) {
    console.error("[updateOptionValueAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update option value",
    };
  }
}

/**
 * Delete an option value (soft delete)
 */
export async function deleteOptionValueAction(valueId: string) {
  try {
    const { supabase } = await getUserContext();

    await OptionGroupsService.deleteOptionValue(supabase, valueId);

    return { success: true };
  } catch (error) {
    console.error("[deleteOptionValueAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete option value",
    };
  }
}
