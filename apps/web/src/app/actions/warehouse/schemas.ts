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

// Location code: alphanumeric, hyphens and underscores; max 20 chars
const locationCodeSchema = z
  .string()
  .max(20, "Code must be 20 characters or fewer")
  .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, hyphens, and underscores")
  .nullable()
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
  sort_order: z.number().int().min(0).optional(),
});

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
