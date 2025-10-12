import { createClient } from "@/utils/supabase/client";
import type {
  VariantOptionGroup,
  VariantOptionGroupValue,
  VariantOptionGroupWithValues,
  CreateOptionGroupData,
  UpdateOptionGroupData,
  CreateOptionValueData,
  ProductOptionGroup,
  ProductOptionValue,
  ProductOptionGroupWithValues,
  CreateProductOptionGroupData,
  CreateProductOptionValueData,
} from "../types/variant-options";

class VariantOptionsService {
  private supabase = createClient();

  // ============================================
  // Global Template Management
  // ============================================

  async getTemplateGroups(organizationId: string): Promise<VariantOptionGroupWithValues[]> {
    const { data: groups, error: groupsError } = await this.supabase
      .from("variant_option_groups")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_template", true)
      .is("deleted_at", null)
      .order("name");

    if (groupsError) throw groupsError;

    const groupsWithValues = await Promise.all(
      (groups || []).map(async (group) => {
        const { data: values, error: valuesError } = await this.supabase
          .from("variant_option_group_values")
          .select("*")
          .eq("option_group_id", group.id)
          .is("deleted_at", null)
          .order("display_order");

        if (valuesError) throw valuesError;

        return {
          group,
          values: values || [],
          valueCount: values?.length || 0,
        };
      })
    );

    return groupsWithValues;
  }

  async getTemplateGroup(groupId: string): Promise<VariantOptionGroupWithValues> {
    const { data: group, error: groupError } = await this.supabase
      .from("variant_option_groups")
      .select("*")
      .eq("id", groupId)
      .is("deleted_at", null)
      .single();

    if (groupError) throw groupError;

    const { data: values, error: valuesError } = await this.supabase
      .from("variant_option_group_values")
      .select("*")
      .eq("option_group_id", groupId)
      .is("deleted_at", null)
      .order("display_order");

    if (valuesError) throw valuesError;

    return {
      group,
      values: values || [],
      valueCount: values?.length || 0,
    };
  }

  async createTemplateGroup(data: CreateOptionGroupData): Promise<VariantOptionGroup> {
    const { data: group, error } = await this.supabase
      .from("variant_option_groups")
      .insert({
        ...data,
        is_template: true,
      })
      .select()
      .single();

    if (error) throw error;
    return group;
  }

  async updateTemplateGroup(
    groupId: string,
    data: UpdateOptionGroupData
  ): Promise<VariantOptionGroup> {
    const { data: group, error } = await this.supabase
      .from("variant_option_groups")
      .update(data)
      .eq("id", groupId)
      .select()
      .single();

    if (error) throw error;
    return group;
  }

  async deleteTemplateGroup(groupId: string): Promise<void> {
    const { error } = await this.supabase
      .from("variant_option_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId);

    if (error) throw error;
  }

  async addValueToTemplate(data: CreateOptionValueData): Promise<VariantOptionGroupValue> {
    const { data: value, error } = await this.supabase
      .from("variant_option_group_values")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return value;
  }

  async updateTemplateValue(valueId: string, value: string): Promise<VariantOptionGroupValue> {
    const { data: updatedValue, error } = await this.supabase
      .from("variant_option_group_values")
      .update({ value })
      .eq("id", valueId)
      .select()
      .single();

    if (error) throw error;
    return updatedValue;
  }

  async deleteTemplateValue(valueId: string): Promise<void> {
    const { error } = await this.supabase
      .from("variant_option_group_values")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", valueId);

    if (error) throw error;
  }

  async reorderTemplateValues(groupId: string, valueIds: string[]): Promise<void> {
    const updates = valueIds.map((id, index) => ({
      id,
      display_order: index,
    }));

    for (const update of updates) {
      const { error } = await this.supabase
        .from("variant_option_group_values")
        .update({ display_order: update.display_order })
        .eq("id", update.id);

      if (error) throw error;
    }
  }

  // ============================================
  // Product-Specific Option Groups
  // ============================================

  async getProductOptionGroups(productId: string): Promise<ProductOptionGroupWithValues[]> {
    const { data: groups, error: groupsError } = await this.supabase
      .from("product_option_groups")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("display_order");

    if (groupsError) throw groupsError;

    const groupsWithValues = await Promise.all(
      (groups || []).map(async (group) => {
        const { data: values, error: valuesError } = await this.supabase
          .from("product_option_values")
          .select("*")
          .eq("product_option_group_id", group.id)
          .is("deleted_at", null)
          .order("display_order");

        if (valuesError) throw valuesError;

        let templateGroup = undefined;
        if (group.template_group_id) {
          const { data: template } = await this.supabase
            .from("variant_option_groups")
            .select("*")
            .eq("id", group.template_group_id)
            .single();
          templateGroup = template || undefined;
        }

        return {
          group,
          values: values || [],
          templateGroup,
        };
      })
    );

    return groupsWithValues;
  }

  async copyTemplateToProduct(productId: string, templateId: string): Promise<ProductOptionGroup> {
    // Get template group
    const { data: template, error: templateError } = await this.supabase
      .from("variant_option_groups")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError) throw templateError;

    // Create product option group
    const { data: productGroup, error: groupError } = await this.supabase
      .from("product_option_groups")
      .insert({
        product_id: productId,
        template_group_id: templateId,
        name: template.name,
        display_order: 0,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Copy template values to product
    const { data: templateValues, error: valuesError } = await this.supabase
      .from("variant_option_group_values")
      .select("*")
      .eq("option_group_id", templateId)
      .is("deleted_at", null)
      .order("display_order");

    if (valuesError) throw valuesError;

    if (templateValues && templateValues.length > 0) {
      const productValues = templateValues.map((tv) => ({
        product_option_group_id: productGroup.id,
        value: tv.value,
        display_order: tv.display_order,
      }));

      const { error: insertError } = await this.supabase
        .from("product_option_values")
        .insert(productValues);

      if (insertError) throw insertError;
    }

    return productGroup;
  }

  async createProductOptionGroup(data: CreateProductOptionGroupData): Promise<ProductOptionGroup> {
    const { data: group, error } = await this.supabase
      .from("product_option_groups")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return group;
  }

  async addValueToProductGroup(data: CreateProductOptionValueData): Promise<ProductOptionValue> {
    const { data: value, error } = await this.supabase
      .from("product_option_values")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return value;
  }

  async deleteProductOptionValue(valueId: string): Promise<void> {
    const { error } = await this.supabase
      .from("product_option_values")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", valueId);

    if (error) throw error;
  }

  async deleteProductOptionGroup(groupId: string): Promise<void> {
    const { error } = await this.supabase
      .from("product_option_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId);

    if (error) throw error;
  }
}

export const variantOptionsService = new VariantOptionsService();
