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
export type ActionResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

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
 * Authenticate user via getUser() which validates the JWT against Supabase Auth.
 *
 * IMPORTANT: getUser() is preferred over getSession() for server-side auth because
 * getSession() only reads from cookies without validating the token against the server.
 *
 * @returns Supabase client and authenticated user ID, or an error result
 */
async function authenticateUser(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; error?: undefined }
  | { error: string; supabase?: undefined; userId?: undefined }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated" };
  }

  return { supabase, userId: user.id };
}

/**
 * Get current user's preferences
 *
 * @returns User preferences or error
 */
export async function getUserPreferencesAction(): Promise<ActionResult<UserPreferences>> {
  try {
    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    const prefs = await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

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
    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    const settings = await UserPreferencesService.getDashboardSettings(auth.supabase, auth.userId);

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
    const validated = updateProfileSchema.parse(input);

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.updateProfile(
      auth.supabase,
      auth.userId,
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
    const validated = updateRegionalSchema.parse(input);

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.updateRegionalSettings(
      auth.supabase,
      auth.userId,
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
    const validated = updateNotificationSettingsSchema.parse(settings);

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.updateNotificationSettings(
      auth.supabase,
      auth.userId,
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
    const validated = updateDashboardSettingsSchema.parse(settings);

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.updateDashboardSettings(
      auth.supabase,
      auth.userId,
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
    const validatedModuleId = moduleIdSchema.parse(moduleId);
    const validatedInput = updateModuleSettingsSchema.parse({
      moduleId: validatedModuleId,
      settings,
    });

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.updateModuleSettings(
      auth.supabase,
      auth.userId,
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
    const validated = syncUiSettingsSchema.parse(settings);

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.syncUiSettings(
      auth.supabase,
      auth.userId,
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
    const validated = setDefaultOrganizationSchema.parse({ organizationId });

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.setDefaultOrganization(
      auth.supabase,
      auth.userId,
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
    const validated = setDefaultBranchSchema.parse({ branchId });

    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    await UserPreferencesService.getOrCreatePreferences(auth.supabase, auth.userId);

    const prefs = await UserPreferencesService.setDefaultBranch(
      auth.supabase,
      auth.userId,
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
