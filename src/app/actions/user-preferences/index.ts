"use server";

import { createClient } from "@/utils/supabase/server";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { ZodError } from "zod";
import {
  updateProfileSchema,
  updateRegionalSchema,
  updateNotificationSettingsSchema,
  updateDashboardSettingsSchema,
  syncUiSettingsSchema,
  updateModuleSettingsSchema,
  setDefaultOrganizationSchema,
  setDefaultBranchSchema,
  moduleIdSchema,
} from "@/lib/validations/user-preferences";
import type {
  UserPreferences,
  DashboardSettings,
  NotificationSettings,
  UpdateProfileInput,
  UpdateRegionalInput,
  SyncUiSettingsInput,
} from "@/lib/types/user-preferences";

/**
 * Result type for server actions
 */
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Format Zod validation errors into a readable string
 */
function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
      return `${path}${e.message}`;
    })
    .join("; ");
}

/**
 * Get current user's preferences
 *
 * @returns User preferences or error
 */
export async function getUserPreferencesAction(): Promise<ActionResult<UserPreferences>> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const prefs = await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    return { success: true, data: prefs };
  } catch (error) {
    console.error("[getUserPreferencesAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get preferences",
    };
  }
}

/**
 * Get dashboard settings only (for UI sync)
 *
 * Lighter weight than getting full preferences.
 *
 * @returns Dashboard settings or error (null if error occurred, {} if empty)
 */
export async function getDashboardSettingsAction(): Promise<
  ActionResult<DashboardSettings | null>
> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    const settings = await UserPreferencesService.getDashboardSettings(supabase, session.user.id);

    // Return null if not found (distinguishable from empty settings {})
    return { success: true, data: settings };
  } catch (error) {
    console.error("[getDashboardSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get dashboard settings",
    };
  }
}

/**
 * Update user profile
 *
 * @param input - Profile data to update
 * @returns Updated preferences or error
 */
export async function updateProfileAction(input: unknown): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = updateProfileSchema.parse(input);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.updateProfile(
      supabase,
      session.user.id,
      validated as UpdateProfileInput
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateProfileAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}

/**
 * Update regional settings
 *
 * @param input - Regional settings to update (validated against IANA timezones and ISO locales)
 * @returns Updated preferences or error
 */
export async function updateRegionalSettingsAction(
  input: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod (includes timezone/locale validation)
    const validated = updateRegionalSchema.parse(input);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.updateRegionalSettings(
      supabase,
      session.user.id,
      validated as UpdateRegionalInput
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateRegionalSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update regional settings",
    };
  }
}

/**
 * Update notification settings
 *
 * @param settings - Notification settings to merge
 * @returns Updated preferences or error
 */
export async function updateNotificationSettingsAction(
  settings: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = updateNotificationSettingsSchema.parse(settings);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.updateNotificationSettings(
      supabase,
      session.user.id,
      validated as Partial<NotificationSettings>
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateNotificationSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update notification settings",
    };
  }
}

/**
 * Update dashboard settings
 *
 * Performs deep merge with existing settings.
 *
 * @param settings - Dashboard settings to merge
 * @returns Updated preferences or error
 */
export async function updateDashboardSettingsAction(
  settings: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = updateDashboardSettingsSchema.parse(settings);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.updateDashboardSettings(
      supabase,
      session.user.id,
      validated as Partial<DashboardSettings>
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateDashboardSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update dashboard settings",
    };
  }
}

/**
 * Update module-specific settings
 *
 * @param moduleId - Module identifier (lowercase alphanumeric with hyphens)
 * @param settings - Settings for this module
 * @returns Updated preferences or error
 */
export async function updateModuleSettingsAction(
  moduleId: unknown,
  settings: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate inputs with Zod
    const validatedModuleId = moduleIdSchema.parse(moduleId);
    const validatedInput = updateModuleSettingsSchema.parse({
      moduleId: validatedModuleId,
      settings,
    });

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.updateModuleSettings(
      supabase,
      session.user.id,
      validatedInput.moduleId,
      validatedInput.settings as Record<string, unknown>
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[updateModuleSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update module settings",
    };
  }
}

/**
 * Sync UI settings from localStorage to database
 *
 * Used by UiSettingsSync component for cross-device persistence.
 * Client-side debounced (500ms). Consider server-side rate limiting for production.
 *
 * @param settings - UI settings to sync
 * @returns Updated preferences or error
 */
export async function syncUiSettingsAction(
  settings: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = syncUiSettingsSchema.parse(settings);

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.syncUiSettings(
      supabase,
      session.user.id,
      validated as SyncUiSettingsInput
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[syncUiSettingsAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync UI settings",
    };
  }
}

/**
 * Set default organization
 *
 * Triggers context reload on success.
 *
 * @param organizationId - Organization ID to set as default
 * @returns Updated preferences or error
 */
export async function setDefaultOrganizationAction(
  organizationId: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = setDefaultOrganizationSchema.parse({ organizationId });

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.setDefaultOrganization(
      supabase,
      session.user.id,
      validated.organizationId
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[setDefaultOrganizationAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default organization",
    };
  }
}

/**
 * Set default branch
 *
 * @param branchId - Branch ID to set as default
 * @returns Updated preferences or error
 */
export async function setDefaultBranchAction(
  branchId: unknown
): Promise<ActionResult<UserPreferences>> {
  try {
    // Validate input with Zod
    const validated = setDefaultBranchSchema.parse({ branchId });

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    // Ensure preferences exist
    await UserPreferencesService.getOrCreatePreferences(supabase, session.user.id);

    const prefs = await UserPreferencesService.setDefaultBranch(
      supabase,
      session.user.id,
      validated.branchId
    );

    return { success: true, data: prefs };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: formatZodError(error) };
    }
    console.error("[setDefaultBranchAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default branch",
    };
  }
}
