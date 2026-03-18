"use server";

import { randomUUID } from "crypto";
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
import { loadAppContextV2 } from "@/server/loaders/v2/load-app-context.v2";
import { PermissionServiceV2 } from "@/server/services/permission-v2.service";
import {
  ACCOUNT_PROFILE_UPDATE,
  ACCOUNT_PREFERENCES_UPDATE,
  ACCOUNT_PREFERENCES_READ,
} from "@/lib/constants/permissions";
import { checkPermission } from "@/lib/utils/permissions";

const AVATAR_BUCKET = "user-avatars";
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_SIGNED_URL_TTL = 3600; // 1 hour

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
 * Check if the current authenticated user has the given permission.
 *
 * Loads the permission snapshot (wildcard-aware) for the user's active org and
 * uses checkPermission() for matching. This correctly handles wildcard permissions
 * like "account.*" stored in user_effective_permissions.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - Authenticated user ID (avoids redundant getUser() call)
 * @param permission - Permission slug to verify
 * @returns True if user has the permission
 */
async function checkUserPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  permission: string
): Promise<boolean> {
  const appCtx = await loadAppContextV2();
  if (!appCtx?.activeOrgId) return false;
  const snapshot = await PermissionServiceV2.getPermissionSnapshotForUser(
    supabase,
    userId,
    appCtx.activeOrgId
  );
  return checkPermission(snapshot, permission);
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

    const allowed = await checkUserPermission(auth.supabase, auth.userId, ACCOUNT_PREFERENCES_READ);
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(auth.supabase, auth.userId, ACCOUNT_PREFERENCES_READ);
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(auth.supabase, auth.userId, ACCOUNT_PROFILE_UPDATE);
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

    const allowed = await checkUserPermission(
      auth.supabase,
      auth.userId,
      ACCOUNT_PREFERENCES_UPDATE
    );
    if (!allowed) return { success: false, error: "Permission denied" };

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

// ---------------------------------------------------------------------------
// Avatar actions
// ---------------------------------------------------------------------------

/**
 * Upload or replace the authenticated user's avatar.
 *
 * Security:
 * - Enforces ACCOUNT_PROFILE_UPDATE permission (deny-first).
 * - Validates MIME type and file size server-side (client cannot bypass).
 * - Object path is always `${userId}/${uuid}.${ext}` — never trust client-provided path.
 * - Deletes the old storage object after a successful replacement.
 *
 * @param formData - Must contain a "file" field with the image File.
 * @returns { success: true } on success, { success: false, error } on any failure.
 */
export async function uploadAvatarAction(
  formData: FormData
): Promise<ActionResult<{ avatarPath: string }>> {
  try {
    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    const allowed = await checkUserPermission(auth.supabase, auth.userId, ACCOUNT_PROFILE_UPDATE);
    if (!allowed) return { success: false, error: "Permission denied" };

    // Extract file from FormData
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "No file provided" };
    }

    // Validate MIME type — must be an image
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Invalid file type. Only image files are allowed." };
    }

    // Validate file size
    if (file.size > AVATAR_MAX_BYTES) {
      return { success: false, error: "File too large. Maximum size is 5 MB." };
    }

    // Derive extension from MIME type to avoid trusting file.name
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";

    // Deterministic, user-scoped path — never client-provided
    const newPath = `${auth.userId}/${randomUUID()}.${ext}`;

    // Read existing avatar_path for cleanup after successful upload
    const { data: userRow } = await auth.supabase
      .from("users")
      .select("avatar_path")
      .eq("id", auth.userId)
      .maybeSingle();
    const oldPath: string | null = userRow?.avatar_path ?? null;

    // Upload to storage (no upsert — unique UUID path means no accidental overwrite)
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await auth.supabase.storage
      .from(AVATAR_BUCKET)
      .upload(newPath, arrayBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[uploadAvatarAction] Storage upload failed:", uploadError);
      return { success: false, error: "Failed to upload avatar" };
    }

    // Persist the new path (not URL) in the users table
    const { error: dbError } = await auth.supabase
      .from("users")
      .update({ avatar_path: newPath })
      .eq("id", auth.userId);

    if (dbError) {
      // Rollback: remove the uploaded object so storage stays clean
      await auth.supabase.storage.from(AVATAR_BUCKET).remove([newPath]);
      console.error("[uploadAvatarAction] DB update failed:", dbError);
      return { success: false, error: "Failed to save avatar reference" };
    }

    // Clean up the old object now that the DB is consistent
    if (oldPath && oldPath !== newPath) {
      await auth.supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    return { success: true, data: { avatarPath: newPath } };
  } catch (error) {
    console.error("[uploadAvatarAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload avatar",
    };
  }
}

/**
 * Remove the authenticated user's avatar.
 *
 * Security:
 * - Enforces ACCOUNT_PROFILE_UPDATE permission (deny-first).
 * - Path read from DB — never from client.
 *
 * @returns { success: true } on success, { success: false, error } on any failure.
 */
export async function removeAvatarAction(): Promise<ActionResult<null>> {
  try {
    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    const allowed = await checkUserPermission(auth.supabase, auth.userId, ACCOUNT_PROFILE_UPDATE);
    if (!allowed) return { success: false, error: "Permission denied" };

    // Read current path from DB (never trust client-provided path)
    const { data: userRow } = await auth.supabase
      .from("users")
      .select("avatar_path")
      .eq("id", auth.userId)
      .maybeSingle();
    const currentPath: string | null = userRow?.avatar_path ?? null;

    // Clear DB column first — even if storage delete fails, user is no longer shown a broken image
    const { error: dbError } = await auth.supabase
      .from("users")
      .update({ avatar_path: null })
      .eq("id", auth.userId);

    if (dbError) {
      console.error("[removeAvatarAction] DB update failed:", dbError);
      return { success: false, error: "Failed to remove avatar" };
    }

    // Delete storage object (best-effort — not a hard failure)
    if (currentPath) {
      const { error: storageError } = await auth.supabase.storage
        .from(AVATAR_BUCKET)
        .remove([currentPath]);
      if (storageError) {
        console.error("[removeAvatarAction] Storage delete failed (non-fatal):", storageError);
      }
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("[removeAvatarAction] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove avatar",
    };
  }
}

/**
 * Generate a short-lived signed URL for the authenticated user's avatar.
 *
 * Called server-side from Server Components (profile page).
 * Returns null if no avatar_path is set or on any error.
 */
export async function getAvatarSignedUrlAction(): Promise<
  ActionResult<{ signedUrl: string | null }>
> {
  try {
    const auth = await authenticateUser();
    if (auth.error) return { success: false, error: auth.error };

    const { data: userRow } = await auth.supabase
      .from("users")
      .select("avatar_path")
      .eq("id", auth.userId)
      .maybeSingle();

    const avatarPath: string | null = userRow?.avatar_path ?? null;
    if (!avatarPath) return { success: true, data: { signedUrl: null } };

    const { data, error } = await auth.supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      console.error("[getAvatarSignedUrlAction] Failed to create signed URL:", error);
      return { success: true, data: { signedUrl: null } };
    }

    return { success: true, data: { signedUrl: data.signedUrl } };
  } catch (error) {
    console.error("[getAvatarSignedUrlAction] Failed:", error);
    return { success: false, error: "Failed to generate avatar URL" };
  }
}
