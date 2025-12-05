/**
 * Units Service
 * Migrated from src/modules/warehouse/api/units-service.ts
 * Manages units of measure for products
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type { CreateUnitInput, UpdateUnitInput } from "@/server/schemas/units.schema";

// Type definitions
export interface UnitOfMeasure {
  id: string;
  organization_id: string;
  name: string;
  symbol: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export class UnitsService {
  /**
   * Get all units for an organization
   */
  static async getUnits(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<UnitOfMeasure[]> {
    const { data, error } = await supabase
      .from("units_of_measure")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch units: ${error.message}`);
    }

    return (data || []) as UnitOfMeasure[];
  }

  /**
   * Get a single unit by ID
   */
  static async getUnit(
    supabase: SupabaseClient<Database>,
    unitId: string
  ): Promise<UnitOfMeasure | null> {
    const { data, error } = await supabase
      .from("units_of_measure")
      .select("*")
      .eq("id", unitId)
      .is("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch unit: ${error.message}`);
    }

    return (data as UnitOfMeasure) || null;
  }

  /**
   * Create a new unit
   */
  static async createUnit(
    supabase: SupabaseClient<Database>,
    data: CreateUnitInput
  ): Promise<UnitOfMeasure> {
    const { data: unit, error } = await supabase
      .from("units_of_measure")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        symbol: data.symbol || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create unit: ${error.message}`);
    }

    return unit as UnitOfMeasure;
  }

  /**
   * Update an existing unit
   */
  static async updateUnit(
    supabase: SupabaseClient<Database>,
    unitId: string,
    data: UpdateUnitInput
  ): Promise<UnitOfMeasure> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.symbol !== undefined) updateData.symbol = data.symbol;

    const { data: unit, error } = await supabase
      .from("units_of_measure")
      .update(updateData)
      .eq("id", unitId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update unit: ${error.message}`);
    }

    return unit as UnitOfMeasure;
  }

  /**
   * Soft delete a unit
   */
  static async deleteUnit(supabase: SupabaseClient<Database>, unitId: string): Promise<void> {
    const { error } = await supabase
      .from("units_of_measure")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", unitId);

    if (error) {
      throw new Error(`Failed to delete unit: ${error.message}`);
    }
  }
}
