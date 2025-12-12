/**
 * Movement Types Server Actions
 * Co-located with the warehouse/movement-types route
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { MovementTypesService } from "@/server/services/movement-types.service";
import {
  movementTypeFiltersSchema,
  movementValidationInputSchema,
  type PolishDocumentType,
  type MovementCategory,
} from "@/server/schemas/movement-types.schema";

/**
 * Get all movement types
 */
export async function getMovementTypes(filters?: unknown) {
  const ctx = await getUserContext();
  const validatedFilters = filters ? movementTypeFiltersSchema.parse(filters) : undefined;
  return await MovementTypesService.getMovementTypes(ctx.supabase, validatedFilters);
}

/**
 * Get movement types by category
 */
export async function getMovementTypesByCategory(category: MovementCategory) {
  const ctx = await getUserContext();
  return await MovementTypesService.getMovementTypesByCategory(ctx.supabase, category);
}

/**
 * Get single movement type by code
 */
export async function getMovementTypeByCode(code: string) {
  const ctx = await getUserContext();
  return await MovementTypesService.getMovementTypeByCode(ctx.supabase, code);
}

/**
 * Get movement types that allow manual entry
 */
export async function getManualEntryTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getManualEntryTypes(ctx.supabase);
}

/**
 * Get movement types that generate documents
 */
export async function getDocumentGeneratingTypes(documentType?: PolishDocumentType) {
  const ctx = await getUserContext();
  return await MovementTypesService.getDocumentGeneratingTypes(ctx.supabase, documentType);
}

/**
 * Get movement types grouped by category
 */
export async function getMovementTypesGroupedByCategory() {
  const ctx = await getUserContext();
  return await MovementTypesService.getMovementTypesGroupedByCategory(ctx.supabase);
}

/**
 * Get movement type summaries for UI
 */
export async function getMovementTypeSummaries(locale: "pl" | "en" = "en", filters?: unknown) {
  const ctx = await getUserContext();
  const validatedFilters = filters ? movementTypeFiltersSchema.parse(filters) : undefined;
  return await MovementTypesService.getMovementTypeSummaries(
    ctx.supabase,
    locale,
    validatedFilters
  );
}

/**
 * Validate movement requirements
 */
export async function validateMovementRequirements(input: unknown) {
  const ctx = await getUserContext();
  const validated = movementValidationInputSchema.parse(input);
  return await MovementTypesService.validateMovementRequirements(
    ctx.supabase,
    validated.movementTypeCode,
    validated.hasSourceLocation,
    validated.hasDestinationLocation,
    validated.hasReference
  );
}

/**
 * Check if movement type requires approval
 */
export async function requiresApproval(code: string) {
  const ctx = await getUserContext();
  return await MovementTypesService.requiresApproval(ctx.supabase, code);
}

/**
 * Check if movement type generates document
 */
export async function generatesDocument(code: string) {
  const ctx = await getUserContext();
  return await MovementTypesService.generatesDocument(ctx.supabase, code);
}

/**
 * Get Polish document type for movement type
 */
export async function getPolishDocumentType(code: string) {
  const ctx = await getUserContext();
  return await MovementTypesService.getPolishDocumentType(ctx.supabase, code);
}

/**
 * Search movement types by name
 */
export async function searchMovementTypes(searchTerm: string) {
  const ctx = await getUserContext();
  return await MovementTypesService.searchMovementTypes(ctx.supabase, searchTerm);
}

/**
 * Get receipt movement types
 */
export async function getReceiptTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getReceiptTypes(ctx.supabase);
}

/**
 * Get issue movement types
 */
export async function getIssueTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getIssueTypes(ctx.supabase);
}

/**
 * Get transfer movement types
 */
export async function getTransferTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getTransferTypes(ctx.supabase);
}

/**
 * Get adjustment movement types
 */
export async function getAdjustmentTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getAdjustmentTypes(ctx.supabase);
}

/**
 * Get reservation movement types
 */
export async function getReservationTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getReservationTypes(ctx.supabase);
}

/**
 * Get e-commerce movement types
 */
export async function getEcommerceTypes() {
  const ctx = await getUserContext();
  return await MovementTypesService.getEcommerceTypes(ctx.supabase);
}

/**
 * Get movement type statistics
 */
export async function getStatistics() {
  const ctx = await getUserContext();
  return await MovementTypesService.getStatistics(ctx.supabase);
}
