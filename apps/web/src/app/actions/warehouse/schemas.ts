/**
 * Warehouse action Zod schemas.
 * Shared by server actions and client-side form validation.
 */

import { z } from "zod";

// Hex colour: exactly #RRGGBB — null/undefined allowed (means "no colour set")
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Colour must be a 6-digit hex value (e.g. #FF5733)")
  .nullable()
  .optional();

// Location code: alphanumeric, forward slashes, hyphens and underscores; max 20 chars
const locationCodeSchema = z
  .string()
  .max(20, "Code must be 20 characters or fewer")
  .regex(
    /^[A-Za-z0-9_/-]+$/,
    "Code may only contain letters, numbers, forward slashes, hyphens, and underscores"
  )
  .nullable()
  .optional();

const positiveMetersSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .positive("Must be greater than 0")
  .nullable()
  .optional();

const nonNegativeMetersSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .min(0, "Must be greater than or equal to 0")
  .nullable()
  .optional();

const elevationLevelSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be a whole number")
  .min(1, "Must be at least 1")
  .optional();

const locationMapRoleSchema = z
  .enum(["logical", "layout_root", "top_down_unit", "front_segment", "top_storage_segment"])
  .optional();

export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  code: locationCodeSchema,
  description: z
    .string()
    .max(1000, "Description must be 1000 characters or fewer")
    .nullable()
    .optional(),
  icon_name: z.string().max(50, "Icon name must be 50 characters or fewer").nullable().optional(),
  color: hexColorSchema,
  parent_id: z.string().uuid("Invalid parent location").nullable().optional(),
  group_id: z.string().uuid("Invalid group").nullable().optional(),
  inherit_group_color: z.boolean().optional(),
  inherit_parent_color: z.boolean().optional(),
  physical_width_m: positiveMetersSchema,
  physical_depth_m: positiveMetersSchema,
  physical_height_m: positiveMetersSchema,
  physical_elevation_start_m: nonNegativeMetersSchema,
  elevation_level: elevationLevelSchema,
  map_role: locationMapRoleSchema,
  storage_mode: z.string().max(50).optional(),
  allow_top_storage: z.boolean().optional(),
  can_store_inventory: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateLocationSchema = z.object({
  id: z.string().uuid("Invalid location id"),
  name: z.string().min(1, "Name is required").max(200).optional(),
  code: locationCodeSchema,
  description: z.string().max(1000).nullable().optional(),
  icon_name: z.string().max(50).nullable().optional(),
  color: hexColorSchema,
  parent_id: z.string().uuid("Invalid parent location").nullable().optional(),
  group_id: z.string().uuid("Invalid group").nullable().optional(),
  inherit_group_color: z.boolean().optional(),
  inherit_parent_color: z.boolean().optional(),
  physical_width_m: positiveMetersSchema,
  physical_depth_m: positiveMetersSchema,
  physical_height_m: positiveMetersSchema,
  physical_elevation_start_m: nonNegativeMetersSchema,
  elevation_level: elevationLevelSchema,
  map_role: locationMapRoleSchema,
  storage_mode: z.string().max(50).optional(),
  allow_top_storage: z.boolean().optional(),
  can_store_inventory: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ─── Location group schemas ───────────────────────────────────────────────────

export const createLocationGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .nullable()
    .optional(),
  color: hexColorSchema,
  sort_order: z.number().int().min(0).optional(),
  parent_location_id: z.string().uuid("Invalid parent location").nullable().optional(),
});

export const updateLocationGroupSchema = z.object({
  id: z.string().uuid("Invalid group id"),
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema,
  sort_order: z.number().int().min(0).optional(),
  parent_location_id: z.string().uuid("Invalid parent location").nullable().optional(),
});

export const deleteLocationGroupSchema = z.object({
  id: z.string().uuid("Invalid group id"),
});

export const reorderGroupsSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }))
    .min(1)
    .max(200),
});
export type ReorderGroupsInput = z.infer<typeof reorderGroupsSchema>;

export type CreateLocationGroupInput = z.infer<typeof createLocationGroupSchema>;
export type UpdateLocationGroupInput = z.infer<typeof updateLocationGroupSchema>;

export const deleteLocationSchema = z.object({
  id: z.string().uuid("Invalid location id"),
});

export const getLocationSchema = z.object({
  id: z.string().uuid("Invalid location id"),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const reorderLocationsSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }))
    .min(1)
    .max(200),
});
export type ReorderLocationsInput = z.infer<typeof reorderLocationsSchema>;
