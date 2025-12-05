/**
 * Movement Types Schema
 * Input validation for movement type operations
 */

import { z } from "zod";

/**
 * Movement category enum
 */
export const movementCategorySchema = z.enum([
  "receipt",
  "issue",
  "transfer",
  "adjustment",
  "reservation",
  "ecommerce",
]);

/**
 * Polish document type enum
 */
export const polishDocumentTypeSchema = z.enum([
  "PZ",
  "PZ-K",
  "PZ-ZK",
  "PZ-P",
  "PZ-I",
  "PZ-S",
  "PZ-W",
  "PZ-A",
  "WZ",
  "WZ-K",
  "WZ-ZD",
  "WZ-S",
  "WZ-W",
  "WZ-A",
  "MM",
  "MM-W",
  "MM-P",
  "MM-L",
  "MM-O",
  "MM-Q",
  "RW",
  "RW-P",
  "RW-S",
  "INW",
  "KP",
  "KN",
]);

/**
 * Movement type filters
 */
export const movementTypeFiltersSchema = z.object({
  category: movementCategorySchema.optional(),
  allows_manual_entry: z.boolean().optional(),
  generates_document: z.boolean().optional(),
  polish_document_type: polishDocumentTypeSchema.optional(),
  requires_approval: z.boolean().optional(),
});

/**
 * Movement validation input
 */
export const movementValidationInputSchema = z.object({
  movementTypeCode: z.string(),
  hasSourceLocation: z.boolean(),
  hasDestinationLocation: z.boolean(),
  hasReference: z.boolean(),
});

/**
 * Type exports
 */
export type MovementCategory = z.infer<typeof movementCategorySchema>;
export type PolishDocumentType = z.infer<typeof polishDocumentTypeSchema>;
export type MovementTypeFilters = z.infer<typeof movementTypeFiltersSchema>;
export type MovementValidationInput = z.infer<typeof movementValidationInputSchema>;
