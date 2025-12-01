// =============================================
// Product Custom Fields Service
// Allows users to define custom fields per product
// =============================================

import { createClient } from "@/lib/supabase/client";
import type {
  ProductCustomFieldDefinition,
  ProductCustomFieldValue,
  CreateCustomFieldDefinitionData,
  CreateCustomFieldValueData,
} from "../types/products";

class CustomFieldsService {
  private supabase = createClient();

  // ==========================================
  // CUSTOM FIELD DEFINITIONS
  // ==========================================

  /**
   * Get all custom field definitions for an organization
   */
  async getFieldDefinitions(organizationId: string): Promise<ProductCustomFieldDefinition[]> {
    const { data, error } = await this.supabase
      .from("product_custom_field_definitions")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch field definitions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new custom field definition
   */
  async createFieldDefinition(
    data: CreateCustomFieldDefinitionData
  ): Promise<ProductCustomFieldDefinition> {
    const { data: definition, error } = await this.supabase
      .from("product_custom_field_definitions")
      .insert({
        organization_id: data.organization_id,
        field_name: data.field_name,
        field_type: data.field_type,
        dropdown_options: data.dropdown_options || null,
        display_order: data.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create field definition: ${error.message}`);
    }

    return definition;
  }

  /**
   * Update a custom field definition
   */
  async updateFieldDefinition(
    definitionId: string,
    updates: Partial<CreateCustomFieldDefinitionData>
  ): Promise<ProductCustomFieldDefinition> {
    const updateData: any = {};

    if (updates.field_name !== undefined) updateData.field_name = updates.field_name;
    if (updates.field_type !== undefined) updateData.field_type = updates.field_type;
    if (updates.dropdown_options !== undefined)
      updateData.dropdown_options = updates.dropdown_options;
    if (updates.display_order !== undefined) updateData.display_order = updates.display_order;

    const { data: definition, error } = await this.supabase
      .from("product_custom_field_definitions")
      .update(updateData)
      .eq("id", definitionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update field definition: ${error.message}`);
    }

    return definition;
  }

  /**
   * Soft delete a custom field definition
   */
  async deleteFieldDefinition(definitionId: string): Promise<void> {
    const { error } = await this.supabase
      .from("product_custom_field_definitions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", definitionId);

    if (error) {
      throw new Error(`Failed to delete field definition: ${error.message}`);
    }
  }

  /**
   * Reorder custom field definitions
   */
  async reorderFieldDefinitions(
    updates: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    const promises = updates.map(({ id, display_order }) =>
      this.supabase.from("product_custom_field_definitions").update({ display_order }).eq("id", id)
    );

    await Promise.all(promises);
  }

  // ==========================================
  // CUSTOM FIELD VALUES
  // ==========================================

  /**
   * Get all custom field values for a product
   */
  async getProductFieldValues(productId: string): Promise<ProductCustomFieldValue[]> {
    const { data, error } = await this.supabase
      .from("product_custom_field_values")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      throw new Error(`Failed to fetch field values: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all custom field values for a variant
   */
  async getVariantFieldValues(variantId: string): Promise<ProductCustomFieldValue[]> {
    const { data, error } = await this.supabase
      .from("product_custom_field_values")
      .select("*")
      .eq("variant_id", variantId);

    if (error) {
      throw new Error(`Failed to fetch field values: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Set a custom field value for a product
   */
  async setFieldValue(data: CreateCustomFieldValueData): Promise<ProductCustomFieldValue> {
    const insertData: any = {
      field_definition_id: data.field_definition_id,
      product_id: data.product_id || null,
      variant_id: data.variant_id || null,
    };

    // Set the appropriate value field based on type
    if (typeof data.value === "string") {
      insertData.value_text = data.value;
    } else if (typeof data.value === "number") {
      insertData.value_number = data.value;
    } else if (typeof data.value === "boolean") {
      insertData.value_boolean = data.value;
    } else if (data.value === null) {
      // Allow setting null values
      insertData.value_text = null;
      insertData.value_number = null;
      insertData.value_boolean = null;
      insertData.value_date = null;
    }

    // Use upsert to handle updates
    const { data: fieldValue, error } = await this.supabase
      .from("product_custom_field_values")
      .upsert(insertData, {
        onConflict: data.product_id
          ? "product_id,field_definition_id"
          : "variant_id,field_definition_id",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set field value: ${error.message}`);
    }

    return fieldValue;
  }

  /**
   * Delete a custom field value
   */
  async deleteFieldValue(fieldValueId: string): Promise<void> {
    const { error } = await this.supabase
      .from("product_custom_field_values")
      .delete()
      .eq("id", fieldValueId);

    if (error) {
      throw new Error(`Failed to delete field value: ${error.message}`);
    }
  }

  /**
   * Get field values with their definitions for a product
   */
  async getProductFieldValuesWithDefinitions(productId: string) {
    const { data, error } = await this.supabase
      .from("product_custom_field_values")
      .select(
        `
        *,
        definition:product_custom_field_definitions(*)
      `
      )
      .eq("product_id", productId);

    if (error) {
      throw new Error(`Failed to fetch field values with definitions: ${error.message}`);
    }

    return data || [];
  }
}

// Export singleton instance
export const customFieldsService = new CustomFieldsService();
export default customFieldsService;
