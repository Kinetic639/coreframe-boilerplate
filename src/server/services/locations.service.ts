// =============================================
// Locations Service (Server-side)
// Migrated from src/modules/warehouse/api/locations.ts
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateLocationInput,
  UpdateLocationInput,
  LocationFilters,
} from "@/server/schemas/locations.schema";

type Location = Database["public"]["Tables"]["locations"]["Row"];

export interface LocationListResponse {
  locations: Location[];
  total_count: number;
  page: number;
  page_size: number;
}

export class LocationsService {
  /**
   * Get all locations with optional filtering and pagination
   */
  static async getLocations(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    filters: LocationFilters
  ): Promise<LocationListResponse> {
    let query = supabase
      .from("locations")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);

    // Apply filters
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters.parent_location_id !== undefined) {
      if (filters.parent_location_id === null) {
        query = query.is("parent_location_id", null) as any;
      } else {
        query = query.eq("parent_location_id", filters.parent_location_id) as any;
      }
    }

    if (filters.location_type) {
      query = query.eq("location_type", filters.location_type) as any;
    }

    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active) as any;
    }

    // Pagination
    const limit = filters.pageSize;
    const offset = filters.offset || (filters.page - 1) * filters.pageSize;
    query = query.range(offset, offset + limit - 1);

    // Order by
    query = query.order("name", { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }

    return {
      locations: data || [],
      total_count: count || 0,
      page: filters.page,
      page_size: limit,
    };
  }

  /**
   * Get all locations without pagination (for tree view)
   */
  static async getAllLocations(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string
  ): Promise<Location[]> {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch all locations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single location by ID
   */
  static async getLocationById(
    supabase: SupabaseClient<Database>,
    locationId: string
  ): Promise<Location | null> {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch location: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new location
   */
  static async createLocation(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    userId: string,
    input: CreateLocationInput
  ): Promise<Location> {
    const { data, error } = await supabase
      .from("locations")
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        name: input.name,
        code: input.code,
        parent_location_id: input.parent_location_id,
        icon_name: input.icon_name,
        color: input.color,
        description: input.description,
        is_active: input.is_active,
        location_type: input.location_type,
        capacity: input.capacity,
        capacity_unit: input.capacity_unit,
        created_by: userId,
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create location: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing location
   */
  static async updateLocation(
    supabase: SupabaseClient<Database>,
    locationId: string,
    input: UpdateLocationInput
  ): Promise<Location> {
    const { data, error } = await supabase
      .from("locations")
      .update(input as any)
      .eq("id", locationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update location: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete a location
   */
  static async deleteLocation(
    supabase: SupabaseClient<Database>,
    locationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("locations")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", locationId);

    if (error) {
      throw new Error(`Failed to delete location: ${error.message}`);
    }
  }

  /**
   * Permanently delete a location
   */
  static async permanentlyDeleteLocation(
    supabase: SupabaseClient<Database>,
    locationId: string
  ): Promise<void> {
    const { error } = await supabase.from("locations").delete().eq("id", locationId);

    if (error) {
      throw new Error(`Failed to permanently delete location: ${error.message}`);
    }
  }

  /**
   * Reorder locations (update display order)
   */
  static async reorderLocations(
    supabase: SupabaseClient<Database>,
    locationOrders: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    // Update each location's display_order
    const updates = locationOrders.map(({ id, display_order }) =>
      supabase
        .from("locations")
        .update({ display_order } as any)
        .eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      throw new Error(`Failed to reorder locations: ${errors[0].error?.message}`);
    }
  }

  /**
   * Get child locations of a parent location
   */
  static async getChildLocations(
    supabase: SupabaseClient<Database>,
    parentLocationId: string
  ): Promise<Location[]> {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("parent_location_id", parentLocationId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch child locations: ${error.message}`);
    }

    return data || [];
  }
}
