"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import {
  locationFiltersSchema,
  createLocationSchema,
  updateLocationSchema,
} from "@/server/schemas/locations.schema";
import { LocationsService } from "@/server/services/locations.service";

/**
 * Get paginated locations with optional filtering
 */
export async function getLocations(filters: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedFilters = locationFiltersSchema.parse(filters);

    return await LocationsService.getLocations(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      validatedFilters
    );
  } catch (error) {
    console.error("getLocations error:", error);
    throw error;
  }
}

/**
 * Get all locations without pagination (for tree view)
 */
export async function getAllLocations() {
  try {
    const ctx = await getUserContext();
    return await LocationsService.getAllLocations(ctx.supabase, ctx.organizationId, ctx.branchId!);
  } catch (error) {
    console.error("getAllLocations error:", error);
    throw error;
  }
}

/**
 * Get a single location by ID
 */
export async function getLocationById(locationId: string) {
  try {
    const ctx = await getUserContext();
    return await LocationsService.getLocationById(ctx.supabase, locationId);
  } catch (error) {
    console.error("getLocationById error:", error);
    throw error;
  }
}

/**
 * Create a new location
 */
export async function createLocation(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = createLocationSchema.parse(input);

    return await LocationsService.createLocation(
      ctx.supabase,
      ctx.organizationId,
      ctx.branchId!,
      ctx.user.id,
      validatedInput
    );
  } catch (error) {
    console.error("createLocation error:", error);
    throw error;
  }
}

/**
 * Update an existing location
 */
export async function updateLocation(locationId: string, input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = updateLocationSchema.parse(input);

    return await LocationsService.updateLocation(ctx.supabase, locationId, validatedInput);
  } catch (error) {
    console.error("updateLocation error:", error);
    throw error;
  }
}

/**
 * Soft delete a location
 */
export async function deleteLocation(locationId: string) {
  try {
    const ctx = await getUserContext();
    await LocationsService.deleteLocation(ctx.supabase, locationId);
    return { success: true };
  } catch (error) {
    console.error("deleteLocation error:", error);
    throw error;
  }
}

/**
 * Permanently delete a location
 */
export async function permanentlyDeleteLocation(locationId: string) {
  try {
    const ctx = await getUserContext();
    await LocationsService.permanentlyDeleteLocation(ctx.supabase, locationId);
    return { success: true };
  } catch (error) {
    console.error("permanentlyDeleteLocation error:", error);
    throw error;
  }
}

/**
 * Reorder locations
 */
export async function reorderLocations(
  locationOrders: Array<{ id: string; display_order: number }>
) {
  try {
    const ctx = await getUserContext();
    await LocationsService.reorderLocations(ctx.supabase, locationOrders);
    return { success: true };
  } catch (error) {
    console.error("reorderLocations error:", error);
    throw error;
  }
}

/**
 * Get child locations of a parent location
 */
export async function getChildLocations(parentLocationId: string) {
  try {
    const ctx = await getUserContext();
    return await LocationsService.getChildLocations(ctx.supabase, parentLocationId);
  } catch (error) {
    console.error("getChildLocations error:", error);
    throw error;
  }
}
