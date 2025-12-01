import { createClient } from "@/lib/supabase/client";
import type { UnitOfMeasure, CreateUnitData, UpdateUnitData } from "../types/units";

export class UnitsService {
  private supabase = createClient();

  /**
   * Get all units for an organization
   */
  async getUnits(organizationId: string): Promise<UnitOfMeasure[]> {
    const { data, error } = await this.supabase
      .from("units_of_measure")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single unit by ID
   */
  async getUnit(unitId: string): Promise<UnitOfMeasure | null> {
    const { data, error } = await this.supabase
      .from("units_of_measure")
      .select("*")
      .eq("id", unitId)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new unit
   */
  async createUnit(unitData: CreateUnitData): Promise<UnitOfMeasure> {
    const { data, error } = await this.supabase
      .from("units_of_measure")
      .insert({
        organization_id: unitData.organization_id,
        name: unitData.name,
        symbol: unitData.symbol,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an existing unit
   */
  async updateUnit(unitData: UpdateUnitData): Promise<UnitOfMeasure> {
    const updateData: any = {};

    if (unitData.name !== undefined) updateData.name = unitData.name;
    if (unitData.symbol !== undefined) updateData.symbol = unitData.symbol;

    const { data, error } = await this.supabase
      .from("units_of_measure")
      .update(updateData)
      .eq("id", unitData.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Soft delete a unit
   */
  async deleteUnit(unitId: string): Promise<void> {
    const { error } = await this.supabase
      .from("units_of_measure")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", unitId);

    if (error) throw error;
  }
}

export const unitsService = new UnitsService();
