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

// ─── Locations V2 schemas ─────────────────────────────────────────────────────

const locationCategorySchema = z
  .enum([
    "area",
    "zone",
    "room",
    "cabinet",
    "rack",
    "shelf_unit",
    "workbench",
    "shelf",
    "drawer",
    "bin",
    "box",
    "pallet_position",
    "wall_storage",
    "receiving",
    "dispatch",
    "quarantine",
    "temporary",
    "custom",
  ])
  .optional();

const positiveMmSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be a whole number")
  .positive("Must be greater than 0")
  .nullable()
  .optional();

// V2 fields added to create/update schemas
const locationV2Fields = {
  can_store_inventory: z.boolean().optional(),
  location_category: locationCategorySchema,
  width_mm: positiveMmSchema,
  height_mm: positiveMmSchema,
  depth_mm: positiveMmSchema,
};

export const createLocationV2Schema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  code: locationCodeSchema,
  description: z.string().max(1000).nullable().optional(),
  icon_name: z.string().max(50).nullable().optional(),
  color: hexColorSchema,
  parent_id: z.string().uuid("Invalid parent location").nullable().optional(),
  group_id: z.string().uuid("Invalid group").nullable().optional(),
  inherit_group_color: z.boolean().optional(),
  inherit_parent_color: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  ...locationV2Fields,
});

export const updateLocationV2Schema = z.object({
  id: z.string().uuid("Invalid location id"),
  name: z.string().min(1).max(200).optional(),
  code: locationCodeSchema,
  description: z.string().max(1000).nullable().optional(),
  icon_name: z.string().max(50).nullable().optional(),
  color: hexColorSchema,
  parent_id: z.string().uuid().nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
  inherit_group_color: z.boolean().optional(),
  inherit_parent_color: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  ...locationV2Fields,
});

export const archiveLocationSchema = z.object({
  id: z.string().uuid("Invalid location id"),
});

export const getLocationMappingStatusSchema = z.object({
  id: z.string().uuid("Invalid location id"),
  layoutId: z.string().uuid().optional(),
});

export const listLocationsWithMappingStatusSchema = z.object({
  layoutId: z.string().uuid().optional(),
});

// ─── Visual node schemas ──────────────────────────────────────────────────────

const viewTypeSchema = z.enum(["top_down", "front", "interior", "side", "3d"]);
const visualRoleSchema = z.enum(["primary", "label", "reference", "aggregate"]);
const visualizationTypeSchema = z.enum([
  "rectangle",
  "cabinet",
  "rack",
  "grid",
  "drawer",
  "bin",
  "zone",
  "custom",
]);

export const upsertVisualNodeSchema = z.object({
  id: z.string().uuid().optional(),
  layout_id: z.string().uuid("Invalid layout id"),
  location_id: z.string().uuid("Invalid location id"),
  view_type: viewTypeSchema,
  view_context_location_id: z.string().uuid().nullable().optional(),
  visualization_type: visualizationTypeSchema.optional(),
  visual_role: visualRoleSchema.optional(),
  x_mm: z.number().int(),
  y_mm: z.number().int(),
  z_mm: z.number().int().optional(),
  width_mm: z.number().int().positive("width_mm must be positive"),
  height_mm: z.number().int().positive("height_mm must be positive"),
  depth_mm: z.number().int().positive().nullable().optional(),
  rotation_deg: z.number().optional(),
  style: z.record(z.unknown()).nullable().optional(),
  z_index: z.number().int().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const batchUpsertVisualNodesSchema = z.object({
  layout_id: z.string().uuid("Invalid layout id"),
  nodes: z
    .array(upsertVisualNodeSchema.omit({ layout_id: true }))
    .min(0)
    .max(500),
  replace_scope: z.boolean().optional(),
  view_type: viewTypeSchema.optional(),
  view_context_location_id: z.string().uuid().nullable().optional(),
});

export const removeVisualNodeSchema = z.object({
  nodeId: z.string().uuid("Invalid node id"),
});

export const getUnmappedLocationsSchema = z.object({
  layoutId: z.string().uuid("Invalid layout id"),
  viewContextLocationId: z.string().uuid().nullable().optional(),
});

export const listVisualNodesSchema = z.object({
  layoutId: z.string().uuid("Invalid layout id"),
  viewType: viewTypeSchema.optional(),
  viewContextLocationId: z.string().uuid().nullable().optional(),
  includeHidden: z.boolean().optional(),
});

// ─── Split node schemas ───────────────────────────────────────────────────────

const splitNodeKindSchema = z.enum(["container", "cell"]);
const splitDirectionSchema = z.enum(["horizontal", "vertical"]);
const splitSizeModeSchema = z.enum(["equal", "ratio", "fixed", "auto"]);

export const createSplitNodeSchema = z.object({
  layout_id: z.string().uuid("Invalid layout id"),
  parent_node_id: z.string().uuid().nullable().optional(),
  parent_visual_node_id: z.string().uuid().nullable().optional(),
  view_context_location_id: z.string().uuid().nullable().optional(),
  node_kind: splitNodeKindSchema,
  split_direction: splitDirectionSchema.nullable().optional(),
  size_mode: splitSizeModeSchema.optional(),
  size_value: z.number().positive().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
  linked_location_id: z.string().uuid().nullable().optional(),
});

export const resizeSplitSchema = z.object({
  nodeId: z.string().uuid("Invalid node id"),
  sizeMode: splitSizeModeSchema,
  sizeValue: z.number().positive().nullable().optional(),
});

export const removeSplitNodeSchema = z.object({
  nodeId: z.string().uuid("Invalid node id"),
});

export const linkSplitToLocationSchema = z.object({
  splitNodeId: z.string().uuid("Invalid split node id"),
  locationId: z.string().uuid("Invalid location id"),
});

export const unlinkSplitFromLocationSchema = z.object({
  splitNodeId: z.string().uuid("Invalid split node id"),
});

export const listSplitNodesSchema = z.object({
  layoutId: z.string().uuid("Invalid layout id"),
  parentVisualNodeId: z.string().uuid().nullable().optional(),
});

// Inferred types
export type CreateLocationV2Input = z.infer<typeof createLocationV2Schema>;
export type UpdateLocationV2Input = z.infer<typeof updateLocationV2Schema>;
export type UpsertVisualNodeSchemaInput = z.infer<typeof upsertVisualNodeSchema>;
export type BatchUpsertVisualNodesInput = z.infer<typeof batchUpsertVisualNodesSchema>;
export type CreateSplitNodeSchemaInput = z.infer<typeof createSplitNodeSchema>;
