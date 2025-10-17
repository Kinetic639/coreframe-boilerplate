import { createClient } from "@/utils/supabase/client";
import type {
  OptionGroupWithValues,
  CreateOptionGroupData,
  UpdateOptionGroupData,
  CreateOptionValueData,
  UpdateOptionValueData,
  VariantOptionValue,
} from "../types/option-groups";

export class OptionGroupsService {
  private supabase = createClient();

  /**
   * Get all option groups for an organization with their values
   */
  async getOptionGroups(organizationId: string): Promise<OptionGroupWithValues[]> {
    const { data, error } = await this.supabase
      .from("variant_option_groups")
      .select(
        `
        *,
        values:variant_option_values(*)
      `
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) throw error;

    // Also order values within each group
    const groupsWithSortedValues = (data || []).map((group: any) => ({
      ...group,
      values: (group.values || []).sort(
        (a: VariantOptionValue, b: VariantOptionValue) =>
          (a.display_order || 0) - (b.display_order || 0)
      ),
    }));

    return groupsWithSortedValues;
  }

  /**
   * Get a single option group by ID with its values
   */
  async getOptionGroup(groupId: string): Promise<OptionGroupWithValues | null> {
    const { data, error } = await this.supabase
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

    if (error) throw error;
    return data;
  }

  /**
   * Create a new option group with optional values
   */
  async createOptionGroup(groupData: CreateOptionGroupData): Promise<OptionGroupWithValues> {
    // 1. Create the group
    const { data: group, error: groupError } = await this.supabase
      .from("variant_option_groups")
      .insert({
        organization_id: groupData.organization_id,
        name: groupData.name,
        display_order: groupData.display_order || 0,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Create values if provided
    if (groupData.values && groupData.values.length > 0) {
      const valueInserts = groupData.values.map((v, index) => ({
        option_group_id: group.id,
        value: v.value,
        display_order: v.display_order !== undefined ? v.display_order : index,
      }));

      const { error: valuesError } = await this.supabase
        .from("variant_option_values")
        .insert(valueInserts);

      if (valuesError) {
        // Rollback: delete the group
        await this.supabase.from("variant_option_groups").delete().eq("id", group.id);
        throw valuesError;
      }
    }

    // 3. Fetch and return the complete group
    const createdGroup = await this.getOptionGroup(group.id);
    if (!createdGroup) {
      throw new Error("Failed to fetch created option group");
    }

    return createdGroup;
  }

  /**
   * Update an existing option group
   */
  async updateOptionGroup(groupData: UpdateOptionGroupData): Promise<OptionGroupWithValues> {
    const updateData: any = {};

    if (groupData.name !== undefined) updateData.name = groupData.name;
    if (groupData.display_order !== undefined) updateData.display_order = groupData.display_order;

    const { error } = await this.supabase
      .from("variant_option_groups")
      .update(updateData)
      .eq("id", groupData.id);

    if (error) throw error;

    const updatedGroup = await this.getOptionGroup(groupData.id);
    if (!updatedGroup) {
      throw new Error("Failed to fetch updated option group");
    }

    return updatedGroup;
  }

  /**
   * Soft delete an option group
   */
  async deleteOptionGroup(groupId: string): Promise<void> {
    const { error } = await this.supabase
      .from("variant_option_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId);

    if (error) throw error;
  }

  // ==========================================
  // OPTION VALUE OPERATIONS
  // ==========================================

  /**
   * Get all values for an option group
   */
  async getOptionValues(groupId: string): Promise<VariantOptionValue[]> {
    const { data, error } = await this.supabase
      .from("variant_option_values")
      .select("*")
      .eq("option_group_id", groupId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Add a value to an option group
   */
  async createOptionValue(valueData: CreateOptionValueData): Promise<VariantOptionValue> {
    const { data, error } = await this.supabase
      .from("variant_option_values")
      .insert({
        option_group_id: valueData.option_group_id,
        value: valueData.value,
        display_order: valueData.display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an option value
   */
  async updateOptionValue(valueData: UpdateOptionValueData): Promise<VariantOptionValue> {
    const updateData: any = {};

    if (valueData.value !== undefined) updateData.value = valueData.value;
    if (valueData.display_order !== undefined) updateData.display_order = valueData.display_order;

    const { data, error } = await this.supabase
      .from("variant_option_values")
      .update(updateData)
      .eq("id", valueData.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Soft delete an option value
   */
  async deleteOptionValue(valueId: string): Promise<void> {
    const { error } = await this.supabase
      .from("variant_option_values")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", valueId);

    if (error) throw error;
  }
}

export const optionGroupsService = new OptionGroupsService();
