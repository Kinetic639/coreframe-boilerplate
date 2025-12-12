"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { TemplatesService } from "@/server/services/templates.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  cloneTemplateSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type CloneTemplateInput,
} from "@/server/schemas/templates.schema";

// ==========================================
// TEMPLATES SERVER ACTIONS
// ==========================================

/**
 * Get all system templates
 */
export async function getSystemTemplatesAction() {
  try {
    const { supabase } = await getUserContext();

    const templates = await TemplatesService.getSystemTemplates(supabase);

    return { success: true, data: templates };
  } catch (error) {
    console.error("[getSystemTemplatesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch system templates",
    };
  }
}

/**
 * Get organization templates
 */
export async function getOrganizationTemplatesAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const templates = await TemplatesService.getOrganizationTemplates(supabase, organizationId);

    return { success: true, data: templates };
  } catch (error) {
    console.error("[getOrganizationTemplatesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch organization templates",
    };
  }
}

/**
 * Get all templates (system + organization)
 */
export async function getAllTemplatesAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const templates = await TemplatesService.getAllTemplates(supabase, organizationId);

    return { success: true, data: templates };
  } catch (error) {
    console.error("[getAllTemplatesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch templates",
    };
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplateAction(templateId: string) {
  try {
    const { supabase } = await getUserContext();

    const template = await TemplatesService.getTemplate(supabase, templateId);

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    return { success: true, data: template };
  } catch (error) {
    console.error("[getTemplateAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch template",
    };
  }
}

/**
 * Create a new template
 */
export async function createTemplateAction(input: CreateTemplateInput) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    // Validate input
    const validatedInput = createTemplateSchema.parse({
      ...input,
      organization_id: input.organization_id || organizationId,
      created_by: user.id,
    });

    const template = await TemplatesService.createTemplate(supabase, validatedInput);

    return { success: true, data: template };
  } catch (error) {
    console.error("[createTemplateAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create template",
    };
  }
}

/**
 * Update an existing template
 */
export async function updateTemplateAction(templateId: string, input: UpdateTemplateInput) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateTemplateSchema.parse(input);

    const template = await TemplatesService.updateTemplate(supabase, templateId, validatedInput);

    return { success: true, data: template };
  } catch (error) {
    console.error("[updateTemplateAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update template",
    };
  }
}

/**
 * Clone a template
 */
export async function cloneTemplateAction(input: CloneTemplateInput) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = cloneTemplateSchema.parse({
      ...input,
      target_organization_id: input.target_organization_id || organizationId,
    });

    const template = await TemplatesService.cloneTemplate(supabase, validatedInput);

    return { success: true, data: template };
  } catch (error) {
    console.error("[cloneTemplateAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clone template",
    };
  }
}

/**
 * Delete a template
 */
export async function deleteTemplateAction(templateId: string) {
  try {
    const { supabase } = await getUserContext();

    await TemplatesService.deleteTemplate(supabase, templateId);

    return { success: true };
  } catch (error) {
    console.error("[deleteTemplateAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete template",
    };
  }
}
