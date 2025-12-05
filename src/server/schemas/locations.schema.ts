import { z } from "zod";
import { paginationSchema } from "./common";

// Create location input validation
export const createLocationSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(50).nullable().optional(),
  parent_location_id: z.string().uuid().nullable().optional(),
  icon_name: z.string().max(100).nullable().optional(),
  color: z.string().max(7).nullable().optional(), // Hex color format
  description: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  location_type: z.enum(["warehouse", "zone", "aisle", "shelf", "bin"]).default("warehouse"),
  capacity: z.number().nonnegative().nullable().optional(),
  capacity_unit: z.string().max(20).nullable().optional(),
});

// Update location input validation (all fields optional)
export const updateLocationSchema = createLocationSchema.partial();

// Location filters
export const locationFiltersSchema = paginationSchema.extend({
  search: z.string().optional(),
  parent_location_id: z.string().uuid().nullable().optional(),
  location_type: z.enum(["warehouse", "zone", "aisle", "shelf", "bin"]).optional(),
  is_active: z.boolean().optional(),
});

// Export types
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type LocationFilters = z.infer<typeof locationFiltersSchema>;
