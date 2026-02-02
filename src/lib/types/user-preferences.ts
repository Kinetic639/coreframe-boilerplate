/**
 * User Preferences Types
 *
 * Type definitions for user preferences, profile settings, and UI state persistence.
 * Used throughout the application for user preference management.
 */

/**
 * Core UI settings that are persisted to database for cross-device sync
 */
export interface UiSettings {
  /** Theme preference */
  theme: "light" | "dark" | "system";
  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Collapsed navigation sections */
  collapsedSections?: string[];
}

/**
 * Per-module view preferences
 */
export interface ModuleViewPreferences {
  /** Default view mode */
  defaultView?: "cards" | "list" | "table";
  /** Default sort field */
  sortField?: string;
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Visible columns for table view */
  columnVisibility?: string[];
  /** Items per page */
  pageSize?: number;
}

/**
 * Saved filter definition
 */
export interface SavedFilter {
  /** Filter name */
  name: string;
  /** Filter configuration */
  filter: Record<string, unknown>;
}

/**
 * Module filter preferences
 */
export interface ModuleFilterPreferences {
  /** Named saved filters */
  saved?: SavedFilter[];
  /** Last used filter state */
  lastUsed?: Record<string, unknown>;
  /** Default date range preset */
  dateRange?: string;
}

/**
 * Dashboard widget preferences
 */
export interface DashboardWidgetPreferences {
  /** Widget order on dashboard */
  widgetOrder?: string[];
  /** Collapsed widgets */
  collapsedWidgets?: string[];
  /** Pinned quick actions */
  quickActions?: string[];
}

/**
 * Recent item entry
 */
export interface RecentItem {
  /** Item type */
  type: string;
  /** Item ID */
  id: string;
  /** Item name for display */
  name: string;
  /** When it was accessed */
  at: string;
}

/**
 * Recent items preferences
 */
export interface RecentItemsPreferences {
  /** Recent items (max 10) */
  items?: RecentItem[];
  /** Recent search queries */
  searches?: string[];
}

/**
 * Complete dashboard settings structure stored in JSONB
 */
export interface DashboardSettings {
  /** Core UI state */
  ui?: UiSettings;
  /** Per-module view preferences */
  modules?: Record<string, ModuleViewPreferences>;
  /** Per-module filter preferences */
  filters?: Record<string, ModuleFilterPreferences>;
  /** Dashboard widget layout */
  dashboard?: DashboardWidgetPreferences;
  /** Recent items tracking */
  recent?: RecentItemsPreferences;
  /** Last updated timestamp for conflict resolution */
  updated_at?: string;
}

/**
 * Notification channel settings
 */
export interface NotificationChannelSettings {
  /** Enable this channel */
  enabled: boolean;
  /** Notification types to receive */
  types?: string[];
}

/**
 * Complete notification settings structure
 */
export interface NotificationSettings {
  /** Email notifications */
  email?: NotificationChannelSettings;
  /** Push notifications */
  push?: NotificationChannelSettings;
  /** In-app notifications */
  inApp?: NotificationChannelSettings;
  /** Quiet hours (no notifications) */
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

/**
 * Module-specific settings structure
 */
export interface ModuleSettings {
  [moduleId: string]: Record<string, unknown>;
}

/**
 * User profile data
 */
export interface UserProfile {
  /** Display name */
  displayName?: string | null;
  /** Phone number */
  phone?: string | null;
  /** Timezone */
  timezone: string;
  /** Date format */
  dateFormat: string;
  /** Time format */
  timeFormat: string;
  /** Locale */
  locale: string;
}

/**
 * Complete user preferences structure (matches database schema)
 */
export interface UserPreferences {
  /** Preference record ID */
  id: string;
  /** User ID */
  userId: string;
  /** Display name */
  displayName?: string | null;
  /** Phone number */
  phone?: string | null;
  /** Timezone */
  timezone: string;
  /** Date format */
  dateFormat: string;
  /** Time format */
  timeFormat: string;
  /** Locale */
  locale: string;
  /** Default organization ID */
  organizationId?: string | null;
  /** Default branch ID */
  defaultBranchId?: string | null;
  /** Notification settings */
  notificationSettings: NotificationSettings;
  /** Dashboard settings (UI state, widgets, filters) */
  dashboardSettings: DashboardSettings;
  /** Per-module settings */
  moduleSettings: ModuleSettings;
  /** Last updated at */
  updatedAt?: string | null;
  /** Last updated by user ID */
  updatedBy?: string | null;
}

/**
 * Profile update input
 */
export interface UpdateProfileInput {
  displayName?: string | null;
  phone?: string | null;
}

/**
 * Regional settings update input
 */
export interface UpdateRegionalInput {
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  locale?: string;
}

/**
 * UI settings sync input (from localStorage to DB)
 */
export interface SyncUiSettingsInput {
  theme?: "light" | "dark" | "system";
  sidebarCollapsed?: boolean;
  collapsedSections?: string[];
  updatedAt: string;
}

/**
 * Database row type (snake_case)
 */
export interface UserPreferencesRow {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  timezone: string;
  date_format: string;
  time_format: string;
  locale: string;
  organization_id: string | null;
  default_branch_id: string | null;
  notification_settings: NotificationSettings | null;
  dashboard_settings: DashboardSettings | null;
  module_settings: ModuleSettings | null;
  updated_at: string | null;
  updated_by: string | null;
  created_at: string | null;
  deleted_at: string | null;
}

/**
 * Convert database row to typed preferences
 */
export function rowToPreferences(row: UserPreferencesRow): UserPreferences {
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
