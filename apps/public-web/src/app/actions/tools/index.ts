"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PERMISSION_TOOLS_READ, PERMISSION_TOOLS_MANAGE } from "@/lib/constants/permissions";
import {
  ToolsCatalogService,
  UserToolsService,
  type ToolCatalogItem,
  type UserEnabledTool,
} from "@/server/services/tools.service";
import {
  setToolEnabledSchema,
  setToolPinnedSchema,
  updateToolSettingsSchema,
  type SetToolEnabledInput,
  type SetToolPinnedInput,
  type UpdateToolSettingsInput,
} from "@/lib/validations/tools";

// ---------------------------------------------------------------------------
// State scoping note
//
// All UserToolsService calls use the authenticated user's id (from getUser()).
// user_enabled_tools has NO org_id column — tool state is USER-GLOBAL and
// consistent across org/branch switches. The org context (activeOrgId) is used
// only for permission validation, never as a filter on the data itself.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, context: null };

  const context = await loadDashboardContextV2();
  return { supabase, user, context };
}

// ---------------------------------------------------------------------------
// Read actions (require tools.read)
// ---------------------------------------------------------------------------

/**
 * List all active tools in the catalog.
 */
export async function listToolsCatalogAction(): Promise<ActionResult<ToolCatalogItem[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_READ))
      return { success: false, error: "Unauthorized" };

    return ToolsCatalogService.listCatalog(supabase);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Get a single tool by its slug.
 * Returns { success: true, data: null } when the slug is not found/inactive.
 */
export async function getToolBySlugAction(
  slug: string
): Promise<ActionResult<ToolCatalogItem | null>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_READ))
      return { success: false, error: "Unauthorized" };

    return ToolsCatalogService.getToolBySlug(supabase, slug);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * List the current user's enabled tools.
 */
export async function listMyEnabledToolsAction(): Promise<ActionResult<UserEnabledTool[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_READ))
      return { success: false, error: "Unauthorized" };

    return UserToolsService.listUserEnabledTools(supabase, user.id);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Get the user's record for a specific tool slug.
 */
export async function getMyToolRecordAction(
  toolSlug: string
): Promise<ActionResult<UserEnabledTool | null>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_READ))
      return { success: false, error: "Unauthorized" };

    return UserToolsService.getUserToolRecord(supabase, user.id, toolSlug);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Mutation actions (require tools.manage)
// ---------------------------------------------------------------------------

/**
 * Enable or disable a tool for the current user.
 */
export async function setToolEnabledAction(
  rawInput: SetToolEnabledInput
): Promise<ActionResult<UserEnabledTool>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_MANAGE))
      return { success: false, error: "Unauthorized" };

    const parsed = setToolEnabledSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return UserToolsService.setToolEnabled(
      supabase,
      user.id,
      parsed.data.toolSlug,
      parsed.data.enabled
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Pin or unpin a tool for the current user.
 */
export async function setToolPinnedAction(
  rawInput: SetToolPinnedInput
): Promise<ActionResult<UserEnabledTool>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_MANAGE))
      return { success: false, error: "Unauthorized" };

    const parsed = setToolPinnedSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return UserToolsService.setToolPinned(
      supabase,
      user.id,
      parsed.data.toolSlug,
      parsed.data.pinned
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Update per-tool settings for the current user.
 */
export async function updateToolSettingsAction(
  rawInput: UpdateToolSettingsInput
): Promise<ActionResult<UserEnabledTool>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    if (!context?.app.activeOrgId) return { success: false, error: "No active organisation" };

    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_MANAGE))
      return { success: false, error: "Unauthorized" };

    const parsed = updateToolSettingsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return UserToolsService.updateToolSettings(
      supabase,
      user.id,
      parsed.data.toolSlug,
      parsed.data.settings as Record<string, unknown>
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
