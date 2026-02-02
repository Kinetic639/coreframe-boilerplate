/**
 * User Preferences Service
 *
 * Service layer for managing user preferences, profile settings, and UI state.
 * Handles CRUD operations and JSONB merging for settings.
 *
 * @example
 * ```typescript
 * import { UserPreferencesService } from "@/server/services/user-preferences.service";
 *
 * // Get preferences
 * const prefs = await UserPreferencesService.getPreferences(supabase, userId);
 *
 * // Update profile
 * await UserPreferencesService.updateProfile(supabase, userId, {
 *   displayName: "John Doe",
 *   phone: "+1234567890"
 * });
 *
 * // Sync UI settings from localStorage
 * await UserPreferencesService.syncUiSettings(supabase, userId, {
 *   theme: "dark",
 *   sidebarCollapsed: true,
 *   updatedAt: new Date().toISOString()
 * });
 * ```
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  UserPreferences,
  UserPreferencesRow,
  UpdateProfileInput,
  UpdateRegionalInput,
  NotificationSettings,
  DashboardSettings,
  SyncUiSettingsInput,
} from "@/lib/types/user-preferences";

export class UserPreferencesService {
  /**
   * Get user preferences
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @returns User preferences or null if not found
   */
  static async getPreferences(
    supabase: SupabaseClient,
    userId: string
  ): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No row found - return null
        return null;
      }
      console.error("[UserPreferencesService] Failed to get preferences:", error);
      throw new Error("Failed to get user preferences");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Get or create user preferences
   *
   * Creates default preferences if they don't exist.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @returns User preferences (existing or newly created)
   */
  static async getOrCreatePreferences(
    supabase: SupabaseClient,
    userId: string
  ): Promise<UserPreferences> {
    const existing = await this.getPreferences(supabase, userId);
    if (existing) {
      return existing;
    }

    // Create default preferences
    const { data, error } = await supabase
      .from("user_preferences")
      .insert({
        user_id: userId,
        timezone: "UTC",
        date_format: "YYYY-MM-DD",
        time_format: "24h",
        locale: "pl",
        notification_settings: {},
        dashboard_settings: {},
        module_settings: {},
        updated_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to create preferences:", error);
      throw new Error("Failed to create user preferences");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Update user profile
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param input - Profile data to update
   * @returns Updated preferences
   */
  static async updateProfile(
    supabase: SupabaseClient,
    userId: string,
    input: UpdateProfileInput
  ): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        display_name: input.displayName,
        phone: input.phone,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to update profile:", error);
      throw new Error("Failed to update profile");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Update regional settings
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param input - Regional settings to update
   * @returns Updated preferences
   */
  static async updateRegionalSettings(
    supabase: SupabaseClient,
    userId: string,
    input: UpdateRegionalInput
  ): Promise<UserPreferences> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.dateFormat !== undefined) updateData.date_format = input.dateFormat;
    if (input.timeFormat !== undefined) updateData.time_format = input.timeFormat;
    if (input.locale !== undefined) updateData.locale = input.locale;

    const { data, error } = await supabase
      .from("user_preferences")
      .update(updateData)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to update regional settings:", error);
      throw new Error("Failed to update regional settings");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Update notification settings
   *
   * Merges with existing settings (partial update).
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param settings - Notification settings to merge
   * @returns Updated preferences
   */
  static async updateNotificationSettings(
    supabase: SupabaseClient,
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<UserPreferences> {
    // First get current settings
    const current = await this.getPreferences(supabase, userId);
    if (!current) {
      throw new Error("User preferences not found");
    }

    const mergedSettings = {
      ...current.notificationSettings,
      ...settings,
    };

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        notification_settings: mergedSettings,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to update notification settings:", error);
      throw new Error("Failed to update notification settings");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Update dashboard settings
   *
   * Performs deep merge with existing settings in the application layer.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param settings - Dashboard settings to merge
   * @returns Updated preferences
   */
  static async updateDashboardSettings(
    supabase: SupabaseClient,
    userId: string,
    settings: Partial<DashboardSettings>
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(supabase, userId);
    if (!current) {
      throw new Error("User preferences not found");
    }

    const mergedSettings = this.deepMerge(current.dashboardSettings, settings);
    mergedSettings.updated_at = new Date().toISOString();

    const { data: updateData, error: updateError } = await supabase
      .from("user_preferences")
      .update({
        dashboard_settings: mergedSettings,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (updateError) {
      console.error("[UserPreferencesService] Failed to update dashboard settings:", updateError);
      throw new Error("Failed to update dashboard settings");
    }

    return this.rowToPreferences(updateData as UserPreferencesRow);
  }

  /**
   * Update module-specific settings
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param moduleId - Module identifier
   * @param settings - Settings for this module
   * @returns Updated preferences
   */
  static async updateModuleSettings(
    supabase: SupabaseClient,
    userId: string,
    moduleId: string,
    settings: Record<string, unknown>
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(supabase, userId);
    if (!current) {
      throw new Error("User preferences not found");
    }

    const mergedModuleSettings = {
      ...current.moduleSettings,
      [moduleId]: {
        ...(current.moduleSettings[moduleId] || {}),
        ...settings,
      },
    };

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        module_settings: mergedModuleSettings,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to update module settings:", error);
      throw new Error("Failed to update module settings");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Sync UI settings from localStorage to database
   *
   * Used by UiSettingsSync component for cross-device persistence.
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param settings - UI settings to sync
   * @returns Updated preferences
   */
  static async syncUiSettings(
    supabase: SupabaseClient,
    userId: string,
    settings: SyncUiSettingsInput
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(supabase, userId);
    if (!current) {
      throw new Error("User preferences not found");
    }

    // Build UI settings update
    const uiSettings = {
      ...(current.dashboardSettings.ui || {}),
      ...(settings.theme !== undefined && { theme: settings.theme }),
      ...(settings.sidebarCollapsed !== undefined && {
        sidebarCollapsed: settings.sidebarCollapsed,
      }),
      ...(settings.collapsedSections !== undefined && {
        collapsedSections: settings.collapsedSections,
      }),
    };

    const mergedSettings: DashboardSettings = {
      ...current.dashboardSettings,
      ui: uiSettings,
      updated_at: settings.updatedAt,
    };

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        dashboard_settings: mergedSettings,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to sync UI settings:", error);
      throw new Error("Failed to sync UI settings");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Get dashboard settings only (for UI sync)
   *
   * Returns null if user has no preferences record (not found).
   * Returns {} if user has a preferences record but empty dashboard_settings.
   * Throws on actual database errors (distinguishable from empty state).
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @returns Dashboard settings, {} if empty, or null if user has no preferences
   */
  static async getDashboardSettings(
    supabase: SupabaseClient,
    userId: string
  ): Promise<DashboardSettings | null> {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("dashboard_settings")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No row found - return null to indicate "user has no preferences yet"
        return null;
      }
      // Actual database error - throw to distinguish from empty state
      console.error("[UserPreferencesService] Failed to get dashboard settings:", error);
      throw new Error("Failed to get dashboard settings");
    }

    // User has preferences - return settings (empty {} if null in DB)
    return (data?.dashboard_settings as DashboardSettings) ?? {};
  }

  /**
   * Set default organization
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param organizationId - Organization ID to set as default
   * @returns Updated preferences
   */
  static async setDefaultOrganization(
    supabase: SupabaseClient,
    userId: string,
    organizationId: string
  ): Promise<UserPreferences> {
    // Validate organization exists and user is a member
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .single();

    if (memberError || !membership) {
      throw new Error("You are not a member of this organization");
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        organization_id: organizationId,
        default_branch_id: null, // Clear branch when org changes
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to set default organization:", error);
      throw new Error("Failed to set default organization");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Set default branch
   *
   * @param supabase - Supabase client
   * @param userId - User ID
   * @param branchId - Branch ID to set as default
   * @returns Updated preferences
   */
  static async setDefaultBranch(
    supabase: SupabaseClient,
    userId: string,
    branchId: string
  ): Promise<UserPreferences> {
    // Validate branch exists
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id, organization_id")
      .eq("id", branchId)
      .is("deleted_at", null)
      .single();

    if (branchError || !branch) {
      throw new Error("Branch not found");
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        default_branch_id: branchId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[UserPreferencesService] Failed to set default branch:", error);
      throw new Error("Failed to set default branch");
    }

    return this.rowToPreferences(data as UserPreferencesRow);
  }

  /**
   * Convert database row to typed preferences
   */
  private static rowToPreferences(row: UserPreferencesRow): UserPreferences {
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      phone: row.phone,
      timezone: row.timezone ?? "UTC",
      dateFormat: row.date_format ?? "YYYY-MM-DD",
      timeFormat: row.time_format ?? "24h",
      locale: row.locale ?? "pl",
      organizationId: row.organization_id,
      defaultBranchId: row.default_branch_id,
      notificationSettings: row.notification_settings ?? {},
      dashboardSettings: row.dashboard_settings ?? {},
      moduleSettings: row.module_settings ?? {},
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  /**
   * Deep merge two objects
   */
  private static deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target } as T;

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }

    return result;
  }
}
