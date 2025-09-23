import { createClient } from "@/utils/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import type {
  ProductWithDetails,
  AttributeValue,
  TemplateContext,
} from "../types/flexible-products";

// Extended types for variant management
export interface VariantMatrix {
  attributes: string[]; // e.g., ['size', 'color']
  combinations: Record<string, string[]>; // e.g., { size: ['S', 'M', 'L'], color: ['Red', 'Blue'] }
}

export interface VariantCombination {
  name: string;
  attributes: Record<string, AttributeValue>;
  sku?: string;
  barcode?: string;
  pricing?: {
    cost?: number;
    price?: number;
    currency?: string;
  };
}

export interface VariantPricing {
  variant_id: string;
  cost?: number;
  price?: number;
  currency?: string;
  effective_date?: string;
  context?: TemplateContext;
}

export interface VariantPerformance {
  variant_id: string;
  total_sales: number;
  total_quantity_sold: number;
  current_stock: number;
  stock_value: number;
  last_sale_date?: string;
  performance_score: number;
}

export interface BulkVariantOperation {
  operation: "create" | "update" | "delete" | "price_update";
  variants: VariantCombination[] | VariantPricing[];
  options?: {
    // For create operations
    product_id?: string;
    skip_validation?: boolean;
    skip_existing?: boolean;
    validate_unique_sku?: boolean;
    auto_generate_sku?: boolean;
    default_pricing?: VariantPricing;
  };
}

export class VariantService {
  private supabase = createClient();

  /**
   * Generate variant combinations from a matrix
   */
  generateVariantCombinations(
    matrix: VariantMatrix,
    baseProduct: { id: string; name: string },
    options?: {
      sku_pattern?: string; // e.g., "{{product_sku}}-{{size}}-{{color}}"
      name_pattern?: string; // e.g., "{{product_name}} - {{size}} {{color}}"
      auto_pricing?: boolean;
    }
  ): VariantCombination[] {
    const { attributes, combinations } = matrix;
    const allCombinations: VariantCombination[] = [];

    // Generate all possible combinations
    const generateCombinations = (
      attrs: string[],
      current: Record<string, unknown> = {},
      index: number = 0
    ): void => {
      if (index === attrs.length) {
        // Create variant combination
        const name = this.generateVariantName(baseProduct.name, current, options?.name_pattern);
        const sku = this.generateVariantSku(baseProduct.id, current, options?.sku_pattern);

        allCombinations.push({
          name,
          sku,
          attributes: this.convertToAttributeValues(current),
          pricing: options?.auto_pricing ? this.generateDefaultPricing() : undefined,
        });
        return;
      }

      const attr = attrs[index];
      const values = combinations[attr] || [];

      for (const value of values) {
        generateCombinations(attrs, { ...current, [attr]: value }, index + 1);
      }
    };

    generateCombinations(attributes);
    return allCombinations;
  }

  /**
   * Create multiple variants in batch
   */
  async createVariantBatch(
    productId: string,
    variants: VariantCombination[],
    options?: {
      skip_existing?: boolean;
      validate_unique_sku?: boolean;
    }
  ): Promise<ProductWithDetails> {
    try {
      // Validate SKUs are unique if required
      if (options?.validate_unique_sku) {
        const skus = variants.map((v) => v.sku).filter(Boolean);
        if (skus.length !== new Set(skus).size) {
          throw new Error("Duplicate SKUs found in variant batch");
        }
      }

      // Check existing variants if skip_existing is enabled
      let variantsToCreate = variants;
      if (options?.skip_existing) {
        const { data: existingVariants } = await this.supabase
          .from("product_variants")
          .select("sku, name")
          .eq("product_id", productId)
          .is("deleted_at", null);

        const existingSkus = new Set(existingVariants?.map((v) => v.sku) || []);
        const existingNames = new Set(existingVariants?.map((v) => v.name) || []);

        variantsToCreate = variants.filter(
          (v) => !existingSkus.has(v.sku) && !existingNames.has(v.name)
        );
      }

      // Create variants
      for (const variant of variantsToCreate) {
        await this.createSingleVariant(productId, variant);
      }

      // Return updated product
      const { flexibleProductService } = await import("./flexible-products");
      return await flexibleProductService.getProductById(productId);
    } catch (error) {
      console.error("Error creating variant batch:", error);
      throw error;
    }
  }

  /**
   * Update variant pricing in batch
   */
  async updateVariantPricing(pricingUpdates: VariantPricing[]): Promise<void> {
    try {
      // Group by context for batch processing
      const contextGroups = pricingUpdates.reduce(
        (groups, pricing) => {
          const context = pricing.context || "warehouse";
          if (!groups[context]) groups[context] = [];
          groups[context].push(pricing);
          return groups;
        },
        {} as Record<string, VariantPricing[]>
      );

      // Process each context group
      for (const [context, pricings] of Object.entries(contextGroups)) {
        await this.updatePricingForContext(pricings, context as TemplateContext);
      }
    } catch (error) {
      console.error("Error updating variant pricing:", error);
      throw error;
    }
  }

  /**
   * Get variant performance analytics
   */
  async getVariantPerformance(
    productId: string,
    _dateRange?: { from: string; to: string }
  ): Promise<VariantPerformance[]> {
    try {
      // This would use a database function in production
      // For now, return basic data from existing tables
      const { data: variants } = await this.supabase
        .from("product_variants")
        .select(
          `
          id,
          name,
          sku,
          stock_snapshots(quantity_on_hand, total_value)
        `
        )
        .eq("product_id", productId)
        .is("deleted_at", null);

      return (variants || []).map((variant) => ({
        variant_id: variant.id,
        total_sales: 0, // Would come from sales data
        total_quantity_sold: 0, // Would come from sales data
        current_stock: variant.stock_snapshots?.[0]?.quantity_on_hand || 0,
        stock_value: variant.stock_snapshots?.[0]?.total_value || 0,
        performance_score: this.calculatePerformanceScore(variant),
      }));
    } catch (error) {
      console.error("Error getting variant performance:", error);
      throw error;
    }
  }

  /**
   * Auto-generate SKUs for variants
   */
  async generateVariantSkus(
    productId: string,
    pattern?: string
  ): Promise<{ variant_id: string; generated_sku: string }[]> {
    try {
      const { data: variants } = await this.supabase
        .from("product_variants")
        .select(
          `
          id,
          name,
          sku,
          product_id,
          products(name, slug)
        `
        )
        .eq("product_id", productId)
        .is("deleted_at", null);

      const results: { variant_id: string; generated_sku: string }[] = [];

      for (const variant of variants || []) {
        if (!variant.sku) {
          const product = variant.products as { name?: string; slug?: string } | null;
          const generatedSku = await this.generateUniqueVariantSku(
            product?.slug || product?.name || "unknown",
            variant.name,
            pattern
          );

          // Update the variant with the generated SKU
          await this.supabase
            .from("product_variants")
            .update({ sku: generatedSku })
            .eq("id", variant.id);

          results.push({
            variant_id: variant.id,
            generated_sku: generatedSku,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error generating variant SKUs:", error);
      throw error;
    }
  }

  /**
   * Compare variants side by side
   */
  async compareVariants(variantIds: string[]): Promise<{
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      barcode?: string;
      status: string;
      attributes?: Array<{ attribute_key: string }>;
      stock_snapshots?: Array<{
        quantity_on_hand?: number;
        quantity_reserved?: number;
        total_value?: number;
      }>;
      images?: unknown[];
    }>;
    comparison_matrix: Record<string, unknown[]>;
  }> {
    try {
      const { data: variants } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes(*),
          stock_snapshots(quantity_on_hand, quantity_reserved, total_value),
          images:product_images(*)
        `
        )
        .in("id", variantIds)
        .is("deleted_at", null);

      // Extract all unique attribute keys
      const allAttributes = new Set<string>();
      variants?.forEach((variant) => {
        variant.attributes?.forEach((attr) => {
          allAttributes.add(attr.attribute_key);
        });
      });

      // Build comparison matrix
      const comparison_matrix: Record<string, unknown[]> = {};
      Array.from(allAttributes).forEach((attrKey) => {
        comparison_matrix[attrKey] =
          variants?.map((variant) => {
            const attr = variant.attributes?.find((a) => a.attribute_key === attrKey);
            return attr ? this.getAttributeDisplayValue(attr) : null;
          }) || [];
      });

      return {
        variants: variants || [],
        comparison_matrix,
      };
    } catch (error) {
      console.error("Error comparing variants:", error);
      throw error;
    }
  }

  // Private helper methods

  private async createSingleVariant(productId: string, variant: VariantCombination): Promise<void> {
    // Create the variant record
    const { data: newVariant, error: variantError } = await this.supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        name: variant.name,
        slug: this.generateSlug(variant.name),
        sku: variant.sku,
        barcode: variant.barcode,
        is_default: false,
      })
      .select()
      .single();

    if (variantError) throw variantError;

    // Create variant attributes
    if (Object.keys(variant.attributes).length > 0) {
      await this.createVariantAttributes(productId, newVariant.id, variant.attributes);
    }

    // Create pricing records if provided
    if (variant.pricing) {
      const pricingData: VariantPricing = {
        variant_id: newVariant.id,
        ...variant.pricing,
      };
      await this.createVariantPricing(newVariant.id, pricingData);
    }
  }

  private async createVariantAttributes(
    productId: string,
    variantId: string,
    attributes: Record<string, AttributeValue>
  ): Promise<void> {
    const attributeInserts = Object.entries(attributes).map(([key, value]) => ({
      product_id: productId,
      variant_id: variantId,
      attribute_key: key,
      context_scope: "warehouse" as TemplateContext,
      locale: "en",
      ...this.getAttributeValueColumns(value),
    }));

    const { error } = await this.supabase.from("product_attributes").insert(attributeInserts);

    if (error) throw error;
  }

  private async createVariantPricing(variantId: string, pricing: VariantPricing): Promise<void> {
    // This would create records in a variant_pricing table
    // For now, we'll store in metadata or handle differently
    console.warn("Variant pricing creation not yet implemented:", { variantId, pricing });
  }

  private async updatePricingForContext(
    pricings: VariantPricing[],
    context: TemplateContext
  ): Promise<void> {
    // Batch update pricing for a specific context
    for (const pricing of pricings) {
      // Update pricing logic here
      console.warn("Updating pricing for context:", context, pricing);
    }
  }

  private generateVariantName(
    productName: string,
    attributes: Record<string, unknown>,
    pattern?: string
  ): string {
    if (pattern) {
      let name = pattern.replace("{{product_name}}", productName);
      Object.entries(attributes).forEach(([key, value]) => {
        name = name.replace(`{{${key}}}`, String(value));
      });
      return name;
    }

    const attrString = Object.entries(attributes)
      .map(([_key, value]) => `${value}`)
      .join(" ");

    return `${productName} - ${attrString}`;
  }

  private generateVariantSku(
    productId: string,
    attributes: Record<string, unknown>,
    pattern?: string
  ): string {
    if (pattern) {
      let sku = pattern.replace("{{product_sku}}", productId.slice(0, 8));
      Object.entries(attributes).forEach(([key, value]) => {
        sku = sku.replace(`{{${key}}}`, String(value).slice(0, 3).toUpperCase());
      });
      return sku;
    }

    const attrCode = Object.entries(attributes)
      .map(([_key, value]) => String(value).slice(0, 2).toUpperCase())
      .join("");

    return `${productId.slice(0, 8)}-${attrCode}`;
  }

  private async generateUniqueVariantSku(
    productSlug: string,
    variantName: string,
    _pattern?: string
  ): Promise<string> {
    const baseSlug = `${productSlug}-${generateSlug(variantName)}`;

    return await generateUniqueSlug(baseSlug, async (sku) => {
      const { data } = await this.supabase
        .from("product_variants")
        .select("id")
        .eq("sku", sku)
        .is("deleted_at", null)
        .single();
      return !!data;
    });
  }

  private convertToAttributeValues(
    attributes: Record<string, unknown>
  ): Record<string, AttributeValue> {
    const result: Record<string, AttributeValue> = {};

    Object.entries(attributes).forEach(([key, value]) => {
      if (typeof value === "string") {
        result[key] = { type: "text", value };
      } else if (typeof value === "number") {
        result[key] = { type: "number", value };
      } else if (typeof value === "boolean") {
        result[key] = { type: "boolean", value };
      } else {
        result[key] = { type: "text", value: String(value) };
      }
    });

    return result;
  }

  private generateDefaultPricing(): VariantPricing {
    return {
      variant_id: "", // Will be set later
      cost: 0,
      price: 0,
      currency: "USD",
      effective_date: new Date().toISOString(),
      context: "warehouse",
    };
  }

  private calculatePerformanceScore(variant: {
    stock_snapshots?: Array<{ quantity_on_hand?: number; total_value?: number }>;
  }): number {
    // Simple performance scoring algorithm
    const stockLevel = variant.stock_snapshots?.[0]?.quantity_on_hand || 0;
    const stockValue = variant.stock_snapshots?.[0]?.total_value || 0;

    // Base score on stock turnover and value
    let score = 50; // Base score

    if (stockLevel > 0) score += 20;
    if (stockValue > 100) score += 20;
    if (stockLevel > 10) score += 10;

    return Math.min(100, score);
  }

  private getAttributeValueColumns(value: AttributeValue) {
    switch (value.type) {
      case "text":
        return { value_text: value.value };
      case "number":
        return { value_number: value.value };
      case "boolean":
        return { value_boolean: value.value };
      case "date":
        return { value_date: value.value };
      case "json":
        return { value_json: value.value };
      default:
        throw new Error(`Unknown attribute value type: ${(value as { type?: string }).type}`);
    }
  }

  private getAttributeDisplayValue(attr: {
    value_text?: string;
    value_number?: number;
    value_boolean?: boolean;
    value_date?: string;
    value_json?: unknown;
  }): unknown {
    if (attr.value_text) return attr.value_text;
    if (attr.value_number !== null) return attr.value_number;
    if (attr.value_boolean !== null) return attr.value_boolean;
    if (attr.value_date) return attr.value_date;
    if (attr.value_json) return attr.value_json;
    return null;
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36)
    );
  }
}

// Export singleton instance
export const variantService = new VariantService();
