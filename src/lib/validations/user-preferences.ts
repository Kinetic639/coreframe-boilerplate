/**
 * User Preferences Validation Schemas
 *
 * Zod validation schemas for user preferences input validation.
 * All server actions should validate input using these schemas.
 */

import { z } from "zod";

// ============================================================================
// Constants - Valid Values
// ============================================================================

/**
 * Common IANA timezone identifiers
 * This is a subset of the most commonly used timezones.
 * Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const VALID_TIMEZONES = [
  // UTC
  "UTC",
  // Europe
  "Europe/Warsaw",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/Dublin",
  "Europe/Zurich",
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  // Asia
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Kuala_Lumpur",
  "Asia/Taipei",
  // Oceania
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
] as const;

/**
 * Supported locales (ISO 639-1 language codes)
 */
export const VALID_LOCALES = [
  "pl", // Polish
  "en", // English
  "de", // German
  "fr", // French
  "es", // Spanish
  "it", // Italian
  "pt", // Portuguese
  "nl", // Dutch
  "cs", // Czech
  "sk", // Slovak
  "uk", // Ukrainian
  "ru", // Russian
] as const;

/**
 * Supported date formats
 */
export const VALID_DATE_FORMATS = [
  "YYYY-MM-DD", // ISO 8601
  "DD-MM-YYYY", // European
  "MM-DD-YYYY", // US
  "DD/MM/YYYY", // European with slash
  "MM/DD/YYYY", // US with slash
  "DD.MM.YYYY", // German/Polish
  "YYYY/MM/DD", // East Asian
] as const;

/**
 * Supported time formats
 */
export const VALID_TIME_FORMATS = ["24h", "12h"] as const;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Timezone validation - validates against IANA timezone database
 */
export const timezoneSchema = z
  .string()
  .min(1, "Timezone is required")
  .refine((val) => VALID_TIMEZONES.includes(val as (typeof VALID_TIMEZONES)[number]), {
    message: `Invalid timezone. Must be a valid IANA timezone identifier.`,
  });

/**
 * Locale validation
 */
export const localeSchema = z
  .string()
  .min(1, "Locale is required")
  .refine((val) => VALID_LOCALES.includes(val as (typeof VALID_LOCALES)[number]), {
    message: `Invalid locale. Supported: ${VALID_LOCALES.join(", ")}`,
  });

/**
 * Date format validation
 */
export const dateFormatSchema = z
  .string()
  .min(1, "Date format is required")
  .refine((val) => VALID_DATE_FORMATS.includes(val as (typeof VALID_DATE_FORMATS)[number]), {
    message: `Invalid date format. Supported: ${VALID_DATE_FORMATS.join(", ")}`,
  });

/**
 * Time format validation
 */
export const timeFormatSchema = z
  .string()
  .min(1, "Time format is required")
  .refine((val) => VALID_TIME_FORMATS.includes(val as (typeof VALID_TIME_FORMATS)[number]), {
    message: `Invalid time format. Supported: ${VALID_TIME_FORMATS.join(", ")}`,
  });

/**
 * Display name validation - prevents XSS and ensures reasonable length
 */
export const displayNameSchema = z
  .string()
  .max(100, "Display name must be 100 characters or less")
  .transform((val) => val.trim())
  .refine((val) => val.length === 0 || val.length >= 2, {
    message: "Display name must be at least 2 characters",
  })
  .refine((val) => !/[<>'"&]/.test(val), {
    message: "Display name contains invalid characters",
  })
  .nullable()
  .optional();

/**
 * Phone number validation - basic format check
 */
export const phoneSchema = z
  .string()
  .max(20, "Phone number must be 20 characters or less")
  .refine((val) => val === "" || /^[+]?[\d\s\-()]+$/.test(val), {
    message: "Invalid phone number format",
  })
  .nullable()
  .optional();

/**
 * Theme validation
 */
export const themeSchema = z.enum(["light", "dark", "system"]);

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid("Invalid ID format");

/**
 * Module ID validation - alphanumeric with hyphens
 */
export const moduleIdSchema = z
  .string()
  .min(1, "Module ID is required")
  .max(50, "Module ID must be 50 characters or less")
  .regex(/^[a-z0-9\-]+$/, "Module ID must be lowercase alphanumeric with hyphens");

// ============================================================================
// Input Schemas for Server Actions
// ============================================================================

/**
 * Profile update input validation
 */
export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema,
});

/**
 * Regional settings update input validation
 */
export const updateRegionalSchema = z
  .object({
    timezone: timezoneSchema.optional(),
    dateFormat: dateFormatSchema.optional(),
    timeFormat: timeFormatSchema.optional(),
    locale: localeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Notification channel settings validation
 * Note: enabled is required per the NotificationChannelSettings type
 */
export const notificationChannelSchema = z.object({
  enabled: z.boolean(),
  types: z.array(z.string()).optional(),
});

/**
 * Partial notification channel settings (for updates)
 */
export const partialNotificationChannelSchema = z.object({
  enabled: z.boolean().optional(),
  types: z.array(z.string()).optional(),
});

/**
 * Notification settings update input validation
 * Uses partial channel schema since this is for updates (merge)
 */
export const updateNotificationSettingsSchema = z.object({
  email: partialNotificationChannelSchema.optional(),
  push: partialNotificationChannelSchema.optional(),
  inApp: partialNotificationChannelSchema.optional(),
  quietHours: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
      end: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
      timezone: timezoneSchema,
    })
    .optional(),
});

/**
 * UI settings validation (for partial updates)
 * All fields are optional since this is used for merging
 */
export const uiSettingsSchema = z
  .object({
    theme: themeSchema,
    sidebarCollapsed: z.boolean(),
    collapsedSections: z.array(z.string().max(100)).max(50),
  })
  .partial();

/**
 * Module view preferences validation
 */
export const moduleViewPreferencesSchema = z.object({
  defaultView: z.enum(["cards", "list", "table"]).optional(),
  sortField: z.string().max(50).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  columnVisibility: z.array(z.string().max(50)).max(100).optional(),
  pageSize: z.number().int().min(5).max(100).optional(),
});

/**
 * Dashboard settings update input validation
 */
export const updateDashboardSettingsSchema = z.object({
  ui: uiSettingsSchema.optional(),
  modules: z.record(z.string().max(50), moduleViewPreferencesSchema).optional(),
  filters: z
    .record(
      z.string().max(50),
      z.object({
        saved: z
          .array(
            z.object({
              name: z.string().max(100),
              filter: z.record(z.string(), z.unknown()),
            })
          )
          .max(20)
          .optional(),
        lastUsed: z.record(z.string(), z.unknown()).optional(),
        dateRange: z.string().max(50).optional(),
      })
    )
    .optional(),
  dashboard: z
    .object({
      widgetOrder: z.array(z.string().max(100)).max(50).optional(),
      collapsedWidgets: z.array(z.string().max(100)).max(50).optional(),
      quickActions: z.array(z.string().max(100)).max(20).optional(),
    })
    .optional(),
  recent: z
    .object({
      items: z
        .array(
          z.object({
            type: z.string().max(50),
            id: z.string().max(100),
            name: z.string().max(200),
            at: z.string().datetime(),
          })
        )
        .max(10)
        .optional(),
      searches: z.array(z.string().max(200)).max(20).optional(),
    })
    .optional(),
});

/**
 * Sync UI settings input validation
 */
export const syncUiSettingsSchema = z.object({
  theme: themeSchema.optional(),
  sidebarCollapsed: z.boolean().optional(),
  collapsedSections: z.array(z.string().max(100)).max(50).optional(),
  updatedAt: z.string().datetime("Invalid timestamp format"),
});

/**
 * Module settings update input validation
 */
export const updateModuleSettingsSchema = z.object({
  moduleId: moduleIdSchema,
  settings: z.record(z.string().max(100), z.unknown()).refine(
    (val) => {
      // Prevent overly large settings objects
      const jsonStr = JSON.stringify(val);
      return jsonStr.length <= 50000; // 50KB max
    },
    { message: "Module settings too large (max 50KB)" }
  ),
});

/**
 * Set default organization input validation
 */
export const setDefaultOrganizationSchema = z.object({
  organizationId: uuidSchema,
});

/**
 * Set default branch input validation
 */
export const setDefaultBranchSchema = z.object({
  branchId: uuidSchema,
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================
// Note: These types are the validated input types from Zod.
// The canonical types are in @/lib/types/user-preferences.ts
// These are prefixed with "Validated" to avoid confusion.

export type ValidatedUpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ValidatedUpdateRegionalInput = z.infer<typeof updateRegionalSchema>;
export type ValidatedUpdateNotificationSettingsInput = z.infer<
  typeof updateNotificationSettingsSchema
>;
export type ValidatedUpdateDashboardSettingsInput = z.infer<typeof updateDashboardSettingsSchema>;
export type ValidatedSyncUiSettingsInput = z.infer<typeof syncUiSettingsSchema>;
export type ValidatedUpdateModuleSettingsInput = z.infer<typeof updateModuleSettingsSchema>;
