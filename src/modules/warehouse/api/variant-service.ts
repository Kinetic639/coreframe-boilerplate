import { createClient } from "@/utils/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";
import type { ProductAttribute, AttributeValue } from "../types/flexible-products";
import {
  templateInheritanceService,
  type TemplateInheritanceData,
} from "./template-inheritance-service";

// Variant management types
export type Variant = Tables<"product_variants">;
export type CreateVariantRequest = TablesInsert<"product_variants"> & {
  attributes?: Record<string, AttributeValue>;
  images?: {
    storage_path: string;
    file_name: string;
    alt_text?: string;
    context_scope?: string;
    is_primary?: boolean;
  }[];
};

export type UpdateVariantRequest = TablesUpdate<"product_variants"> & {
  attributes?: Record<string, AttributeValue>;
  images?: {
    storage_path: string;
    file_name: string;
    alt_text?: string;
    context_scope?: string;
    is_primary?: boolean;
  }[];
};

export type VariantWithAttributes = Variant & {
  attributes: ProductAttribute[];
  images: Tables<"product_images">[];
  stock_snapshots: Tables<"stock_snapshots">[];
};

export class VariantService {
  private supabase = createClient();

  /**
   * Create a new variant for a product with template inheritance
   */
  async createVariant(
    productId: string,
    variantData: CreateVariantRequest
  ): Promise<VariantWithAttributes> {
    try {
      const { attributes, images, ...variantFields } = variantData;

      // 1. Get template inheritance data
      const inheritanceData =
        await templateInheritanceService.getTemplateInheritanceData(productId);

      // 2. Generate inherited attributes (merge with provided attributes)
      let finalAttributes = attributes || {};
      if (inheritanceData) {
        const inheritedAttributes = templateInheritanceService.generateInheritedAttributes(
          inheritanceData,
          attributes || {}
        );
        finalAttributes = { ...inheritedAttributes, ...finalAttributes };
      }

      // 3. Create the variant
      const variantInsert: TablesInsert<"product_variants"> = {
        product_id: productId,
        name: variantFields.name || "Default Variant",
        slug:
          variantFields.slug || variantFields.name?.toLowerCase().replace(/\s+/g, "-") || "default",
        sku: variantFields.sku,
        barcode: variantFields.barcode,
        is_default: variantFields.is_default || false,
        status: variantFields.status || "active",
      };

      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert(variantInsert)
        .select()
        .single();

      if (variantError) throw variantError;

      // 4. Add inherited + custom attributes
      if (Object.keys(finalAttributes).length > 0) {
        await this.updateVariantAttributes(variant.id, finalAttributes);
      }

      // 5. Add images if provided
      if (images && images.length > 0) {
        await this.updateVariantImages(variant.id, images);
      }

      // 6. Return the created variant with relations
      return await this.getVariantById(variant.id);
    } catch (error) {
      console.error("Error creating variant:", error);
      throw error;
    }
  }

  /**
   * Update an existing variant
   */
  async updateVariant(
    variantId: string,
    variantData: UpdateVariantRequest
  ): Promise<VariantWithAttributes> {
    try {
      const { attributes, images, ...variantFields } = variantData;

      // 1. Update the variant
      if (Object.keys(variantFields).length > 0) {
        const { error: variantError } = await this.supabase
          .from("product_variants")
          .update(variantFields)
          .eq("id", variantId);

        if (variantError) throw variantError;
      }

      // 2. Update attributes if provided
      if (attributes && Object.keys(attributes).length > 0) {
        await this.updateVariantAttributes(variantId, attributes);
      }

      // 3. Update images if provided
      if (images && images.length > 0) {
        await this.updateVariantImages(variantId, images);
      }

      // 4. Return the updated variant with relations
      return await this.getVariantById(variantId);
    } catch (error) {
      console.error("Error updating variant:", error);
      throw error;
    }
  }

  /**
   * Delete a variant (soft delete)
   */
  async deleteVariant(variantId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("product_variants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", variantId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting variant:", error);
      throw error;
    }
  }

  /**
   * Get variant by ID with all relations
   */
  async getVariantById(variantId: string): Promise<VariantWithAttributes> {
    try {
      const { data: variant, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes(*),
          images:product_images(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("id", variantId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return variant as VariantWithAttributes;
    } catch (error) {
      console.error("Error getting variant by ID:", error);
      throw error;
    }
  }

  /**
   * Get all variants for a product
   */
  async getVariantsByProduct(productId: string): Promise<VariantWithAttributes[]> {
    try {
      const { data: variants, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes(*),
          images:product_images(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("product_id", productId)
        .is("deleted_at", null)
        .order("created_at");

      if (error) throw error;
      return (variants || []) as VariantWithAttributes[];
    } catch (error) {
      console.error("Error getting variants by product:", error);
      throw error;
    }
  }

  /**
   * Bulk create variants from attribute combinations
   */
  async bulkCreateVariants(
    productId: string,
    variants: CreateVariantRequest[]
  ): Promise<VariantWithAttributes[]> {
    try {
      const createdVariants: VariantWithAttributes[] = [];

      for (const variantData of variants) {
        const variant = await this.createVariant(productId, variantData);
        createdVariants.push(variant);
      }

      return createdVariants;
    } catch (error) {
      console.error("Error bulk creating variants:", error);
      throw error;
    }
  }

  /**
   * Generate variants from attribute matrix
   */
  async generateVariantsFromMatrix(
    productId: string,
    attributeMatrix: Record<string, string[]>,
    baseVariant?: Partial<CreateVariantRequest>
  ): Promise<VariantWithAttributes[]> {
    try {
      // Generate all combinations of attributes
      const combinations = this.generateAttributeCombinations(attributeMatrix);

      const variantRequests: CreateVariantRequest[] = combinations.map((combination, index) => {
        // Create variant name from combination
        const variantName = Object.values(combination).join(" - ");

        // Create SKU from combination (if base SKU provided)
        const variantSku = baseVariant?.sku
          ? `${baseVariant.sku}-${Object.values(combination).join("-").toUpperCase()}`
          : undefined;

        return {
          ...baseVariant,
          product_id: productId,
          name: variantName,
          slug: variantName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          sku: variantSku,
          is_default: index === 0, // First variant is default
          attributes: this.convertToAttributeValues(combination),
        };
      });

      return await this.bulkCreateVariants(productId, variantRequests);
    } catch (error) {
      console.error("Error generating variants from matrix:", error);
      throw error;
    }
  }

  /**
   * Update variant attributes
   */
  private async updateVariantAttributes(
    variantId: string,
    attributes: Record<string, AttributeValue>,
    context: string = "warehouse"
  ): Promise<void> {
    try {
      // Delete existing attributes for this variant and context
      await this.supabase
        .from("product_attributes")
        .delete()
        .eq("variant_id", variantId)
        .eq("context_scope", context);

      // Insert new attributes
      const attributeInserts = Object.entries(attributes).map(([key, attributeValue]) => ({
        product_id: null, // Variant-specific attributes don't need product_id
        variant_id: variantId,
        attribute_key: key,
        value_text: attributeValue.type === "text" ? attributeValue.value : null,
        value_number: attributeValue.type === "number" ? attributeValue.value : null,
        value_boolean: attributeValue.type === "boolean" ? attributeValue.value : null,
        value_date: attributeValue.type === "date" ? attributeValue.value : null,
        value_json: attributeValue.type === "json" ? attributeValue.value : null,
        context_scope: context,
      }));

      const { error } = await this.supabase.from("product_attributes").insert(attributeInserts);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating variant attributes:", error);
      throw error;
    }
  }

  /**
   * Update variant images
   */
  private async updateVariantImages(
    variantId: string,
    images: {
      storage_path: string;
      file_name: string;
      alt_text?: string;
      context_scope?: string;
      is_primary?: boolean;
    }[],
    context: string = "warehouse"
  ): Promise<void> {
    try {
      // Delete existing images for this variant and context
      await this.supabase
        .from("product_images")
        .delete()
        .eq("variant_id", variantId)
        .eq("context_scope", context);

      // Insert new images
      const imageInserts = images.map((image, index) => ({
        product_id: null, // Variant-specific images don't need product_id
        variant_id: variantId,
        storage_path: image.storage_path,
        file_name: image.file_name,
        alt_text: image.alt_text,
        display_order: index,
        context_scope: image.context_scope || context,
        is_primary: image.is_primary || false,
        metadata: {},
      }));

      const { error } = await this.supabase.from("product_images").insert(imageInserts);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating variant images:", error);
      throw error;
    }
  }

  /**
   * Generate all combinations of attributes
   */
  private generateAttributeCombinations(
    attributeMatrix: Record<string, string[]>
  ): Record<string, string>[] {
    const keys = Object.keys(attributeMatrix);
    const values = keys.map((key) => attributeMatrix[key]);

    if (keys.length === 0) return [];
    if (keys.length === 1) {
      return values[0].map((value) => ({ [keys[0]]: value }));
    }

    const combinations: Record<string, string>[] = [];

    function generateCombinations(index: number, current: Record<string, string>) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const currentKey = keys[index];
      const currentValues = values[index];

      for (const value of currentValues) {
        current[currentKey] = value;
        generateCombinations(index + 1, current);
      }
    }

    generateCombinations(0, {});
    return combinations;
  }

  /**
   * Convert string combinations to AttributeValue format
   */
  private convertToAttributeValues(
    combination: Record<string, string>
  ): Record<string, AttributeValue> {
    const attributeValues: Record<string, AttributeValue> = {};

    for (const [key, value] of Object.entries(combination)) {
      // Try to infer type from value
      if (!isNaN(Number(value))) {
        attributeValues[key] = { type: "number", value: Number(value) };
      } else if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
        attributeValues[key] = { type: "boolean", value: value.toLowerCase() === "true" };
      } else {
        attributeValues[key] = { type: "text", value };
      }
    }

    return attributeValues;
  }

  /**
   * Set default variant for a product
   */
  async setDefaultVariant(productId: string, variantId: string): Promise<void> {
    try {
      // First, remove default status from all variants of this product
      await this.supabase
        .from("product_variants")
        .update({ is_default: false })
        .eq("product_id", productId);

      // Then set the specified variant as default
      const { error } = await this.supabase
        .from("product_variants")
        .update({ is_default: true })
        .eq("id", variantId);

      if (error) throw error;
    } catch (error) {
      console.error("Error setting default variant:", error);
      throw error;
    }
  }

  /**
   * Find variant by SKU
   */
  async findVariantBySku(sku: string): Promise<VariantWithAttributes | null> {
    try {
      const { data: variant, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes(*),
          images:product_images(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("sku", sku)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return variant as VariantWithAttributes;
    } catch (error) {
      console.error("Error finding variant by SKU:", error);
      throw error;
    }
  }

  /**
   * Find variant by barcode
   */
  async findVariantByBarcode(barcode: string): Promise<VariantWithAttributes | null> {
    try {
      const { data: variant, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes(*),
          images:product_images(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("barcode", barcode)
        .is("deleted_at", null)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }

      return variant as VariantWithAttributes;
    } catch (error) {
      console.error("Error finding variant by barcode:", error);
      throw error;
    }
  }

  /**
   * Get variant data for a specific context
   */
  async getVariantByContext(
    variantId: string,
    context: string = "warehouse"
  ): Promise<VariantWithAttributes> {
    try {
      const { data: variant, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes!inner(*),
          images:product_images!inner(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("id", variantId)
        .eq("attributes.context_scope", context)
        .eq("images.context_scope", context)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return variant as VariantWithAttributes;
    } catch (error) {
      console.error("Error getting variant by context:", error);
      throw error;
    }
  }

  /**
   * Update variant in a specific context
   */
  async updateVariantInContext(
    variantId: string,
    context: string,
    data: {
      attributes?: Record<string, AttributeValue>;
      images?: {
        storage_path: string;
        file_name: string;
        alt_text?: string;
        is_primary?: boolean;
      }[];
    }
  ): Promise<VariantWithAttributes> {
    try {
      // Update context-specific attributes
      if (data.attributes) {
        await this.updateVariantAttributes(variantId, data.attributes, context);
      }

      // Update context-specific images
      if (data.images) {
        await this.updateVariantImages(variantId, data.images, context);
      }

      return await this.getVariantByContext(variantId, context);
    } catch (error) {
      console.error("Error updating variant in context:", error);
      throw error;
    }
  }

  /**
   * Copy variant data from one context to another
   */
  async copyVariantToContext(
    variantId: string,
    sourceContext: string,
    targetContext: string,
    overrides?: {
      attributes?: Record<string, AttributeValue>;
      images?: {
        storage_path: string;
        file_name: string;
        alt_text?: string;
        is_primary?: boolean;
      }[];
    }
  ): Promise<VariantWithAttributes> {
    try {
      // Get source context data
      const sourceVariant = await this.getVariantByContext(variantId, sourceContext);

      // Prepare target context data
      const targetAttributes = overrides?.attributes || {};
      const targetImages = overrides?.images || [];

      // Copy attributes from source if not overridden
      sourceVariant.attributes.forEach((attr) => {
        if (!targetAttributes[attr.attribute_key]) {
          targetAttributes[attr.attribute_key] = this.getAttributeValue(attr);
        }
      });

      // Copy images from source if not overridden
      if (targetImages.length === 0) {
        sourceVariant.images.forEach((image) => {
          targetImages.push({
            storage_path: image.storage_path,
            file_name: image.file_name,
            alt_text: image.alt_text,
            is_primary: image.is_primary,
          });
        });
      }

      // Update target context
      return await this.updateVariantInContext(variantId, targetContext, {
        attributes: targetAttributes,
        images: targetImages,
      });
    } catch (error) {
      console.error("Error copying variant to context:", error);
      throw error;
    }
  }

  /**
   * Get variants for a product in a specific context
   */
  async getVariantsByProductAndContext(
    productId: string,
    context: string = "warehouse"
  ): Promise<VariantWithAttributes[]> {
    try {
      const { data: variants, error } = await this.supabase
        .from("product_variants")
        .select(
          `
          *,
          attributes:product_attributes!inner(*),
          images:product_images(*),
          stock_snapshots:stock_snapshots(*)
        `
        )
        .eq("product_id", productId)
        .eq("attributes.context_scope", context)
        .is("deleted_at", null)
        .order("created_at");

      if (error) throw error;
      return (variants || []) as VariantWithAttributes[];
    } catch (error) {
      console.error("Error getting variants by product and context:", error);
      throw error;
    }
  }

  /**
   * Helper method to get attribute value from ProductAttribute
   */
  private getAttributeValue(attr: ProductAttribute): AttributeValue {
    if (attr.value_text !== null) return { type: "text", value: attr.value_text };
    if (attr.value_number !== null) return { type: "number", value: attr.value_number };
    if (attr.value_boolean !== null) return { type: "boolean", value: attr.value_boolean };
    if (attr.value_date !== null) return { type: "date", value: attr.value_date };
    if (attr.value_json !== null) return { type: "json", value: attr.value_json };
    return { type: "text", value: "" }; // fallback
  }

  /**
   * Get template inheritance data for variant creation UI
   */
  async getTemplateInheritanceForProduct(
    productId: string
  ): Promise<TemplateInheritanceData | null> {
    try {
      return await templateInheritanceService.getTemplateInheritanceData(productId);
    } catch (error) {
      console.error("Error getting template inheritance data:", error);
      return null;
    }
  }

  /**
   * Check if variant has data in a specific context
   */
  async hasVariantDataInContext(variantId: string, context: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("product_attributes")
        .select("id")
        .eq("variant_id", variantId)
        .eq("context_scope", context)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error("Error checking variant data in context:", error);
      return false;
    }
  }

  /**
   * Get all contexts that have data for a variant
   */
  async getVariantContexts(variantId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from("product_attributes")
        .select("context_scope")
        .eq("variant_id", variantId);

      if (error) throw error;

      // Get unique contexts
      const contexts = [...new Set((data || []).map((attr) => attr.context_scope))];
      return contexts;
    } catch (error) {
      console.error("Error getting variant contexts:", error);
      throw error;
    }
  }
}

export const variantService = new VariantService();
