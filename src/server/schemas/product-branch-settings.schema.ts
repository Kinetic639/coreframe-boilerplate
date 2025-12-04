/**
 * Product Branch Settings Schemas
 * Zod validation schemas for per-warehouse product configuration
 */

import { z } from "zod";

// =====================================================
// ENUMS
// =====================================================

export const reorderCalculationMethodSchema = z.enum(["fixed", "min_max", "auto"]);

export type ReorderCalculationMethod = z.infer<typeof reorderCalculationMethodSchema>;

// =====================================================
// BASE SCHEMAS
// =====================================================

/**
 * Create product branch settings input
 */
export const createProductBranchSettingsSchema = z
  .object({
    product_id: z.string().uuid("Invalid product ID"),
    branch_id: z.string().uuid("Invalid branch ID"),
    organization_id: z.string().uuid("Invalid organization ID"),

    // Inventory thresholds
    reorder_point: z.number().min(0, "Reorder point must be non-negative").optional().nullable(),
    max_stock_level: z
      .number()
      .min(0, "Max stock level must be non-negative")
      .optional()
      .nullable(),
    min_stock_level: z
      .number()
      .min(0, "Min stock level must be non-negative")
      .optional()
      .nullable(),
    reorder_quantity: z
      .number()
      .min(0, "Reorder quantity must be non-negative")
      .optional()
      .nullable(),
    reorder_calculation_method: reorderCalculationMethodSchema.optional().nullable(),

    // Warehouse preferences
    track_inventory: z.boolean().default(true),
    send_low_stock_alerts: z.boolean().default(false),
    lead_time_days: z.number().min(0, "Lead time must be non-negative").optional().nullable(),

    // Optional default location
    preferred_receiving_location_id: z.string().uuid("Invalid location ID").optional().nullable(),
  })
  .refine(
    (data) => {
      // If min and max are both set, min must be less than max
      if (
        data.min_stock_level !== null &&
        data.min_stock_level !== undefined &&
        data.max_stock_level !== null &&
        data.max_stock_level !== undefined
      ) {
        return data.min_stock_level <= data.max_stock_level;
      }
      return true;
    },
    {
      message: "Minimum stock level must be less than or equal to maximum stock level",
      path: ["min_stock_level"],
    }
  )
  .refine(
    (data) => {
      // If reorder point is set, it should be between min and max (if they exist)
      if (data.reorder_point !== null && data.reorder_point !== undefined) {
        if (data.min_stock_level !== null && data.min_stock_level !== undefined) {
          if (data.reorder_point < data.min_stock_level) return false;
        }
        if (data.max_stock_level !== null && data.max_stock_level !== undefined) {
          if (data.reorder_point > data.max_stock_level) return false;
        }
      }
      return true;
    },
    {
      message: "Reorder point should be between minimum and maximum stock levels",
      path: ["reorder_point"],
    }
  );

/**
 * Update product branch settings input
 */
export const updateProductBranchSettingsSchema = z
  .object({
    // Inventory thresholds
    reorder_point: z.number().min(0, "Reorder point must be non-negative").optional().nullable(),
    max_stock_level: z
      .number()
      .min(0, "Max stock level must be non-negative")
      .optional()
      .nullable(),
    min_stock_level: z
      .number()
      .min(0, "Min stock level must be non-negative")
      .optional()
      .nullable(),
    reorder_quantity: z
      .number()
      .min(0, "Reorder quantity must be non-negative")
      .optional()
      .nullable(),
    reorder_calculation_method: reorderCalculationMethodSchema.optional().nullable(),

    // Warehouse preferences
    track_inventory: z.boolean().optional(),
    send_low_stock_alerts: z.boolean().optional(),
    lead_time_days: z.number().min(0, "Lead time must be non-negative").optional().nullable(),

    // Optional default location
    preferred_receiving_location_id: z.string().uuid("Invalid location ID").optional().nullable(),
  })
  .refine(
    (data) => {
      // If min and max are both set, min must be less than max
      if (
        data.min_stock_level !== null &&
        data.min_stock_level !== undefined &&
        data.max_stock_level !== null &&
        data.max_stock_level !== undefined
      ) {
        return data.min_stock_level <= data.max_stock_level;
      }
      return true;
    },
    {
      message: "Minimum stock level must be less than or equal to maximum stock level",
      path: ["min_stock_level"],
    }
  )
  .refine(
    (data) => {
      // If reorder point is set, it should be between min and max (if they exist)
      if (data.reorder_point !== null && data.reorder_point !== undefined) {
        if (data.min_stock_level !== null && data.min_stock_level !== undefined) {
          if (data.reorder_point < data.min_stock_level) return false;
        }
        if (data.max_stock_level !== null && data.max_stock_level !== undefined) {
          if (data.reorder_point > data.max_stock_level) return false;
        }
      }
      return true;
    },
    {
      message: "Reorder point should be between minimum and maximum stock levels",
      path: ["reorder_point"],
    }
  );

/**
 * Initialize settings for all branches input
 */
export const initializeForAllBranchesSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  organization_id: z.string().uuid("Invalid organization ID"),
  default_settings: z
    .object({
      reorder_point: z.number().min(0).optional().nullable(),
      max_stock_level: z.number().min(0).optional().nullable(),
      min_stock_level: z.number().min(0).optional().nullable(),
      reorder_quantity: z.number().min(0).optional().nullable(),
      reorder_calculation_method: reorderCalculationMethodSchema.optional().nullable(),
      track_inventory: z.boolean().optional(),
      send_low_stock_alerts: z.boolean().optional(),
      lead_time_days: z.number().min(0).optional().nullable(),
      preferred_receiving_location_id: z.string().uuid().optional().nullable(),
    })
    .optional(),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type CreateProductBranchSettingsInput = z.infer<typeof createProductBranchSettingsSchema>;
export type UpdateProductBranchSettingsInput = z.infer<typeof updateProductBranchSettingsSchema>;
export type InitializeForAllBranchesInput = z.infer<typeof initializeForAllBranchesSchema>;
