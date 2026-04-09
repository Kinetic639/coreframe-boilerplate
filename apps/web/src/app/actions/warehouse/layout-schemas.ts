/**
 * Zod schemas for warehouse layout and shape server actions.
 * Shared by server actions and client-side form validation.
 */

import { z } from "zod";

// ─── Shared validators ────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid("Invalid ID format");

const canvasDimensionSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .positive("Must be greater than 0")
  .max(10_000, "Canvas dimension cannot exceed 10 000 m");

// ─── Layout schemas ───────────────────────────────────────────────────────────

export const createLayoutSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  // root_location_code is used server-side only to set the code on the auto-created
  // root warehouse_location. It is NOT stored on the layout row itself.
  root_location_code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or fewer")
    .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, hyphens and underscores"),
  description: z.string().max(1000).nullable().optional(),
  canvas_width_m: canvasDimensionSchema.optional(),
  canvas_height_m: canvasDimensionSchema.optional(),
});

export const updateLayoutSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  canvas_width_m: canvasDimensionSchema.optional(),
  canvas_height_m: canvasDimensionSchema.optional(),
});

export const layoutIdSchema = z.object({
  id: uuidSchema,
});

// ─── Shape schemas ────────────────────────────────────────────────────────────

const shapeTypeSchema = z.enum(["location", "wall", "door", "aisle", "zone", "obstacle", "label"]);

const shapeStyleSchema = z
  .object({
    fill: z.string().optional(),
    fillOpacity: z.number().min(0).max(1).optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().min(0).optional(),
    cornerRadius: z.number().min(0).optional(),
    fontSize: z.number().positive().optional(),
    fontWeight: z.string().optional(),
    textColor: z.string().optional(),
    // Location code label style
    labelColor: z.string().optional(),
    labelSize: z.number().positive().optional(),
    labelAlignH: z.enum(["left", "center", "right"]).optional(),
    labelAlignV: z.enum(["top", "center", "bottom"]).optional(),
  })
  .nullable()
  .optional();

/** Single shape upsert — used both as a standalone action and within batchSaveShapes */
export const shapeUpsertSchema = z.object({
  id: uuidSchema,
  shape_type: shapeTypeSchema,
  // Preprocess: coerce empty string → null so a drag-and-drop that clears
  // locationId to "" doesn't fail UUID validation.
  location_id: z.preprocess((val) => (val === "" ? null : val), uuidSchema.nullable().optional()),
  label: z.string().max(200).nullable().optional(),
  x: z.number({ required_error: "x is required" }).finite(),
  y: z.number({ required_error: "y is required" }).finite(),
  width: z.number().positive("Width must be > 0"),
  height: z.number().positive("Height must be > 0"),
  rotation: z.number().finite(),
  style: shapeStyleSchema,
  z_index: z.number().int().optional(),
  sort_order: z.number().int().min(0).optional(),
});

/** Batch save — full canvas state sent from the editor on each save */
export const batchSaveShapesSchema = z.object({
  layout_id: uuidSchema,
  shapes: z.array(shapeUpsertSchema).max(2_000, "A layout cannot contain more than 2 000 shapes"),
});

export const upsertOneShapeSchema = z.object({
  layout_id: uuidSchema,
  shape: shapeUpsertSchema,
});

export const deleteShapeSchema = z.object({
  id: uuidSchema,
});

// ─── Inferred types (usable on the client side) ───────────────────────────────

export const createLayoutForLocationSchema = z.object({
  /** The existing warehouse_location.id that will become this layout's root. */
  location_id: uuidSchema,
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  description: z.string().max(1000).nullable().optional(),
  canvas_width_m: canvasDimensionSchema.optional(),
  canvas_height_m: canvasDimensionSchema.optional(),
});

export type CreateLayoutInput = z.infer<typeof createLayoutSchema>;
export type CreateLayoutForLocationInput = z.infer<typeof createLayoutForLocationSchema>;
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;
export type ShapeUpsertSchemaInput = z.infer<typeof shapeUpsertSchema>;
export type BatchSaveShapesInput = z.infer<typeof batchSaveShapesSchema>;
