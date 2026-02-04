import { z } from "zod";

// ─── Profile ─────────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
});

// ─── Regional ────────────────────────────────────────────────────────────────

// Common IANA timezones used in the UI dropdowns and validated server-side
export const VALID_TIMEZONES = [
  "UTC",
  // Europe
  "Europe/Warsaw",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Bucharest",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Oslo",
  "Europe/Stockholm",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Kiev",
  "Europe/Moscow",
  "Europe/Istanbul",
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  // Asia
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Mumbai",
  "Asia/Dubai",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Taipei",
  "Asia/Karachi",
  "Asia/Tehran",
  "Asia/Baghdad",
  "Asia/Riyadh",
  // Oceania
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Fiji",
  // Africa
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Africa/Casablanca",
] as const;

export const VALID_DATE_FORMATS = [
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY/MM/DD",
  "D MMM YYYY",
] as const;

export const updateRegionalSchema = z.object({
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.enum(["12h", "24h"]).optional(),
  locale: z.string().optional(),
});

// ─── Notifications ───────────────────────────────────────────────────────────

export const updateNotificationSettingsSchema = z
  .record(z.unknown())
  .transform((val) => val as Record<string, unknown>);

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const updateDashboardSettingsSchema = z
  .record(z.unknown())
  .transform((val) => val as Record<string, unknown>);

// ─── UI sync (localStorage → DB) ─────────────────────────────────────────────

export const syncUiSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
  collapsedSections: z.array(z.string()).optional(),
  updatedAt: z.string(),
});

// ─── Module settings ─────────────────────────────────────────────────────────

export const moduleIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Module ID must be lowercase alphanumeric with hyphens");

export const updateModuleSettingsSchema = z.object({
  moduleId: moduleIdSchema,
  settings: z.record(z.unknown()),
});

// ─── Org / branch defaults ───────────────────────────────────────────────────

export const setDefaultOrganizationSchema = z.object({
  organizationId: z.string().uuid("Must be a valid UUID"),
});

export const setDefaultBranchSchema = z.object({
  branchId: z.string().uuid("Must be a valid UUID"),
});
