import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateOptionGroupInput,
  UpdateOptionGroupInput,
  CreateOptionValueInput,
  UpdateOptionValueInput,
} from "@/server/schemas/option-groups.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type VariantOptionGroup = Database["public"]["Tables"]["variant_option_groups"]["Row"];
type VariantOptionValue = Database["public"]["Tables"]["variant_option_values"]["Row"];

export interface OptionGroupWithValues extends VariantOptionGroup {
  values: VariantOptionValue[];
}

// ==========================================
// OPTION GROUPS SERVICE
// ==========================================

export class OptionGroupsService {
  /**
   * Get all option groups for an organization with their values
   */
  static async getOptionGroups(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<OptionGroupWithValues[]> {
    const { data, error } = await supabase
      .from("variant_option_groups")
      .select(
        `
        *,
        values:variant_option_values(*)
      `
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch option groups: ${error.message}`);
    }

    // Also order values within each group
    const groupsWithSortedValues = (data || []).map((group: any) => ({
      ...group,
      values: (group.values || [])
        .filter((v: VariantOptionValue) => !v.deleted_at)
        .sort(
          (a: VariantOptionValue, b: VariantOptionValue) =>
            (a.display_order || 0) - (b.display_order || 0)
        ),
    }));

    return groupsWithSortedValues;
  }

  /**
   * Get a single option group by ID with its values
   */
  static async getOptionGroup(
    supabase: SupabaseClient<Database>,
    groupId: string
  ): Promise<OptionGroupWithValues | null> {
    const { data, error } = await supabase
      .from("variant_option_groups")
      .select(
        `
        *,
        values:variant_option_values(*)
      `
      )
      .eq("id", groupId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch option group: ${error.message}`);
    }

    // Filter out deleted values
    return {
      ...data,
      values: (data.values || []).filter((v: VariantOptionValue) => !v.deleted_at),
    };
  }

  /**
   * Create a new option group with optional values
   */
  static async createOptionGroup(
    supabase: SupabaseClient<Database>,
    groupData: CreateOptionGroupInput
  ): Promise<OptionGroupWithValues> {
    // 1. Create the group
    const { data: group, error: groupError } = await supabase
      .from("variant_option_groups")
      .insert({
        organization_id: groupData.organization_id,
        name: groupData.name,
      })
      .select()
      .single();

    if (groupError) {
      throw new Error(`Failed to create option group: ${groupError.message}`);
    }

    // 2. Create values if provided
    if (groupData.values && groupData.values.length > 0) {
      const valueInserts = groupData.values.map((v, index) => ({
        option_group_id: group.id,
        value: v.value,
        display_order: v.display_order !== undefined ? v.display_order : index,
      }));

      const { error: valuesError } = await supabase
        .from("variant_option_values")
        .insert(valueInserts);

      if (valuesError) {
        // Rollback: delete the group
        await supabase.from("variant_option_groups").delete().eq("id", group.id);
        throw new Error(`Failed to create option values: ${valuesError.message}`);
      }
    }

    // 3. Fetch and return the complete group
    const createdGroup = await this.getOptionGroup(supabase, group.id);
    if (!createdGroup) {
      throw new Error("Failed to fetch created option group");
    }

    return createdGroup;
  }

  /**
   * Update an existing option group
   */
  static async updateOptionGroup(
    supabase: SupabaseClient<Database>,
    groupData: UpdateOptionGroupInput
  ): Promise<OptionGroupWithValues> {
    const updateData: any = {};

    if (groupData.name !== undefined) updateData.name = groupData.name;

    const { error } = await supabase
      .from("variant_option_groups")
      .update(updateData)
      .eq("id", groupData.id);

    if (error) {
      throw new Error(`Failed to update option group: ${error.message}`);
    }

    const updatedGroup = await this.getOptionGroup(supabase, groupData.id);
    if (!updatedGroup) {
      throw new Error("Failed to fetch updated option group");
    }

    return updatedGroup;
  }

  /**
   * Soft delete an option group
   */
  static async deleteOptionGroup(
    supabase: SupabaseClient<Database>,
    groupId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("variant_option_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId);

    if (error) {
      throw new Error(`Failed to delete option group: ${error.message}`);
    }
  }

  // ==========================================
  // OPTION VALUE OPERATIONS
  // ==========================================

  /**
   * Get all values for an option group
   */
  static async getOptionValues(
    supabase: SupabaseClient<Database>,
    groupId: string
  ): Promise<VariantOptionValue[]> {
    const { data, error } = await supabase
      .from("variant_option_values")
      .select("*")
      .eq("option_group_id", groupId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch option values: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add a value to an option group
   */
  static async createOptionValue(
    supabase: SupabaseClient<Database>,
    valueData: CreateOptionValueInput
  ): Promise<VariantOptionValue> {
    const { data, error } = await supabase
      .from("variant_option_values")
      .insert({
        option_group_id: valueData.option_group_id,
        value: valueData.value,
        display_order: valueData.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create option value: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an option value
   */
  static async updateOptionValue(
    supabase: SupabaseClient<Database>,
    valueData: UpdateOptionValueInput
  ): Promise<VariantOptionValue> {
    const updateData: any = {};

    if (valueData.value !== undefined) updateData.value = valueData.value;
    if (valueData.display_order !== undefined) updateData.display_order = valueData.display_order;

    const { data, error } = await supabase
      .from("variant_option_values")
      .update(updateData)
      .eq("id", valueData.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update option value: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete an option value
   */
  static async deleteOptionValue(
    supabase: SupabaseClient<Database>,
    valueId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("variant_option_values")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", valueId);

    if (error) {
      throw new Error(`Failed to delete option value: ${error.message}`);
    }
  }
}
