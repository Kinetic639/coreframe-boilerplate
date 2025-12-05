"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { ContextService } from "@/server/services/context.service";
import {
  createCustomContextSchema,
  updateContextConfigurationSchema,
  setFieldVisibilitySchema,
  cloneSystemContextSchema,
  contextFiltersSchema,
  type CreateCustomContextInput,
  type UpdateContextConfigurationInput,
  type SetFieldVisibilityInput,
  type CloneSystemContextInput,
  type ContextFilters,
} from "@/server/schemas/context.schema";

// ==========================================
// CONTEXT ACTIONS
// ==========================================

/**
 * Get all available contexts for the organization
 */
export async function getAvailableContextsAction(includeSystemContexts = true) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const contexts = await ContextService.getAvailableContexts(
      supabase,
      organizationId,
      includeSystemContexts
    );

    return { success: true, data: contexts };
  } catch (error) {
    console.error("[getAvailableContextsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch available contexts",
    };
  }
}

/**
 * Get contexts with access information
 */
export async function getContextsWithAccessAction(userSubscriptionTier?: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const contexts = await ContextService.getContextsWithAccess(
      supabase,
      organizationId,
      userSubscriptionTier
    );

    return { success: true, data: contexts };
  } catch (error) {
    console.error("[getContextsWithAccessAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch contexts with access",
    };
  }
}

/**
 * Get all system contexts
 */
export async function getSystemContextsAction() {
  try {
    const { supabase } = await getUserContext();

    const contexts = await ContextService.getSystemContexts(supabase);

    return { success: true, data: contexts };
  } catch (error) {
    console.error("[getSystemContextsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch system contexts",
    };
  }
}

/**
 * Get organization-specific contexts
 */
export async function getOrganizationContextsAction(filters?: ContextFilters) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate filters if provided
    const validatedFilters = filters ? contextFiltersSchema.parse(filters) : undefined;

    const contexts = await ContextService.getOrganizationContexts(
      supabase,
      organizationId,
      validatedFilters
    );

    return { success: true, data: contexts };
  } catch (error) {
    console.error("[getOrganizationContextsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch organization contexts",
    };
  }
}

/**
 * Create a custom context
 */
export async function createCustomContextAction(
  input: Omit<CreateCustomContextInput, "organization_id">
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = createCustomContextSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const context = await ContextService.createCustomContext(supabase, validatedInput);

    return { success: true, data: context };
  } catch (error) {
    console.error("[createCustomContextAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create custom context",
    };
  }
}

/**
 * Update a context configuration
 */
export async function updateContextConfigurationAction(
  contextId: string,
  input: UpdateContextConfigurationInput
) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateContextConfigurationSchema.parse(input);

    const context = await ContextService.updateContextConfiguration(
      supabase,
      contextId,
      validatedInput
    );

    return { success: true, data: context };
  } catch (error) {
    console.error("[updateContextConfigurationAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update context configuration",
    };
  }
}

/**
 * Delete a context
 */
export async function deleteContextAction(contextId: string) {
  try {
    const { supabase } = await getUserContext();

    await ContextService.deleteContext(supabase, contextId);

    return { success: true };
  } catch (error) {
    console.error("[deleteContextAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete context",
    };
  }
}

// ==========================================
// FIELD VISIBILITY ACTIONS
// ==========================================

/**
 * Get field visibility rules for a context
 */
export async function getContextFieldVisibilityAction(contextId: string) {
  try {
    const { supabase } = await getUserContext();

    const rules = await ContextService.getContextFieldVisibility(supabase, contextId);

    return { success: true, data: rules };
  } catch (error) {
    console.error("[getContextFieldVisibilityAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch field visibility rules",
    };
  }
}

/**
 * Set field visibility rule
 */
export async function setFieldVisibilityAction(input: SetFieldVisibilityInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = setFieldVisibilitySchema.parse(input);

    const rule = await ContextService.setFieldVisibility(supabase, validatedInput);

    return { success: true, data: rule };
  } catch (error) {
    console.error("[setFieldVisibilityAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set field visibility",
    };
  }
}

// ==========================================
// UTILITY ACTIONS
// ==========================================

/**
 * Get context by name
 */
export async function getContextByNameAction(name: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const context = await ContextService.getContextByName(supabase, name, organizationId);

    if (!context) {
      return { success: false, error: "Context not found" };
    }

    return { success: true, data: context };
  } catch (error) {
    console.error("[getContextByNameAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch context by name",
    };
  }
}

/**
 * Check if a context has API enabled
 */
export async function isContextApiEnabledAction(contextId: string) {
  try {
    const { supabase } = await getUserContext();

    const isEnabled = await ContextService.isContextApiEnabled(supabase, contextId);

    return { success: true, data: isEnabled };
  } catch (error) {
    console.error("[isContextApiEnabledAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check API status",
    };
  }
}

/**
 * Get all API-enabled contexts
 */
export async function getApiEnabledContextsAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const contexts = await ContextService.getApiEnabledContexts(supabase, organizationId);

    return { success: true, data: contexts };
  } catch (error) {
    console.error("[getApiEnabledContextsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch API-enabled contexts",
    };
  }
}

/**
 * Clone a system context
 */
export async function cloneSystemContextAction(
  input: Omit<CloneSystemContextInput, "organization_id">
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = cloneSystemContextSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const context = await ContextService.cloneSystemContext(supabase, validatedInput);

    return { success: true, data: context };
  } catch (error) {
    console.error("[cloneSystemContextAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clone system context",
    };
  }
}
