// =============================================
// Product Groups Service
// API layer for product group CRUD operations
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  CreateProductGroupFormData,
  ProductGroupDetail,
  UpdateVariantData,
  StockAdjustmentData,
} from "../types/product-groups";
import type { ProductWithDetails, ProductVariantWithDetails } from "../types/products";

class ProductGroupsService {
  private supabase = createClient();

  /**
   * Create a new product group with all variants
   * This is a complex transaction that creates:
   * 1. Parent product (type = item_group)
   * 2. Product group attributes links
   * 3. All variant records
   * 4. Variant attribute value mappings
   * 5. Initial stock movements (if opening stock > 0)
   *
   * @param data - Form data for product group
   * @param organizationId - Organization ID
   * @param userId - User ID creating the product
   * @returns Complete product group with all variants
   */
  async createProductGroup(
    data: CreateProductGroupFormData,
    organizationId: string,
    userId: string
  ): Promise<ProductGroupDetail> {
    // 1. Create parent product (type = item_group, sku = NULL)
    const { data: product, error: productError } = await this.supabase
      .from("products")
      .insert({
        organization_id: organizationId,
        product_type: "item_group",
        name: data.name,
        sku: null, // Item groups don't have SKUs
        description: data.description || null,
        category_id: data.categoryId || null,
        brand: data.brand || null,
        manufacturer: data.manufacturer || null,
        unit: data.unit,
        returnable_item: data.returnableItem,
        dimensions_length: data.dimensionsLength || null,
        dimensions_width: data.dimensionsWidth || null,
        dimensions_height: data.dimensionsHeight || null,
        dimensions_unit: data.dimensionsUnit || null,
        weight: data.weight || null,
        weight_unit: data.weightUnit || null,
        selling_price: data.sellingPrice, // Default for variants
        sales_account: data.salesAccount || null,
        sales_description: data.salesDescription || null,
        cost_price: data.costPrice, // Default for variants
        purchase_account: data.purchaseAccount || null,
        purchase_description: data.purchaseDescription || null,
        preferred_vendor_id: data.preferredVendorId || null,
        track_inventory: data.trackInventory,
        inventory_account: data.inventoryAccount || null,
        reorder_point: data.reorderPoint, // Default for variants
        opening_stock: 0, // Item groups don't have stock, variants do
        status: "active",
        created_by: userId,
      })
      .select()
      .single();

    if (productError) {
      throw new Error(`Failed to create product group: ${productError.message}`);
    }

    try {
      // 2. Handle option groups - create new ones if needed
      const optionGroupMap: Map<string, string> = new Map(); // oldId -> newId mapping

      for (const attr of data.selectedAttributes) {
        const optionGroupId = attr.optionGroup.id;

        // Check if this is a new option group (ID starts with "new-")
        if (optionGroupId.startsWith("new-")) {
          // Create the option group
          const { data: newGroup, error: groupError } = await this.supabase
            .from("variant_option_groups")
            .insert({
              organization_id: organizationId,
              name: attr.optionGroup.name,
              display_order: 0,
            })
            .select()
            .single();

          if (groupError) throw groupError;

          // Map old ID to new ID
          optionGroupMap.set(optionGroupId, newGroup.id);

          // Create option values for this new group
          const valueInserts = attr.optionGroup.values.map((val, index) => ({
            option_group_id: newGroup.id,
            value: val.value,
            display_order: index,
          }));

          const { error: valuesError } = await this.supabase
            .from("variant_option_values")
            .insert(valueInserts);

          if (valuesError) throw valuesError;
        } else {
          // Existing option group - map to itself
          optionGroupMap.set(optionGroupId, optionGroupId);
        }
      }

      // 3. Create product_group_attributes links (which option groups are used)
      const groupAttributeInserts = data.selectedAttributes.map((attr, index) => ({
        product_id: product.id,
        option_group_id: optionGroupMap.get(attr.optionGroup.id) || attr.optionGroup.id,
        display_order: index,
      }));

      const { error: groupAttrError } = await this.supabase
        .from("product_group_attributes")
        .insert(groupAttributeInserts);

      if (groupAttrError) throw groupAttrError;

      // 3. Create all variant records (batch insert)
      const variantInserts = data.generatedVariants.map((v) => ({
        product_id: product.id,
        name: v.name,
        sku: v.sku,
        selling_price: v.sellingPrice,
        cost_price: v.costPrice,
        reorder_point: v.reorderPoint,
        upc: v.upc || null,
        ean: v.ean || null,
        isbn: v.isbn || null,
        is_active: v.isActive,
      }));

      const { data: createdVariants, error: variantsError } = await this.supabase
        .from("product_variants")
        .insert(variantInserts)
        .select();

      if (variantsError) throw variantsError;

      // 4. Fetch the real option values for the created/existing option groups
      const realOptionValues: Map<string, Map<string, string>> = new Map(); // optionGroupId -> (value -> valueId)

      for (const [, newGroupId] of optionGroupMap) {
        const { data: values, error: valuesError } = await this.supabase
          .from("variant_option_values")
          .select("*")
          .eq("option_group_id", newGroupId);

        if (valuesError) throw valuesError;

        const valueMap = new Map<string, string>();
        for (const val of values || []) {
          valueMap.set(val.value, val.id);
        }
        realOptionValues.set(newGroupId, valueMap);
      }

      // 5. Create variant_attribute_values mappings (link variants to option values)
      const attributeValueInserts: Array<{
        variant_id: string;
        option_group_id: string;
        option_value_id: string;
      }> = [];

      for (let i = 0; i < data.generatedVariants.length; i++) {
        const variant = data.generatedVariants[i];
        const createdVariant = createdVariants[i];

        for (const attrValue of variant.attributeValues) {
          // Map old option group ID to real ID
          const realGroupId =
            optionGroupMap.get(attrValue.optionGroupId) || attrValue.optionGroupId;

          // Find the attribute config to get the value name
          const attrConfig = data.selectedAttributes.find(
            (a) => (optionGroupMap.get(a.optionGroup.id) || a.optionGroup.id) === realGroupId
          );

          if (!attrConfig) {
            console.error("Could not find attribute config for group:", realGroupId);
            continue;
          }

          // Find the option value by matching the value name
          const valueName = attrConfig.optionGroup.values.find(
            (v) => v.id === attrValue.optionValueId
          )?.value;

          if (!valueName) {
            console.error("Could not find value name for value ID:", attrValue.optionValueId);
            continue;
          }

          // Get the real value ID from our map
          const realValueId = realOptionValues.get(realGroupId)?.get(valueName);

          if (!realValueId) {
            console.error("Could not find real value ID for:", valueName, "in group:", realGroupId);
            continue;
          }

          attributeValueInserts.push({
            variant_id: createdVariant.id,
            option_group_id: realGroupId,
            option_value_id: realValueId,
          });
        }
      }

      const { error: attrValuesError } = await this.supabase
        .from("variant_attribute_values")
        .insert(attributeValueInserts);

      if (attrValuesError) throw attrValuesError;

      // 6. Fetch and return complete product group
      const productGroup = await this.getProductGroupById(product.id);
      if (!productGroup) {
        throw new Error("Failed to fetch created product group");
      }

      return productGroup;
    } catch (error) {
      // Rollback: delete the parent product (cascade will delete everything else)
      await this.supabase.from("products").delete().eq("id", product.id);
      throw error;
    }
  }

  /**
   * Get product group by ID with all variants and full details
   *
   * @param productId - Product ID
   * @returns Complete product group details or null if not found
   */
  async getProductGroupById(productId: string): Promise<ProductGroupDetail | null> {
    // Fetch parent product
    const { data: product, error: productError } = await this.supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("product_type", "item_group")
      .is("deleted_at", null)
      .single();

    if (productError || !product) return null;

    // Fetch all variants with their attribute values
    const { data: variants, error: variantsError } = await this.supabase
      .from("product_variants")
      .select(
        `
        *,
        attribute_values:variant_attribute_values(
          *,
          option_group:variant_option_groups(*),
          option_value:variant_option_values(*)
        ),
        barcodes:product_barcodes(*),
        images:product_images(*)
      `
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (variantsError) {
      throw new Error(`Failed to fetch variants: ${variantsError.message}`);
    }

    // Fetch option groups used by this product group
    const { data: groupAttributes, error: groupAttrError } = await this.supabase
      .from("product_group_attributes")
      .select(
        `
        *,
        option_group:variant_option_groups(
          *,
          values:variant_option_values(*)
        )
      `
      )
      .eq("product_id", productId)
      .order("display_order", { ascending: true });

    if (groupAttrError) {
      throw new Error(`Failed to fetch group attributes: ${groupAttrError.message}`);
    }

    // Build attributes array with only used values
    const attributes = groupAttributes.map((ga: any) => {
      const usedValueIds = new Set(
        variants.flatMap((v: any) =>
          v.attribute_values
            .filter((av: any) => av.option_group_id === ga.option_group_id)
            .map((av: any) => av.option_value_id)
        )
      );

      return {
        optionGroup: ga.option_group,
        usedValues: ga.option_group.values.filter((v: any) => usedValueIds.has(v.id)),
      };
    });

    // Calculate aggregate stats
    const totalVariants = variants.length;
    const activeVariants = variants.filter((v: any) => v.is_active).length;

    // TODO: Calculate total stock from stock_snapshots table
    const totalStock = 0;

    return {
      product: product as ProductWithDetails,
      variants: variants as ProductVariantWithDetails[],
      attributes,
      totalVariants,
      activeVariants,
      totalStock,
    };
  }

  /**
   * Update a specific variant
   *
   * @param variantId - Variant ID
   * @param data - Fields to update
   * @returns Updated variant
   */
  async updateVariant(
    variantId: string,
    data: UpdateVariantData
  ): Promise<ProductVariantWithDetails> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.sellingPrice !== undefined) updateData.selling_price = data.sellingPrice;
    if (data.costPrice !== undefined) updateData.cost_price = data.costPrice;
    if (data.reorderPoint !== undefined) updateData.reorder_point = data.reorderPoint;
    if (data.upc !== undefined) updateData.upc = data.upc;
    if (data.ean !== undefined) updateData.ean = data.ean;
    if (data.isbn !== undefined) updateData.isbn = data.isbn;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { error } = await this.supabase
      .from("product_variants")
      .update(updateData)
      .eq("id", variantId);

    if (error) {
      throw new Error(`Failed to update variant: ${error.message}`);
    }

    // Fetch and return updated variant
    const { data: variant, error: fetchError } = await this.supabase
      .from("product_variants")
      .select("*")
      .eq("id", variantId)
      .single();

    if (fetchError || !variant) {
      throw new Error("Failed to fetch updated variant");
    }

    return variant as ProductVariantWithDetails;
  }

  /**
   * Soft delete a variant
   *
   * @param variantId - Variant ID to delete
   */
  async deleteVariant(variantId: string): Promise<void> {
    const { error } = await this.supabase
      .from("product_variants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", variantId);

    if (error) {
      throw new Error(`Failed to delete variant: ${error.message}`);
    }
  }

  /**
   * Soft delete a product group (and all its variants via cascade)
   *
   * @param productId - Product group ID to delete
   */
  async deleteProductGroup(productId: string): Promise<void> {
    const { error } = await this.supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      throw new Error(`Failed to delete product group: ${error.message}`);
    }
  }

  /**
   * Adjust stock for a specific variant
   * Creates stock_movements entry and updates stock_snapshots
   *
   * @param data - Stock adjustment data
   */
  async adjustVariantStock(data: StockAdjustmentData): Promise<void> {
    // Note: This would integrate with existing stock management system
    // For now, placeholder that shows the interface

    // TODO: Integrate with existing stock management service
    // This would need to:
    // 1. Create stock_movements entry with appropriate type:
    //    - "adjustment_positive" for increase
    //    - "adjustment_negative" for decrease
    // 2. Update stock_snapshots
    // 3. Handle location-specific stock if locationId is provided

    // Log for debugging
    console.error("Stock adjustment not yet implemented. Data:", data);

    throw new Error("Stock adjustment not yet implemented - integrate with existing stock service");
  }

  /**
   * Bulk update variants (e.g., set all prices, activate/deactivate all)
   *
   * @param variantIds - Array of variant IDs to update
   * @param updates - Fields to update on all variants
   */
  async bulkUpdateVariants(
    variantIds: string[],
    updates: Partial<UpdateVariantData>
  ): Promise<void> {
    const updateData: any = {};

    if (updates.sellingPrice !== undefined) updateData.selling_price = updates.sellingPrice;
    if (updates.costPrice !== undefined) updateData.cost_price = updates.costPrice;
    if (updates.reorderPoint !== undefined) updateData.reorder_point = updates.reorderPoint;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { error } = await this.supabase
      .from("product_variants")
      .update(updateData)
      .in("id", variantIds);

    if (error) {
      throw new Error(`Failed to bulk update variants: ${error.message}`);
    }
  }

  /**
   * Get all variants for a product group
   *
   * @param productId - Product group ID
   * @returns Array of variants
   */
  async getVariantsByProductId(productId: string): Promise<ProductVariantWithDetails[]> {
    const { data, error } = await this.supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch variants: ${error.message}`);
    }

    return (data || []) as ProductVariantWithDetails[];
  }
}

// Export singleton instance
export const productGroupsService = new ProductGroupsService();
export default productGroupsService;
