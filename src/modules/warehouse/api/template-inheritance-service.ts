import { createClient } from "@/utils/supabase/client";
import { templateService } from "./template-service";
import type { TemplateWithAttributes, ProductAttributeDefinition } from "../types/template";
import type { AttributeValue } from "../types/flexible-products";

export interface InheritableAttribute extends ProductAttributeDefinition {
  current_product_value?: AttributeValue;
  should_inherit: boolean;
  inheritance_source: "template_default" | "product_current" | "none";
}

export interface TemplateInheritanceData {
  template: TemplateWithAttributes;
  inheritable_attributes: InheritableAttribute[];
  variant_specific_attributes: InheritableAttribute[];
  product_current_values: Record<string, AttributeValue>;
}

export class TemplateInheritanceService {
  private supabase = createClient();

  /**
   * Get template inheritance data for a product when creating variants
   */
  async getTemplateInheritanceData(productId: string): Promise<TemplateInheritanceData | null> {
    try {
      // 1. Get product with template information
      const { data: product, error: productError } = await this.supabase
        .from("products")
        .select(
          `
          *,
          template_id,
          product_templates(*)
        `
        )
        .eq("id", productId)
        .single();

      if (productError || !product?.template_id) {
        console.warn("Product not found or has no template:", productError);
        return null;
      }

      // 2. Get full template with attributes
      const template = await templateService.getTemplate(product.template_id);
      if (!template) {
        console.warn("Template not found for product:", productId);
        return null;
      }

      // 3. Get current product attribute values
      const currentValues = await this.getProductCurrentValues(productId);

      // 4. Process attributes for inheritance
      const processedAttributes = this.processAttributesForInheritance(
        template.attributes,
        currentValues
      );

      return {
        template,
        inheritable_attributes: processedAttributes.inheritable,
        variant_specific_attributes: processedAttributes.variantSpecific,
        product_current_values: currentValues,
      };
    } catch (error) {
      console.error("Error getting template inheritance data:", error);
      throw error;
    }
  }

  /**
   * Get current attribute values for a product across all contexts
   */
  private async getProductCurrentValues(
    productId: string
  ): Promise<Record<string, AttributeValue>> {
    try {
      const { data: attributes, error } = await this.supabase
        .from("product_attributes")
        .select("*")
        .eq("product_id", productId)
        .is("variant_id", null); // Product-level attributes only

      if (error) throw error;

      const values: Record<string, AttributeValue> = {};

      attributes?.forEach((attr) => {
        const value = this.extractAttributeValue(attr);
        if (value) {
          values[attr.attribute_key] = value;
        }
      });

      return values;
    } catch (error) {
      console.error("Error getting product current values:", error);
      return {};
    }
  }

  /**
   * Process template attributes and categorize them for inheritance
   */
  private processAttributesForInheritance(
    templateAttributes: ProductAttributeDefinition[],
    currentValues: Record<string, AttributeValue>
  ): { inheritable: InheritableAttribute[]; variantSpecific: InheritableAttribute[] } {
    const inheritable: InheritableAttribute[] = [];
    const variantSpecific: InheritableAttribute[] = [];

    templateAttributes.forEach((attr) => {
      const currentValue = currentValues[attr.slug];
      const shouldInherit = this.shouldAttributeInherit(attr, currentValue);
      const inheritanceSource = this.getInheritanceSource(attr, currentValue);

      const inheritableAttr: InheritableAttribute = {
        ...attr,
        current_product_value: currentValue,
        should_inherit: shouldInherit,
        inheritance_source: inheritanceSource,
        // Set defaults for new inheritance fields if not present
        is_inheritable: attr.is_inheritable ?? true,
        is_variant_specific: attr.is_variant_specific ?? false,
        inherit_by_default: attr.inherit_by_default ?? true,
      };

      if (attr.is_variant_specific) {
        variantSpecific.push(inheritableAttr);
      } else {
        inheritable.push(inheritableAttr);
      }
    });

    return { inheritable, variantSpecific };
  }

  /**
   * Determine if an attribute should be inherited for new variants
   */
  private shouldAttributeInherit(
    attr: ProductAttributeDefinition,
    currentValue?: AttributeValue
  ): boolean {
    // Don't inherit if explicitly marked as non-inheritable
    if (attr.is_inheritable === false) return false;

    // Don't inherit variant-specific attributes unless they have a current value
    if (attr.is_variant_specific) {
      return attr.inherit_by_default === true && !!currentValue;
    }

    // Inherit if has inherit_by_default flag (at this point is_inheritable is not false)
    return !!attr.inherit_by_default;
  }

  /**
   * Determine the source of inheritance for an attribute
   */
  private getInheritanceSource(
    attr: ProductAttributeDefinition,
    currentValue?: AttributeValue
  ): "template_default" | "product_current" | "none" {
    if (!this.shouldAttributeInherit(attr, currentValue)) {
      return "none";
    }

    // If there's a current product value, use that
    if (currentValue) {
      return "product_current";
    }

    // Otherwise use template default if available
    if (attr.default_value != null) {
      return "template_default";
    }

    return "none";
  }

  /**
   * Generate inherited attribute values for a new variant
   */
  generateInheritedAttributes(
    inheritanceData: TemplateInheritanceData,
    overrides: Record<string, AttributeValue> = {}
  ): Record<string, AttributeValue> {
    const inheritedValues: Record<string, AttributeValue> = {};

    // Process inheritable attributes
    inheritanceData.inheritable_attributes.forEach((attr) => {
      if (attr.should_inherit) {
        const key = attr.slug;

        // Use override if provided
        if (overrides[key]) {
          inheritedValues[key] = overrides[key];
          return;
        }

        // Use inheritance source
        if (attr.inheritance_source === "product_current" && attr.current_product_value) {
          inheritedValues[key] = attr.current_product_value;
        } else if (attr.inheritance_source === "template_default" && attr.default_value != null) {
          inheritedValues[key] = this.convertToAttributeValue(attr.default_value, attr.data_type);
        }
      }
    });

    // Add any variant-specific overrides
    Object.keys(overrides).forEach((key) => {
      inheritedValues[key] = overrides[key];
    });

    return inheritedValues;
  }

  /**
   * Extract attribute value from database attribute record
   */
  private extractAttributeValue(attr: Record<string, unknown>): AttributeValue | null {
    if (attr.value_text !== null && attr.value_text !== undefined) {
      return { type: "text", value: String(attr.value_text) };
    }
    if (attr.value_number !== null && attr.value_number !== undefined) {
      return { type: "number", value: Number(attr.value_number) };
    }
    if (attr.value_boolean !== null && attr.value_boolean !== undefined) {
      return { type: "boolean", value: Boolean(attr.value_boolean) };
    }
    if (attr.value_date !== null && attr.value_date !== undefined) {
      return { type: "date", value: String(attr.value_date) };
    }
    if (attr.value_json !== null && attr.value_json !== undefined) {
      return { type: "json", value: attr.value_json };
    }
    return null;
  }

  /**
   * Convert a raw value to AttributeValue based on data type
   */
  private convertToAttributeValue(value: unknown, dataType: string): AttributeValue {
    switch (dataType) {
      case "number":
        return { type: "number", value: Number(value) };
      case "boolean":
        return { type: "boolean", value: Boolean(value) };
      case "date":
        return { type: "date", value: value ? String(value) : "" };
      case "json":
        try {
          return { type: "json", value: typeof value === "string" ? JSON.parse(value) : value };
        } catch {
          return { type: "json", value: value };
        }
      default:
        return { type: "text", value: String(value) };
    }
  }

  /**
   * Update template attribute inheritance settings
   */
  async updateAttributeInheritanceSettings(
    attributeId: string,
    settings: {
      is_inheritable?: boolean;
      is_variant_specific?: boolean;
      inherit_by_default?: boolean;
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("template_attribute_definitions")
        .update(settings)
        .eq("id", attributeId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating attribute inheritance settings:", error);
      throw error;
    }
  }

  /**
   * Bulk update inheritance settings for multiple attributes
   */
  async bulkUpdateInheritanceSettings(
    updates: Array<{
      attributeId: string;
      settings: {
        is_inheritable?: boolean;
        is_variant_specific?: boolean;
        inherit_by_default?: boolean;
      };
    }>
  ): Promise<void> {
    try {
      const promises = updates.map((update) =>
        this.updateAttributeInheritanceSettings(update.attributeId, update.settings)
      );

      await Promise.all(promises);
    } catch (error) {
      console.error("Error bulk updating inheritance settings:", error);
      throw error;
    }
  }
}

export const templateInheritanceService = new TemplateInheritanceService();
