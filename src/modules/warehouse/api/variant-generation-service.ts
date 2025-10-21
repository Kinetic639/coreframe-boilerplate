// =============================================
// Variant Generation Service
// Core business logic for generating variant combinations and SKUs
// =============================================

import type {
  SelectedAttribute,
  GeneratedVariant,
  SKUGeneratorConfig,
} from "../types/product-groups";
import { createClient } from "@/utils/supabase/client";

class VariantGenerationService {
  /**
   * Generate all possible variant combinations from selected attributes
   * Uses Cartesian product algorithm
   *
   * Example:
   * - Color: [Red, Blue]
   * - Size: [S, M, L]
   * - Result: 6 variants (Red-S, Red-M, Red-L, Blue-S, Blue-M, Blue-L)
   *
   * @param baseName - Base product name (e.g., "T-Shirt")
   * @param selectedAttributes - Array of attributes with selected values
   * @param defaultPrices - Default prices to apply to all variants
   * @returns Array of generated variant objects
   */
  generateVariantCombinations(
    baseName: string,
    selectedAttributes: SelectedAttribute[],
    defaultPrices: { selling: number; cost: number; reorder: number }
  ): GeneratedVariant[] {
    if (selectedAttributes.length === 0) {
      return [];
    }

    // Build array of value combinations for each attribute
    const attributeValueArrays: Array<{
      groupId: string;
      groupName: string;
      values: Array<{ id: string; name: string }>;
    }> = selectedAttributes.map((attr) => ({
      groupId: attr.optionGroup.id,
      groupName: attr.optionGroup.name,
      values: attr.optionGroup.values
        .filter((v) => attr.selectedValueIds.includes(v.id))
        .map((v) => ({ id: v.id, name: v.value })),
    }));

    // Generate Cartesian product
    const combinations = this.cartesianProduct(attributeValueArrays);

    // Convert to GeneratedVariant objects
    return combinations.map((combo) => {
      // Generate variant name: BaseName-Value1-Value2-Value3
      const variantName = [baseName, ...combo.map((c) => c.valueName)].join("-");

      return {
        name: variantName,
        sku: "", // Will be filled by SKU generator
        attributeValues: combo.map((c) => ({
          optionGroupId: c.groupId,
          optionGroupName: c.groupName,
          optionValueId: c.valueId,
          optionValueName: c.valueName,
        })),
        sellingPrice: defaultPrices.selling,
        costPrice: defaultPrices.cost,
        reorderPoint: defaultPrices.reorder,
        isActive: true,
      };
    });
  }

  /**
   * Cartesian product algorithm
   * Generates all possible combinations of values from multiple arrays
   *
   * @private
   * @param arrays - Arrays of attribute value options
   * @returns All possible combinations
   */
  private cartesianProduct(
    arrays: Array<{
      groupId: string;
      groupName: string;
      values: Array<{ id: string; name: string }>;
    }>
  ): Array<
    Array<{
      groupId: string;
      groupName: string;
      valueId: string;
      valueName: string;
    }>
  > {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) {
      return arrays[0].values.map((v) => [
        {
          groupId: arrays[0].groupId,
          groupName: arrays[0].groupName,
          valueId: v.id,
          valueName: v.name,
        },
      ]);
    }

    const [first, ...rest] = arrays;
    const restProduct = this.cartesianProduct(rest);

    const result: Array<
      Array<{
        groupId: string;
        groupName: string;
        valueId: string;
        valueName: string;
      }>
    > = [];

    for (const value of first.values) {
      for (const combo of restProduct) {
        result.push([
          {
            groupId: first.groupId,
            groupName: first.groupName,
            valueId: value.id,
            valueName: value.name,
          },
          ...combo,
        ]);
      }
    }

    return result;
  }

  /**
   * Generate SKU based on configuration pattern
   *
   * Example:
   * - Base: "T-Shirt"
   * - Attributes: {Color: "Red", Size: "Medium"}
   * - Config: First 3 chars, Upper case, separator "-"
   * - Result: "TSH-RED-MED"
   *
   * @param baseName - Base product name
   * @param attributeValues - Array of attribute name-value pairs
   * @param config - SKU generation configuration
   * @returns Generated SKU string
   */
  generateSKU(
    baseName: string,
    attributeValues: Array<{ name: string; value: string }>,
    config: SKUGeneratorConfig
  ): string {
    const parts: string[] = [];

    // Add base name if configured
    if (config.includeBaseName) {
      const basePart = this.formatTextPart(baseName, config.baseNameFormat, config.baseNameCase);
      parts.push(basePart);
    }

    // Add each attribute value if included
    for (const attrValue of attributeValues) {
      const attrConfig = config.includeAttributes.find((a) => a.attributeName === attrValue.name);

      if (attrConfig && attrConfig.include) {
        const valuePart = this.formatTextPart(
          attrValue.value,
          attrConfig.displayFormat,
          attrConfig.letterCase
        );
        parts.push(valuePart);
      }
    }

    return parts.join(config.separator);
  }

  /**
   * Format text part according to display format and case
   *
   * @private
   * @param text - Text to format
   * @param format - Display format (first 3, last 3, or full)
   * @param letterCase - Letter case transformation
   * @returns Formatted text
   */
  private formatTextPart(
    text: string,
    format: "first" | "last" | "full",
    letterCase: "upper" | "lower" | "title"
  ): string {
    // Remove spaces and special characters
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, "");

    // Apply format (first 3, last 3, or full)
    let formatted: string;
    switch (format) {
      case "first":
        formatted = cleaned.substring(0, 3);
        break;
      case "last":
        formatted = cleaned.substring(Math.max(0, cleaned.length - 3));
        break;
      case "full":
        formatted = cleaned;
        break;
    }

    // Apply letter case
    switch (letterCase) {
      case "upper":
        return formatted.toUpperCase();
      case "lower":
        return formatted.toLowerCase();
      case "title":
        return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
    }
  }

  /**
   * Generate SKUs for all variants using the same pattern
   *
   * @param baseName - Base product name
   * @param variants - Array of variants to generate SKUs for
   * @param config - SKU generation configuration
   * @returns Array of variants with generated SKUs
   */
  generateSKUsForAllVariants(
    baseName: string,
    variants: GeneratedVariant[],
    config: SKUGeneratorConfig
  ): GeneratedVariant[] {
    return variants.map((variant) => ({
      ...variant,
      sku: this.generateSKU(
        baseName,
        variant.attributeValues.map((av) => ({
          name: av.optionGroupName,
          value: av.optionValueName,
        })),
        config
      ),
    }));
  }

  /**
   * Validate that SKU is unique in the organization
   *
   * @param sku - SKU to validate
   * @param organizationId - Organization ID
   * @returns Object with isUnique flag and existing product name if duplicate
   */
  async validateSKUUniqueness(
    sku: string,
    organizationId: string
  ): Promise<{ isUnique: boolean; existingProductName?: string }> {
    const supabase = createClient();

    // Check in products table
    const { data: productData } = await supabase
      .from("products")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("sku", sku)
      .is("deleted_at", null)
      .maybeSingle();

    if (productData) {
      return { isUnique: false, existingProductName: productData.name };
    }

    // Check in product_variants table (globally unique)
    const { data: variantData } = await supabase
      .from("product_variants")
      .select("id, name")
      .eq("sku", sku)
      .is("deleted_at", null)
      .maybeSingle();

    if (variantData) {
      return { isUnique: false, existingProductName: variantData.name };
    }

    return { isUnique: true };
  }

  /**
   * Calculate total combinations count
   * Useful for showing preview: "This will create X variants"
   *
   * @param selectedAttributes - Array of selected attributes
   * @returns Total number of combinations
   */
  calculateCombinationsCount(selectedAttributes: SelectedAttribute[]): number {
    if (selectedAttributes.length === 0) return 0;

    return selectedAttributes.reduce((total, attr) => total * attr.selectedValueIds.length, 1);
  }

  /**
   * Generate preview SKU for a single example combination
   * Used in SKU generator dialog to show live preview
   *
   * @param baseName - Base product name
   * @param sampleAttributes - Sample attribute values
   * @param config - SKU configuration
   * @returns Preview SKU string
   */
  generatePreviewSKU(
    baseName: string,
    sampleAttributes: Array<{ name: string; value: string }>,
    config: SKUGeneratorConfig
  ): string {
    return this.generateSKU(baseName, sampleAttributes, config);
  }
}

// Export singleton instance
export const variantGenerationService = new VariantGenerationService();
export default variantGenerationService;
