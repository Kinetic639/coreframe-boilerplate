import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type {
  CreateEnhancedInventoryProductInput,
  CreateInventoryProductInput,
  CreateInventoryUnitInput,
  EnhancedAttributeInput,
  EnhancedCustomFieldValueInput,
  EnhancedVariantInput,
  InventoryCustomFieldDefinition,
  InventoryMasterDataRow,
  InventoryProductDetail,
  InventoryProductImageRow,
  InventoryProductListRow,
  InventoryProductUnitConversionRow,
  InventoryProductVariantListRow,
  InventorySkuCollision,
  InventorySkuTemplateRow,
  InventoryTagRow,
  InventoryTaxRateRow,
  InventoryUnitConversionRow,
  InventoryUnitRow,
  InventoryVariantOption,
  InventoryVariantOptionValue,
  UpdateInventoryProductInput,
} from "@/lib/warehouse/inventory-types";
export type {
  CreateEnhancedInventoryProductInput,
  CreateInventoryProductInput,
  CreateInventoryUnitInput,
  EnhancedAttributeInput,
  EnhancedCustomFieldValueInput,
  EnhancedVariantInput,
  InventoryCustomFieldDefinition,
  InventoryMasterDataRow,
  InventoryProductDetail,
  InventoryProductImageRow,
  InventoryProductListRow,
  InventoryProductUnitConversionRow,
  InventoryProductVariantListRow,
  InventorySkuCollision,
  InventorySkuTemplateRow,
  InventoryTagRow,
  InventoryTaxRateRow,
  InventoryUnitConversionRow,
  InventoryUnitRow,
  InventoryVariantOption,
  InventoryVariantOptionValue,
  UpdateInventoryProductInput,
} from "@/lib/warehouse/inventory-types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  product_type: string;
  status: string;
  base_unit_id: string;
  default_variant_id: string | null;
  returnable: boolean;
  brand_name: string | null;
  manufacturer_name: string | null;
  length_value: number | null;
  width_value: number | null;
  height_value: number | null;
  dimension_unit: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  sales_description: string | null;
  purchase_description: string | null;
  preferred_supplier_id: string | null;
  sales_account_code: string | null;
  purchase_account_code: string | null;
  tax_code: string | null;
  tax_rate_percent: number | null;
  updated_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  status: string;
  is_default: boolean;
  barcode: string | null;
  purchase_price: number | null;
  sales_price: number | null;
  price_currency: string | null;
};

type BalanceRow = {
  variant_id: string;
  on_hand_quantity: number;
  available_quantity: number | null;
};

type ProductListIndexRow = {
  product_id: string;
  variant_id: string;
};

const PRODUCT_COLUMNS =
  "id, name, description, product_type, status, base_unit_id, default_variant_id, returnable, brand_name, manufacturer_name, length_value, width_value, height_value, dimension_unit, weight_value, weight_unit, sales_description, purchase_description, preferred_supplier_id, sales_account_code, purchase_account_code, tax_code, tax_rate_percent, updated_at" as const;
const VARIANT_COLUMNS =
  "id, product_id, sku, name, status, is_default, barcode, purchase_price, sales_price, price_currency" as const;
const UNIT_COLUMNS = "id, code, name" as const;

function applyProductSort(query: any, sort: DataViewListParams["sort"]) {
  const sortMap: Record<string, string> = {
    name: "name",
    sku: "updated_at",
    product_type: "product_type",
    status: "status",
    on_hand_quantity: "updated_at",
    available_quantity: "updated_at",
    updated_at: "updated_at",
  };
  const field = sort?.field ? sortMap[sort.field] : "updated_at";
  const ascending = sort?.direction === "asc";
  return query.order(field ?? "updated_at", { ascending });
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function intersectProductIds(current: string[] | null, next: string[]): string[] {
  if (current === null) return next;
  const allowed = new Set(next);
  return current.filter((id) => allowed.has(id));
}

function formatCustomFieldDisplayValue(row: {
  value_text?: string | null;
  value_number?: number | string | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
}): string {
  if (row.value_text) return row.value_text;
  if (row.value_number != null) return String(row.value_number);
  if (row.value_date) return row.value_date;
  if (row.value_boolean != null) return row.value_boolean ? "Yes" : "No";
  if (Array.isArray(row.value_json)) return row.value_json.map(String).join(", ");
  if (row.value_json && typeof row.value_json === "object") return JSON.stringify(row.value_json);
  if (row.value_json != null) return String(row.value_json);
  return "";
}

function serviceError(result: ServiceResult<unknown>) {
  return (result as { success: false; error: string }).error;
}

export class InventoryProductsService {
  static async listProducts(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<InventoryProductListRow>>> {
    const groupVariants = params.filters.__group_variants !== false;
    const isVariantFilter = params.filters.is_variant;
    let query = supabase
      .from("inventory_products")
      .select(PRODUCT_COLUMNS, { count: "exact" })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (params.search) {
      query = query.ilike("name", `%${params.search}%`);
    }

    const status = params.filters.status;
    if (typeof status === "string" && status) {
      query = query.eq("status", status);
    }

    const productType = params.filters.product_type;
    if (typeof productType === "string" && productType) {
      query = query.eq("product_type", productType);
    }

    const filteredProductIds = await InventoryProductsService.resolveProductListFilterProductIds(
      supabase,
      orgId,
      params.filters
    );
    if (!filteredProductIds.success)
      return { success: false, error: serviceError(filteredProductIds) };
    if (filteredProductIds.data) {
      if (filteredProductIds.data.length === 0) {
        return {
          success: true,
          data: {
            rows: [],
            totalCount: 0,
            page: params.page,
            pageSize: params.pageSize,
          },
        };
      }
      query = query.in("id", filteredProductIds.data);
    }

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    const shouldFlattenVariants = !groupVariants;
    if (shouldFlattenVariants) {
      return InventoryProductsService.listUngroupedProductRows(
        supabase,
        orgId,
        params,
        filteredProductIds.data,
        from,
        to,
        typeof isVariantFilter === "boolean" ? isVariantFilter : null
      );
    }

    const sortedQuery = applyProductSort(query, params.sort);
    const { data, error, count } = await sortedQuery.range(from, to);

    if (error) return { success: false, error: error.message };

    const products = (data ?? []) as ProductRow[];
    const rows = await InventoryProductsService.enrichProducts(supabase, orgId, products);
    if (!rows.success)
      return { success: false, error: (rows as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        rows: rows.data,
        totalCount: count ?? rows.data.length,
        page: params.page,
        pageSize: params.pageSize,
      },
    };
  }

  private static async listUngroupedProductRows(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams,
    filteredProductIds: string[] | null,
    from: number,
    to: number,
    isVariantFilter: boolean | null
  ): Promise<ServiceResult<PaginatedResult<InventoryProductListRow>>> {
    const client = supabase as any;
    let indexQuery = client
      .from("inventory_product_list_rows_v1")
      .select("product_id, variant_id", { count: "exact" })
      .eq("organization_id", orgId);

    if (params.search) {
      indexQuery = indexQuery.ilike("product_name", `%${params.search}%`);
    }

    const status = params.filters.status;
    if (typeof status === "string" && status) {
      indexQuery = indexQuery.eq("status", status);
    }

    const productType = params.filters.product_type;
    if (typeof productType === "string" && productType) {
      indexQuery = indexQuery.eq("product_type", productType);
    }

    if (filteredProductIds) {
      indexQuery = indexQuery.in("product_id", filteredProductIds);
    }

    if (isVariantFilter !== null) {
      indexQuery = indexQuery.eq("is_variant_row", isVariantFilter);
    }

    const sortMap: Record<string, string> = {
      name: "variant_name",
      sku: "variant_sku",
      product_type: "product_type",
      status: "status",
      updated_at: "updated_at",
      on_hand_quantity: "updated_at",
      available_quantity: "updated_at",
    };
    const sortField = params.sort?.field ? sortMap[params.sort.field] : "updated_at";
    const sortAscending = params.sort?.direction === "asc";
    const {
      data: indexRowsData,
      error: indexError,
      count,
    } = await indexQuery
      .order(sortField ?? "updated_at", { ascending: sortAscending })
      .order("variant_id", { ascending: true })
      .range(from, to);

    if (indexError) return { success: false, error: indexError.message };
    const indexRows = (indexRowsData ?? []) as ProductListIndexRow[];
    if (indexRows.length === 0) {
      return {
        success: true,
        data: {
          rows: [],
          totalCount: count ?? 0,
          page: params.page,
          pageSize: params.pageSize,
        },
      };
    }

    const productIds = [...new Set(indexRows.map((row) => row.product_id))];
    const { data: productsData, error: productsError } = await supabase
      .from("inventory_products")
      .select(PRODUCT_COLUMNS)
      .eq("organization_id", orgId)
      .in("id", productIds)
      .is("deleted_at", null);
    if (productsError) return { success: false, error: productsError.message };

    const enriched = await InventoryProductsService.enrichProducts(
      supabase,
      orgId,
      (productsData ?? []) as ProductRow[]
    );
    if (!enriched.success) return { success: false, error: serviceError(enriched) };

    const flattened = InventoryProductsService.flattenProductRows(enriched.data);
    const rowsByVariantId = new Map<string, InventoryProductListRow>();
    for (const row of flattened) {
      const variantId = row.variant_id ?? row.variants[0]?.id;
      if (variantId) rowsByVariantId.set(variantId, row);
    }

    return {
      success: true,
      data: {
        rows: indexRows.flatMap((row) => {
          const item = rowsByVariantId.get(row.variant_id);
          return item ? [item] : [];
        }),
        totalCount: count ?? indexRows.length,
        page: params.page,
        pageSize: params.pageSize,
      },
    };
  }

  static async getProductDetail(
    supabase: SupabaseClient,
    orgId: string,
    productId: string
  ): Promise<ServiceResult<InventoryProductDetail | null>> {
    const normalizedProductId = productId.includes("::") ? productId.split("::")[0] : productId;
    const { data, error } = await supabase
      .from("inventory_products")
      .select(PRODUCT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("id", normalizedProductId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    const enriched = await InventoryProductsService.enrichProducts(supabase, orgId, [
      data as ProductRow,
    ]);
    if (!enriched.success)
      return { success: false, error: (enriched as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        ...enriched.data[0],
        description: (data as ProductRow).description,
        base_unit_id: (data as ProductRow).base_unit_id,
        default_variant_id: (data as ProductRow).default_variant_id,
        returnable: (data as ProductRow).returnable,
        brand_name: (data as ProductRow).brand_name,
        manufacturer_name: (data as ProductRow).manufacturer_name,
        length_value: toNullableNumber((data as ProductRow).length_value),
        width_value: toNullableNumber((data as ProductRow).width_value),
        height_value: toNullableNumber((data as ProductRow).height_value),
        dimension_unit: (data as ProductRow).dimension_unit,
        weight_value: toNullableNumber((data as ProductRow).weight_value),
        weight_unit: (data as ProductRow).weight_unit,
        sales_description: (data as ProductRow).sales_description,
        purchase_description: (data as ProductRow).purchase_description,
        preferred_supplier_id: (data as ProductRow).preferred_supplier_id,
        sales_account_code: (data as ProductRow).sales_account_code,
        purchase_account_code: (data as ProductRow).purchase_account_code,
        tax_code: (data as ProductRow).tax_code,
        tax_rate_percent: toNullableNumber((data as ProductRow).tax_rate_percent),
        images: await InventoryProductsService.listProductImages(supabase, orgId, productId),
        unit_conversions: await InventoryProductsService.listProductUnitConversions(
          supabase,
          orgId,
          productId
        ),
        tags: enriched.data[0].tags,
        variants: enriched.data[0].variants,
      },
    };
  }

  static async createProduct(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateInventoryProductInput,
    userId: string
  ): Promise<ServiceResult<{ product_id: string; variant_id: string; sku: string }>> {
    const { data, error } = await supabase.rpc("inventory_create_product_with_default_variant", {
      p_organization_id: orgId,
      p_name: input.name,
      p_product_type: input.product_type,
      p_base_unit_id: input.base_unit_id,
      p_sku: input.sku ?? null,
      p_description: input.description ?? null,
      p_actor_user_id: userId,
    });

    if (error) return { success: false, error: error.message };
    const created = data as { product_id: string; variant_id: string; sku: string };

    const { error: metadataError } = await supabase
      .from("inventory_products")
      .update({
        returnable: input.returnable ?? true,
        brand_name: input.brand_name?.trim() || null,
        manufacturer_name: input.manufacturer_name?.trim() || null,
        length_value: input.length_value ?? null,
        width_value: input.width_value ?? null,
        height_value: input.height_value ?? null,
        dimension_unit: input.dimension_unit?.trim() || null,
        weight_value: input.weight_value ?? null,
        weight_unit: input.weight_unit?.trim() || null,
        sales_description: input.sales_description ?? null,
        purchase_description: input.purchase_description ?? null,
        preferred_supplier_id: input.preferred_supplier_id ?? null,
        sales_account_code: input.sales_account_code?.trim() || null,
        purchase_account_code: input.purchase_account_code?.trim() || null,
        tax_code: input.tax_code?.trim() || null,
        tax_rate_percent: input.tax_rate_percent ?? null,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", created.product_id);

    if (metadataError) return { success: false, error: metadataError.message };
    return { success: true, data: created };
  }

  static async createEnhancedProduct(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateEnhancedInventoryProductInput,
    userId: string
  ): Promise<ServiceResult<{ product_id: string; variant_ids: string[]; sku: string }>> {
    const variants = (input.variants ?? []).filter((variant) => variant.name.trim().length > 0);
    const skus = variants.length
      ? variants.map((variant) => variant.sku)
      : ([input.sku].filter(Boolean) as string[]);
    const collisions = await InventoryProductsService.checkSkuCollisions(supabase, orgId, skus);
    if (!collisions.success) return { success: false, error: serviceError(collisions) };
    if (collisions.data.length > 0) {
      return {
        success: false,
        error: `SKU already exists: ${collisions.data.map((collision) => collision.sku).join(", ")}`,
      };
    }

    const { data, error } = await supabase.rpc("inventory_create_enhanced_product", {
      p_organization_id: orgId,
      p_product: {
        name: input.name,
        product_type: input.product_type,
        base_unit_id: input.base_unit_id,
        sku: input.sku ?? null,
        description: input.description ?? null,
        returnable: input.returnable ?? true,
        brand_name: input.brand_name ?? null,
        manufacturer_name: input.manufacturer_name ?? null,
        length_value: input.length_value ?? null,
        width_value: input.width_value ?? null,
        height_value: input.height_value ?? null,
        dimension_unit: input.dimension_unit ?? null,
        weight_value: input.weight_value ?? null,
        weight_unit: input.weight_unit ?? null,
        sales_description: input.sales_description ?? null,
        purchase_description: input.purchase_description ?? null,
        preferred_supplier_id: input.preferred_supplier_id ?? null,
        sales_account_code: input.sales_account_code ?? null,
        purchase_account_code: input.purchase_account_code ?? null,
        tax_code: input.tax_code ?? null,
        tax_rate_percent: input.tax_rate_percent ?? null,
      },
      p_attributes: input.attributes ?? [],
      p_variants: variants,
      p_tags: input.tags ?? [],
      p_custom_fields: input.custom_fields ?? [],
      p_unit_conversions: input.unit_conversions ?? [],
      p_branch_id: input.branch_id ?? null,
      p_actor_user_id: userId,
    });

    if (error) return { success: false, error: error.message };
    const created = data as { product_id: string; variant_ids: string[]; sku: string };
    const createdVariantIds = Array.isArray(created.variant_ids) ? created.variant_ids : [];

    if (
      input.sales_account_code ||
      input.purchase_account_code ||
      input.tax_code ||
      input.tax_rate_percent != null
    ) {
      const { error: accountingError } = await supabase
        .from("inventory_products")
        .update({
          sales_account_code: input.sales_account_code?.trim() || null,
          purchase_account_code: input.purchase_account_code?.trim() || null,
          tax_code: input.tax_code?.trim() || null,
          tax_rate_percent: input.tax_rate_percent ?? null,
          updated_by: userId,
        })
        .eq("organization_id", orgId)
        .eq("id", created.product_id);
      if (accountingError) {
        await InventoryProductsService.cleanupFailedEnhancedProductCreate(
          supabase,
          orgId,
          created.product_id,
          userId
        );
        return { success: false, error: accountingError.message };
      }
    }

    if (input.track_inventory && input.branch_id && input.opening_location_id) {
      const variantsWithIds = variants.length
        ? variants.map((variant, index) => ({ variant, id: createdVariantIds[index] }))
        : [
            {
              variant: { sku: created.sku, name: input.name } as EnhancedVariantInput,
              id: createdVariantIds[0],
            },
          ];
      const openingResult = await InventoryProductsService.createOpeningStockMovement(
        supabase,
        orgId,
        input.branch_id,
        input.opening_location_id,
        input.base_unit_id,
        created.product_id,
        variantsWithIds.filter((row): row is { id: string; variant: EnhancedVariantInput } =>
          Boolean(row.id)
        ),
        userId
      );
      if (!openingResult.success) {
        await InventoryProductsService.cleanupFailedEnhancedProductCreate(
          supabase,
          orgId,
          created.product_id,
          userId
        );
        return { success: false, error: serviceError(openingResult) };
      }
    }

    return {
      success: true,
      data: { product_id: created.product_id, variant_ids: createdVariantIds, sku: created.sku },
    };
  }

  static async createEnhancedProductLegacy(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateEnhancedInventoryProductInput,
    userId: string
  ): Promise<ServiceResult<{ product_id: string; variant_ids: string[]; sku: string }>> {
    const variants = (input.variants ?? []).filter((variant) => variant.name.trim().length > 0);
    const firstVariant = variants[0];
    let productId: string | null = null;
    const createdVariantIds: string[] = [];
    const fail = async (
      error: string
    ): Promise<ServiceResult<{ product_id: string; variant_ids: string[]; sku: string }>> => {
      if (productId) {
        await InventoryProductsService.cleanupFailedEnhancedProductCreate(
          supabase,
          orgId,
          productId,
          userId
        );
      }
      return { success: false, error };
    };

    const created = await InventoryProductsService.createProduct(
      supabase,
      orgId,
      {
        ...input,
        sku: firstVariant?.sku || input.sku,
      },
      userId
    );
    if (!created.success) return { success: false, error: serviceError(created) };

    productId = created.data.product_id;
    const defaultVariantId = created.data.variant_id;
    const attributeValueIds = await InventoryProductsService.ensureAttributeValues(
      supabase,
      orgId,
      input.attributes ?? [],
      userId
    );
    if (!attributeValueIds.success) return fail(serviceError(attributeValueIds));

    if (firstVariant) {
      const updateDefault = await InventoryProductsService.updateVariantForEnhancedCreate(
        supabase,
        orgId,
        defaultVariantId,
        firstVariant,
        userId
      );
      if (!updateDefault.success) return fail(serviceError(updateDefault));
      const optionResult = await InventoryProductsService.setVariantOptionValues(
        supabase,
        orgId,
        defaultVariantId,
        InventoryProductsService.optionValueIdsForVariant(firstVariant, attributeValueIds.data),
        userId
      );
      if (!optionResult.success) return fail(serviceError(optionResult));
      createdVariantIds.push(defaultVariantId);
    } else {
      createdVariantIds.push(defaultVariantId);
    }

    const remainingVariants = variants.slice(1);
    for (const variant of remainingVariants) {
      const { data: inserted, error: insertError } = await supabase
        .from("inventory_variants")
        .insert({
          organization_id: orgId,
          product_id: productId,
          sku: variant.sku.trim(),
          name: variant.name.trim(),
          barcode: variant.barcode?.trim() || null,
          purchase_price: variant.purchase_price ?? null,
          sales_price: variant.sales_price ?? null,
          price_currency: variant.price_currency ?? null,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (insertError) return fail(insertError.message);
      const variantId = (inserted as { id: string }).id;
      const optionResult = await InventoryProductsService.setVariantOptionValues(
        supabase,
        orgId,
        variantId,
        InventoryProductsService.optionValueIdsForVariant(variant, attributeValueIds.data),
        userId
      );
      if (!optionResult.success) return fail(serviceError(optionResult));
      createdVariantIds.push(variantId);
    }

    const variantsWithIds = variants.length
      ? variants.map((variant, index) => ({ variant, id: createdVariantIds[index] }))
      : [
          {
            variant: { sku: created.data.sku, name: input.name } as EnhancedVariantInput,
            id: defaultVariantId,
          },
        ];

    const identifierResult = await InventoryProductsService.writeVariantIdentifiers(
      supabase,
      orgId,
      productId,
      variantsWithIds,
      userId
    );
    if (!identifierResult.success) return fail(serviceError(identifierResult));

    if (input.branch_id) {
      const reorderResult = await InventoryProductsService.writeReorderRules(
        supabase,
        orgId,
        input.branch_id,
        input.preferred_supplier_id ?? null,
        variantsWithIds,
        userId
      );
      if (!reorderResult.success) return fail(serviceError(reorderResult));
    }

    const tagResult = await InventoryProductsService.ensureTagsForProduct(
      supabase,
      orgId,
      productId,
      input.tags ?? [],
      userId
    );
    if (!tagResult.success) return fail(serviceError(tagResult));

    const customFieldResult = await InventoryProductsService.writeCustomFieldValues(
      supabase,
      orgId,
      productId,
      variantsWithIds,
      input.custom_fields ?? [],
      userId
    );
    if (!customFieldResult.success) return fail(serviceError(customFieldResult));

    const unitConversionResult = await InventoryProductsService.replaceProductUnitConversions(
      supabase,
      orgId,
      productId,
      input.unit_conversions ?? [],
      userId
    );
    if (!unitConversionResult.success) return fail(serviceError(unitConversionResult));

    if (input.track_inventory && input.branch_id && input.opening_location_id) {
      const openingResult = await InventoryProductsService.createOpeningStockMovement(
        supabase,
        orgId,
        input.branch_id,
        input.opening_location_id,
        input.base_unit_id,
        productId,
        variantsWithIds,
        userId
      );
      if (!openingResult.success) return fail(serviceError(openingResult));
    }

    return {
      success: true,
      data: { product_id: productId, variant_ids: createdVariantIds, sku: created.data.sku },
    };
  }

  static async updateProduct(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateInventoryProductInput,
    userId: string
  ): Promise<ServiceResult<InventoryProductDetail>> {
    const { data, error } = await supabase
      .from("inventory_products")
      .update({
        name: input.name,
        description: input.description,
        product_type: input.product_type,
        base_unit_id: input.base_unit_id,
        status: input.status,
        returnable: input.returnable,
        brand_name: input.brand_name?.trim() || null,
        manufacturer_name: input.manufacturer_name?.trim() || null,
        length_value: input.length_value ?? null,
        width_value: input.width_value ?? null,
        height_value: input.height_value ?? null,
        dimension_unit: input.dimension_unit?.trim() || null,
        weight_value: input.weight_value ?? null,
        weight_unit: input.weight_unit?.trim() || null,
        sales_description: input.sales_description ?? null,
        purchase_description: input.purchase_description ?? null,
        preferred_supplier_id: input.preferred_supplier_id ?? null,
        sales_account_code: input.sales_account_code?.trim() || null,
        purchase_account_code: input.purchase_account_code?.trim() || null,
        tax_code: input.tax_code?.trim() || null,
        tax_rate_percent: input.tax_rate_percent ?? null,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", input.id)
      .is("deleted_at", null)
      .select(PRODUCT_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };

    if (input.tags) {
      const tagResult = await InventoryProductsService.ensureTagsForProduct(
        supabase,
        orgId,
        input.id,
        input.tags,
        userId
      );
      if (!tagResult.success) return { success: false, error: serviceError(tagResult) };
    }

    if (input.unit_conversions) {
      const unitConversionResult = await InventoryProductsService.replaceProductUnitConversions(
        supabase,
        orgId,
        input.id,
        input.unit_conversions,
        userId
      );
      if (!unitConversionResult.success)
        return { success: false, error: serviceError(unitConversionResult) };
    }

    const detail = await InventoryProductsService.getProductDetail(
      supabase,
      orgId,
      (data as ProductRow).id
    );
    if (!detail.success)
      return { success: false, error: (detail as { success: false; error: string }).error };
    if (!detail.data) return { success: false, error: "Product not found after update" };
    return { success: true, data: detail.data };
  }

  static async replaceVariantOptions(
    supabase: SupabaseClient,
    orgId: string,
    variantId: string,
    options: Array<{ name: string; value: string }>,
    userId: string
  ): Promise<ServiceResult<{ variant_id: string }>> {
    const { data: variant, error: variantError } = await supabase
      .from("inventory_variants")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", variantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (variantError) return { success: false, error: variantError.message };
    if (!variant) return { success: false, error: "Variant not found" };

    const attributes = options
      .map((option) => ({
        name: option.name.trim(),
        values: [option.value.trim()],
      }))
      .filter((option) => option.name && option.values[0]);

    const attributeValues = await InventoryProductsService.ensureAttributeValues(
      supabase,
      orgId,
      attributes,
      userId
    );
    if (!attributeValues.success) return { success: false, error: serviceError(attributeValues) };

    const optionValueIds = attributes
      .map((option) =>
        attributeValues.data.get(`${option.name.toLowerCase()}::${option.values[0].toLowerCase()}`)
      )
      .filter((id): id is string => Boolean(id));

    const { error: deleteError } = await supabase
      .from("inventory_variant_option_values")
      .delete()
      .eq("organization_id", orgId)
      .eq("variant_id", variantId);
    if (deleteError) return { success: false, error: deleteError.message };

    const optionResult = await InventoryProductsService.setVariantOptionValues(
      supabase,
      orgId,
      variantId,
      optionValueIds,
      userId
    );
    if (!optionResult.success) return optionResult;

    await supabase
      .from("inventory_variants")
      .update({ updated_by: userId })
      .eq("organization_id", orgId)
      .eq("id", variantId);

    return { success: true, data: { variant_id: variantId } };
  }

  static async archiveProduct(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_products")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        archived_by: userId,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", productId)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as { id: string } };
  }

  static async listUnits(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryUnitRow[]>> {
    const { data, error } = await supabase
      .from("inventory_units")
      .select(UNIT_COLUMNS)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("code", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as InventoryUnitRow[] };
  }

  static async createUnit(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateInventoryUnitInput,
    userId: string
  ): Promise<ServiceResult<InventoryUnitRow>> {
    const { data, error } = await supabase
      .from("inventory_units")
      .insert({
        organization_id: orgId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        unit_kind: input.unit_kind,
        precision: input.precision ?? 0,
        created_by: userId,
        updated_by: userId,
      })
      .select(UNIT_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventoryUnitRow };
  }

  static async archiveUnit(
    supabase: SupabaseClient,
    orgId: string,
    unitId: string,
    userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const { error } = await supabase
      .from("inventory_units")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("organization_id", orgId)
      .eq("id", unitId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    const client = supabase as any;
    const { error: conversionError } = await client
      .from("inventory_unit_conversions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .or(`from_unit_id.eq.${unitId},to_unit_id.eq.${unitId}`);

    if (conversionError) return { success: false, error: conversionError.message };
    return { success: true, data: { id: unitId } };
  }

  static async listUnitConversions(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryUnitConversionRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_unit_conversions")
      .select(
        "id, from_unit_id, to_unit_id, factor, from_unit:inventory_units!from_unit_id(code), to_unit:inventory_units!to_unit_id(code)"
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: (
        (data ?? []) as Array<{
          id: string;
          from_unit_id: string;
          to_unit_id: string;
          factor: number | string;
          from_unit?: { code?: string | null } | null;
          to_unit?: { code?: string | null } | null;
        }>
      ).map((row) => ({
        id: row.id,
        from_unit_id: row.from_unit_id,
        to_unit_id: row.to_unit_id,
        from_unit_code: row.from_unit?.code ?? "",
        to_unit_code: row.to_unit?.code ?? "",
        factor: toNumber(row.factor),
      })),
    };
  }

  static async archiveUnitConversion(
    supabase: SupabaseClient,
    orgId: string,
    conversionId: string,
    _userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const client = supabase as any;
    const { error } = await client
      .from("inventory_unit_conversions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", conversionId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: conversionId } };
  }

  static async listTaxRates(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryTaxRateRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_tax_rates")
      .select("id, name, code, rate_percent, is_default")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("rate_percent", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as Array<InventoryTaxRateRow & { rate_percent: number | string }>).map(
        (row) => ({
          ...row,
          rate_percent: toNumber(row.rate_percent),
          is_default: Boolean(row.is_default),
        })
      ),
    };
  }

  static async createTaxRate(
    supabase: SupabaseClient,
    orgId: string,
    input: { name: string; code: string; rate_percent: number; is_default?: boolean },
    userId: string
  ): Promise<ServiceResult<InventoryTaxRateRow>> {
    const client = supabase as any;
    if (input.is_default) {
      const { error: clearError } = await client
        .from("inventory_tax_rates")
        .update({ is_default: false, updated_by: userId })
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (clearError) return { success: false, error: clearError.message };
    }

    const { data, error } = await client
      .from("inventory_tax_rates")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        rate_percent: input.rate_percent,
        is_default: input.is_default ?? false,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, name, code, rate_percent, is_default")
      .single();

    if (error) return { success: false, error: error.message };
    const row = data as InventoryTaxRateRow & { rate_percent: number | string };
    return {
      success: true,
      data: {
        ...row,
        rate_percent: toNumber(row.rate_percent),
        is_default: Boolean(row.is_default),
      },
    };
  }

  static async archiveTaxRate(
    supabase: SupabaseClient,
    orgId: string,
    taxRateId: string,
    userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const client = supabase as any;
    const { error } = await client
      .from("inventory_tax_rates")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("organization_id", orgId)
      .eq("id", taxRateId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: taxRateId } };
  }

  static async listBrands(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryMasterDataRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_brands")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as InventoryMasterDataRow[] };
  }

  static async createBrand(
    supabase: SupabaseClient,
    orgId: string,
    name: string,
    userId: string
  ): Promise<ServiceResult<InventoryMasterDataRow>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_brands")
      .insert({
        organization_id: orgId,
        name: name.trim(),
        created_by: userId,
        updated_by: userId,
      })
      .select("id, name")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventoryMasterDataRow };
  }

  static async listManufacturers(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryMasterDataRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_manufacturers")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as InventoryMasterDataRow[] };
  }

  static async createManufacturer(
    supabase: SupabaseClient,
    orgId: string,
    name: string,
    userId: string
  ): Promise<ServiceResult<InventoryMasterDataRow>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_manufacturers")
      .insert({
        organization_id: orgId,
        name: name.trim(),
        created_by: userId,
        updated_by: userId,
      })
      .select("id, name")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventoryMasterDataRow };
  }

  static async listVariantOptions(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryVariantOption[]>> {
    const { data: variantsData, error: variantsError } = await supabase
      .from("inventory_variants")
      .select("id, product_id, sku")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("sku", { ascending: true })
      .limit(500);

    if (variantsError) return { success: false, error: variantsError.message };
    const variants = (variantsData ?? []) as Array<{ id: string; product_id: string; sku: string }>;
    if (variants.length === 0) return { success: true, data: [] };

    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const { data: productsData, error: productsError } = await supabase
      .from("inventory_products")
      .select("id, name, base_unit_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .in("id", productIds);

    if (productsError) return { success: false, error: productsError.message };
    const products = (productsData ?? []) as ProductRow[];
    const unitIds = [...new Set(products.map((p) => p.base_unit_id))];
    const { data: unitsData, error: unitsError } = unitIds.length
      ? await supabase
          .from("inventory_units")
          .select(UNIT_COLUMNS)
          .eq("organization_id", orgId)
          .in("id", unitIds)
      : { data: [], error: null };

    if (unitsError) return { success: false, error: unitsError.message };

    const productsById = new Map(products.map((p) => [p.id, p]));
    const unitsById = new Map(
      ((unitsData ?? []) as InventoryUnitRow[]).map((unit) => [unit.id, unit])
    );

    return {
      success: true,
      data: variants
        .map((variant) => {
          const product = productsById.get(variant.product_id);
          if (!product) return null;
          const unit = unitsById.get(product.base_unit_id);
          return {
            id: variant.id,
            sku: variant.sku,
            label: `${variant.sku} - ${product.name}`,
            product_name: product.name,
            unit_id: product.base_unit_id,
            unit_code: unit?.code ?? "",
          };
        })
        .filter((row): row is InventoryVariantOption => row !== null),
    };
  }

  static async listSuppliers(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<Array<{ id: string; name: string }>>> {
    const { data, error } = await supabase
      .from("inventory_suppliers")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Array<{ id: string; name: string }> };
  }

  static async listOptionGroupsWithValues(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<
    ServiceResult<Array<{ id: string; name: string; values: Array<{ id: string; value: string }> }>>
  > {
    const { data: groupsData, error: groupsError } = await supabase
      .from("inventory_option_groups")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (groupsError) return { success: false, error: groupsError.message };

    const groups = (groupsData ?? []) as Array<{ id: string; name: string }>;
    const groupIds = groups.map((group) => group.id);
    const { data: valuesData, error: valuesError } = groupIds.length
      ? await supabase
          .from("inventory_option_values")
          .select("id, option_group_id, value")
          .eq("organization_id", orgId)
          .in("option_group_id", groupIds)
          .is("deleted_at", null)
          .order("display_order", { ascending: true })
          .order("value", { ascending: true })
      : { data: [], error: null };
    if (valuesError) return { success: false, error: valuesError.message };

    const valuesByGroup = new Map<string, Array<{ id: string; value: string }>>();
    for (const value of (valuesData ?? []) as Array<{
      id: string;
      option_group_id: string;
      value: string;
    }>) {
      const values = valuesByGroup.get(value.option_group_id) ?? [];
      values.push({ id: value.id, value: value.value });
      valuesByGroup.set(value.option_group_id, values);
    }

    return {
      success: true,
      data: groups.map((group) => ({
        ...group,
        values: valuesByGroup.get(group.id) ?? [],
      })),
    };
  }

  static async listTags(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventoryTagRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_tags")
      .select("id, name, color")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: (data ?? []) as InventoryTagRow[],
    };
  }

  static async createTag(
    supabase: SupabaseClient,
    orgId: string,
    input: { name: string; color?: string | null },
    userId: string
  ): Promise<ServiceResult<InventoryTagRow>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_tags")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        color: input.color?.trim() || null,
        created_by: userId,
      })
      .select("id, name, color")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventoryTagRow };
  }

  static async archiveTag(
    supabase: SupabaseClient,
    orgId: string,
    tagId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const client = supabase as any;
    const { error: linkError } = await client
      .from("inventory_product_tags")
      .delete()
      .eq("organization_id", orgId)
      .eq("tag_id", tagId);

    if (linkError) return { success: false, error: linkError.message };

    const { error } = await client
      .from("inventory_tags")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", tagId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { id: tagId } };
  }

  static async listCustomFields(
    supabase: SupabaseClient,
    orgId: string,
    entityTypes: Array<"product" | "variant"> = ["product", "variant"]
  ): Promise<ServiceResult<InventoryCustomFieldDefinition[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_custom_fields")
      .select(
        "id, entity_type, name, field_key, field_type, is_required, is_filterable, options, display_order, section_name, help_text, placeholder"
      )
      .eq("organization_id", orgId)
      .in("entity_type", entityTypes)
      .is("deleted_at", null)
      .order("section_name", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as InventoryCustomFieldDefinition[]).map((field) => ({
        ...field,
        options: Array.isArray(field.options) ? field.options : [],
      })),
    };
  }

  static async addImageRecord(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      product_id: string;
      variant_id?: string | null;
      storage_path?: string | null;
      public_url?: string | null;
      file_name?: string | null;
      content_type?: string | null;
      file_size?: number | null;
      is_primary?: boolean;
      sort_order?: number;
      actor_user_id?: string | null;
    }
  ): Promise<
    ServiceResult<{
      id: string;
      storage_path: string | null;
      public_url: string | null;
      file_name: string | null;
      content_type: string | null;
      file_size: number | null;
    }>
  > {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_item_images")
      .insert({
        organization_id: orgId,
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        storage_path: input.storage_path ?? null,
        public_url: input.public_url ?? null,
        file_name: input.file_name ?? null,
        content_type: input.content_type ?? null,
        file_size: input.file_size ?? null,
        is_primary: input.is_primary ?? false,
        sort_order: input.sort_order ?? 0,
        created_by: input.actor_user_id ?? null,
      })
      .select("id, storage_path, public_url, file_name, content_type, file_size")
      .single();

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: data as {
        id: string;
        storage_path: string | null;
        public_url: string | null;
        file_name: string | null;
        content_type: string | null;
        file_size: number | null;
      },
    };
  }

  static async listProductImages(
    supabase: SupabaseClient,
    orgId: string,
    productId: string
  ): Promise<InventoryProductImageRow[]> {
    const client = supabase as any;
    const { data } = await client
      .from("inventory_item_images")
      .select(
        "id, product_id, variant_id, public_url, storage_path, file_name, content_type, file_size, sort_order, is_primary"
      )
      .eq("organization_id", orgId)
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });

    return ((data ?? []) as InventoryProductImageRow[]).map((image) => ({
      ...image,
      file_size: toNullableNumber(image.file_size),
      sort_order: toNumber(image.sort_order),
      is_primary: Boolean(image.is_primary),
    }));
  }

  static async listProductUnitConversions(
    supabase: SupabaseClient,
    orgId: string,
    productId: string
  ): Promise<InventoryProductUnitConversionRow[]> {
    const client = supabase as any;
    const { data } = await client
      .from("inventory_product_unit_conversions")
      .select(
        "id, product_id, from_unit_id, to_unit_id, factor, rounding_mode, from_unit:inventory_units!from_unit_id(code), to_unit:inventory_units!to_unit_id(code)"
      )
      .eq("organization_id", orgId)
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    return (
      (data ?? []) as Array<
        InventoryProductUnitConversionRow & {
          factor: number | string;
          from_unit?: { code?: string | null } | null;
          to_unit?: { code?: string | null } | null;
        }
      >
    ).map((row) => ({
      ...row,
      from_unit_code: row.from_unit?.code ?? "",
      to_unit_code: row.to_unit?.code ?? "",
      factor: toNumber(row.factor),
    }));
  }

  static async replaceProductUnitConversions(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    conversions: Array<{
      from_unit_id: string;
      to_unit_id: string;
      factor: number;
      rounding_mode?: "half_up" | "up" | "down";
    }>,
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const client = supabase as any;
    const { error: deleteError } = await client
      .from("inventory_product_unit_conversions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("product_id", productId)
      .is("deleted_at", null);

    if (deleteError) return { success: false, error: deleteError.message };

    const rows = conversions
      .filter(
        (conversion) => conversion.from_unit_id !== conversion.to_unit_id && conversion.factor > 0
      )
      .map((conversion) => ({
        organization_id: orgId,
        product_id: productId,
        from_unit_id: conversion.from_unit_id,
        to_unit_id: conversion.to_unit_id,
        factor: conversion.factor,
        rounding_mode: conversion.rounding_mode ?? "half_up",
        created_by: userId,
      }));

    if (rows.length === 0) return { success: true, data: { count: 0 } };

    const { error } = await client.from("inventory_product_unit_conversions").insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { count: rows.length } };
  }

  static async updateProductImages(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    images: Array<{ id: string; sort_order?: number; is_primary?: boolean; deleted?: boolean }>
  ): Promise<ServiceResult<{ count: number }>> {
    const client = supabase as any;
    const primary = images.find((image) => image.is_primary && !image.deleted);
    if (primary) {
      const { error } = await client
        .from("inventory_item_images")
        .update({ is_primary: false })
        .eq("organization_id", orgId)
        .eq("product_id", productId)
        .is("variant_id", null)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
    }

    let count = 0;
    for (const image of images) {
      const patch: Record<string, unknown> = {};
      if (typeof image.sort_order === "number") patch.sort_order = image.sort_order;
      if (typeof image.is_primary === "boolean") patch.is_primary = image.is_primary;
      if (image.deleted) patch.deleted_at = new Date().toISOString();
      if (Object.keys(patch).length === 0) continue;

      const { error } = await client
        .from("inventory_item_images")
        .update(patch)
        .eq("organization_id", orgId)
        .eq("product_id", productId)
        .eq("id", image.id);
      if (error) return { success: false, error: error.message };
      count += 1;
    }

    return { success: true, data: { count } };
  }

  static async updateVariantImages(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    variantId: string,
    images: Array<{ id: string; sort_order?: number; is_primary?: boolean; deleted?: boolean }>
  ): Promise<ServiceResult<{ count: number }>> {
    const client = supabase as any;
    const primary = images.find((image) => image.is_primary && !image.deleted);
    if (primary) {
      const { error } = await client
        .from("inventory_item_images")
        .update({ is_primary: false })
        .eq("organization_id", orgId)
        .eq("product_id", productId)
        .eq("variant_id", variantId)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
    }

    let count = 0;
    for (const image of images) {
      const patch: Record<string, unknown> = {};
      if (typeof image.sort_order === "number") patch.sort_order = image.sort_order;
      if (typeof image.is_primary === "boolean") patch.is_primary = image.is_primary;
      if (image.deleted) patch.deleted_at = new Date().toISOString();
      if (Object.keys(patch).length === 0) continue;

      const { error } = await client
        .from("inventory_item_images")
        .update(patch)
        .eq("organization_id", orgId)
        .eq("product_id", productId)
        .eq("variant_id", variantId)
        .eq("id", image.id);
      if (error) return { success: false, error: error.message };
      count += 1;
    }

    return { success: true, data: { count } };
  }

  static async checkSkuCollisions(
    supabase: SupabaseClient,
    orgId: string,
    skus: string[],
    excludeVariantIds: string[] = []
  ): Promise<ServiceResult<InventorySkuCollision[]>> {
    const normalized = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))];
    if (normalized.length === 0) return { success: true, data: [] };

    const client = supabase as any;
    let query = client
      .from("inventory_variants")
      .select("id, product_id, sku, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .in("sku", normalized);
    if (excludeVariantIds.length > 0) {
      query = query.not("id", "in", `(${excludeVariantIds.join(",")})`);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    const rows = (data ?? []) as Array<{
      id: string;
      product_id: string;
      sku: string;
      name: string;
    }>;
    if (rows.length === 0) return { success: true, data: [] };

    const productIds = [...new Set(rows.map((row) => row.product_id))];
    const { data: productsData, error: productsError } = await client
      .from("inventory_products")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", productIds);
    if (productsError) return { success: false, error: productsError.message };

    const productNames = new Map(
      ((productsData ?? []) as Array<{ id: string; name: string }>).map((product) => [
        product.id,
        product.name,
      ])
    );

    return {
      success: true,
      data: rows.map((row) => ({
        sku: row.sku,
        variant_id: row.id,
        product_id: row.product_id,
        variant_name: row.name,
        product_name: productNames.get(row.product_id) ?? "",
      })),
    };
  }

  static async listSkuTemplates(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<InventorySkuTemplateRow[]>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_sku_templates")
      .select("id, name, description, rules, is_default")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as InventorySkuTemplateRow[]).map((template) => ({
        ...template,
        rules: Array.isArray(template.rules) ? template.rules : [],
      })),
    };
  }

  static async createSkuTemplate(
    supabase: SupabaseClient,
    orgId: string,
    input: { name: string; description?: string | null; rules: unknown[]; is_default?: boolean },
    userId: string
  ): Promise<ServiceResult<InventorySkuTemplateRow>> {
    const client = supabase as any;
    if (input.is_default) {
      const { error: clearError } = await client
        .from("inventory_sku_templates")
        .update({ is_default: false, updated_by: userId })
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (clearError) return { success: false, error: clearError.message };
    }
    const { data, error } = await client
      .from("inventory_sku_templates")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rules: input.rules,
        is_default: input.is_default ?? false,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, name, description, rules, is_default")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventorySkuTemplateRow };
  }

  static async updateSkuTemplate(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      id: string;
      name: string;
      description?: string | null;
      rules: unknown[];
      is_default?: boolean;
    },
    userId: string
  ): Promise<ServiceResult<InventorySkuTemplateRow>> {
    const client = supabase as any;
    if (input.is_default) {
      const { error: clearError } = await client
        .from("inventory_sku_templates")
        .update({ is_default: false, updated_by: userId })
        .eq("organization_id", orgId)
        .neq("id", input.id)
        .is("deleted_at", null);
      if (clearError) return { success: false, error: clearError.message };
    }
    const { data, error } = await client
      .from("inventory_sku_templates")
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rules: input.rules,
        is_default: input.is_default ?? false,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", input.id)
      .is("deleted_at", null)
      .select("id, name, description, rules, is_default")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InventorySkuTemplateRow };
  }

  static async archiveSkuTemplate(
    supabase: SupabaseClient,
    orgId: string,
    templateId: string,
    userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_sku_templates")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("organization_id", orgId)
      .eq("id", templateId)
      .is("deleted_at", null)
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as { id: string } };
  }

  private static optionValueIdsForVariant(
    variant: EnhancedVariantInput,
    optionValueIdsByKey: Map<string, string>
  ) {
    if (variant.option_value_ids?.length) return variant.option_value_ids;
    return Object.entries(variant.options ?? {})
      .map(([attribute, value]) =>
        optionValueIdsByKey.get(`${attribute.toLowerCase()}::${value.toLowerCase()}`)
      )
      .filter((id): id is string => Boolean(id));
  }

  private static async ensureAttributeValues(
    supabase: SupabaseClient,
    orgId: string,
    attributes: EnhancedAttributeInput[],
    userId: string
  ): Promise<ServiceResult<Map<string, string>>> {
    const result = new Map<string, string>();

    for (const attribute of attributes) {
      const name = attribute.name.trim();
      if (!name) continue;

      const { data: groupsData, error: groupReadError } = await supabase
        .from("inventory_option_groups")
        .select("id, name")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (groupReadError) return { success: false, error: groupReadError.message };
      const existingGroup = ((groupsData ?? []) as Array<{ id: string; name: string }>).find(
        (group) => group.name.toLowerCase() === name.toLowerCase()
      );

      let groupId = existingGroup?.id;
      if (!groupId) {
        const { data: groupData, error: groupError } = await supabase
          .from("inventory_option_groups")
          .insert({
            organization_id: orgId,
            name,
            created_by: userId,
            updated_by: userId,
          })
          .select("id")
          .single();
        if (groupError) return { success: false, error: groupError.message };
        groupId = (groupData as { id: string }).id;
      }

      const { data: valuesData, error: valuesReadError } = await supabase
        .from("inventory_option_values")
        .select("id, value")
        .eq("organization_id", orgId)
        .eq("option_group_id", groupId)
        .is("deleted_at", null);
      if (valuesReadError) return { success: false, error: valuesReadError.message };

      for (const rawValue of attribute.values) {
        const value = rawValue.trim();
        if (!value) continue;
        const existingValue = ((valuesData ?? []) as Array<{ id: string; value: string }>).find(
          (row) => row.value.toLowerCase() === value.toLowerCase()
        );

        let valueId = existingValue?.id;
        if (!valueId) {
          const { data: valueData, error: valueError } = await supabase
            .from("inventory_option_values")
            .insert({
              organization_id: orgId,
              option_group_id: groupId,
              value,
              created_by: userId,
              updated_by: userId,
            })
            .select("id")
            .single();
          if (valueError) return { success: false, error: valueError.message };
          valueId = (valueData as { id: string }).id;
        }

        result.set(`${name.toLowerCase()}::${value.toLowerCase()}`, valueId);
      }
    }

    return { success: true, data: result };
  }

  private static async updateVariantForEnhancedCreate(
    supabase: SupabaseClient,
    orgId: string,
    variantId: string,
    variant: EnhancedVariantInput,
    userId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase
      .from("inventory_variants")
      .update({
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        barcode: variant.barcode?.trim() || null,
        purchase_price: variant.purchase_price ?? null,
        sales_price: variant.sales_price ?? null,
        price_currency: variant.price_currency ?? null,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", variantId)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as { id: string } };
  }

  private static async setVariantOptionValues(
    supabase: SupabaseClient,
    orgId: string,
    variantId: string,
    optionValueIds: string[],
    _userId: string
  ): Promise<ServiceResult<{ variant_id: string }>> {
    if (optionValueIds.length === 0) return { success: true, data: { variant_id: variantId } };

    const { data: values, error: valuesError } = await supabase
      .from("inventory_option_values")
      .select("id, option_group_id")
      .eq("organization_id", orgId)
      .in("id", optionValueIds);
    if (valuesError) return { success: false, error: valuesError.message };

    const rows = ((values ?? []) as Array<{ id: string; option_group_id: string }>).map(
      (value) => ({
        organization_id: orgId,
        variant_id: variantId,
        option_group_id: value.option_group_id,
        option_value_id: value.id,
      })
    );
    if (rows.length === 0) return { success: true, data: { variant_id: variantId } };

    const { error } = await supabase.from("inventory_variant_option_values").insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { variant_id: variantId } };
  }

  private static async writeVariantIdentifiers(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    variants: Array<{ id: string; variant: EnhancedVariantInput }>,
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const rows = variants.flatMap(({ id, variant }) =>
      (
        [
          ["barcode", variant.barcode],
          ["upc", variant.upc],
          ["ean", variant.ean],
          ["isbn", variant.isbn],
          ["mpn", variant.mpn],
        ] as const
      )
        .filter(([, value]) => value && value.trim().length > 0)
        .map(([type, value]) => ({
          organization_id: orgId,
          product_id: productId,
          variant_id: id,
          identifier_type: type,
          identifier_value: value!.trim(),
          is_primary: type === "barcode",
          created_by: userId,
        }))
    );
    if (rows.length === 0) return { success: true, data: { count: 0 } };

    const client = supabase as any;
    const { error } = await client.from("inventory_product_identifiers").insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { count: rows.length } };
  }

  private static async writeReorderRules(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    preferredSupplierId: string | null,
    variants: Array<{ id: string; variant: EnhancedVariantInput }>,
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const rows = variants
      .filter(({ variant }) => variant.reorder_point != null && Number(variant.reorder_point) >= 0)
      .map(({ id, variant }) => ({
        organization_id: orgId,
        branch_id: branchId,
        variant_id: id,
        reorder_point: variant.reorder_point ?? 0,
        preferred_supplier_id: preferredSupplierId,
        created_by: userId,
        updated_by: userId,
      }));
    if (rows.length === 0) return { success: true, data: { count: 0 } };

    const client = supabase as any;
    const { error } = await client.from("inventory_reorder_rules").insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { count: rows.length } };
  }

  private static async createOpeningStockMovement(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    locationId: string,
    unitId: string,
    productId: string,
    variants: Array<{ id: string; variant: EnhancedVariantInput }>,
    userId: string
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const lines = variants
      .filter(
        ({ variant }) => variant.opening_quantity != null && Number(variant.opening_quantity) > 0
      )
      .map(({ id, variant }) => ({
        variant_id: id,
        destination_location_id: locationId,
        unit_id: unitId,
        quantity: variant.opening_quantity,
        unit_cost: variant.opening_unit_cost ?? variant.purchase_price ?? null,
        total_cost:
          variant.opening_unit_cost && variant.opening_quantity
            ? Number(variant.opening_unit_cost) * Number(variant.opening_quantity)
            : null,
        currency: variant.price_currency ?? null,
        note: "Opening stock from product creation",
      }));
    if (lines.length === 0) return { success: true, data: { movement_id: null } };

    const { data: draft, error: draftError } = await supabase.rpc(
      "inventory_create_draft_movement",
      {
        p_organization_id: orgId,
        p_branch_id: branchId,
        p_movement_kind: "opening_balance",
        p_lines: lines,
        p_adjustment_direction: null,
        p_reason_id: null,
        p_note: "Opening stock from product creation",
        p_reference_type: "inventory_product",
        p_reference_id: productId,
        p_idempotency_key: `product-opening-stock-${productId}`,
        p_actor_user_id: userId,
      }
    );
    if (draftError) return { success: false, error: draftError.message };

    const { data: posted, error: postError } = await supabase.rpc("inventory_post_movement", {
      p_movement_id: (draft as { movement_id: string }).movement_id,
      p_actor_user_id: userId,
    });
    if (postError) return { success: false, error: postError.message };
    return { success: true, data: posted as Record<string, unknown> };
  }

  private static async cleanupFailedEnhancedProductCreate(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    userId: string
  ) {
    const deletedAt = new Date().toISOString();

    await supabase
      .from("inventory_variants")
      .update({
        status: "archived",
        archived_at: deletedAt,
        archived_by: userId,
        deleted_at: deletedAt,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("product_id", productId);

    await supabase
      .from("inventory_products")
      .update({
        status: "archived",
        archived_at: deletedAt,
        archived_by: userId,
        deleted_at: deletedAt,
        updated_by: userId,
      })
      .eq("organization_id", orgId)
      .eq("id", productId);
  }

  private static async ensureTagsForProduct(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    tags: string[],
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const names = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];

    const client = supabase as any;
    const { error: clearError } = await client
      .from("inventory_product_tags")
      .delete()
      .eq("organization_id", orgId)
      .eq("product_id", productId);
    if (clearError) return { success: false, error: clearError.message };

    if (names.length === 0) return { success: true, data: { count: 0 } };

    const { data: existingData, error: existingError } = await client
      .from("inventory_tags")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (existingError) return { success: false, error: existingError.message };

    const existingByName = new Map(
      ((existingData ?? []) as Array<{ id: string; name: string }>).map((tag) => [
        tag.name.toLowerCase(),
        tag.id,
      ])
    );
    const tagIds: string[] = [];

    for (const name of names) {
      let tagId = existingByName.get(name.toLowerCase());
      if (!tagId) {
        const { data: inserted, error: insertError } = await client
          .from("inventory_tags")
          .insert({ organization_id: orgId, name, created_by: userId })
          .select("id")
          .single();
        if (insertError) return { success: false, error: insertError.message };
        tagId = (inserted as { id: string }).id;
      }
      tagIds.push(tagId);
    }

    const { error: linkError } = await client.from("inventory_product_tags").upsert(
      tagIds.map((tagId) => ({
        organization_id: orgId,
        product_id: productId,
        tag_id: tagId,
        created_by: userId,
      })),
      { onConflict: "product_id,tag_id" }
    );
    if (linkError) return { success: false, error: linkError.message };
    return { success: true, data: { count: tagIds.length } };
  }

  private static async writeCustomFieldValues(
    supabase: SupabaseClient,
    orgId: string,
    productId: string,
    variants: Array<{ id: string; variant: EnhancedVariantInput }>,
    customFields: EnhancedCustomFieldValueInput[],
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const values = customFields.filter((field) => {
      const hasValue =
        field.value_text ||
        field.value_number != null ||
        field.value_date ||
        field.value_boolean != null ||
        field.value_json != null;
      return field.field_id && hasValue;
    });
    if (values.length === 0) return { success: true, data: { count: 0 } };

    const variantsBySku = new Map(variants.map((row) => [row.variant.sku.toLowerCase(), row.id]));
    const rows = values
      .map((field) => {
        const variantId =
          field.entity_type === "variant" && field.variant_sku
            ? variantsBySku.get(field.variant_sku.toLowerCase())
            : null;
        if (field.entity_type === "variant" && !variantId) return null;
        return {
          organization_id: orgId,
          field_id: field.field_id,
          product_id: field.entity_type === "product" ? productId : null,
          variant_id: field.entity_type === "variant" ? variantId : null,
          value_text: field.value_text ?? null,
          value_number: field.value_number ?? null,
          value_date: field.value_date ?? null,
          value_boolean: field.value_boolean ?? null,
          value_json: field.value_json ?? null,
          created_by: userId,
        };
      })
      .filter((row): row is Exclude<typeof row, null> => row !== null);
    if (rows.length === 0) return { success: true, data: { count: 0 } };

    const client = supabase as any;
    const { error } = await client.from("inventory_custom_field_values").insert(rows);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { count: rows.length } };
  }

  private static async enrichProducts(
    supabase: SupabaseClient,
    orgId: string,
    products: ProductRow[]
  ): Promise<ServiceResult<InventoryProductListRow[]>> {
    if (products.length === 0) return { success: true, data: [] };

    const variantsResult = await InventoryProductsService.listVariantsForProducts(
      supabase,
      orgId,
      products.map((p) => p.id)
    );
    if (!variantsResult.success)
      return { success: false, error: (variantsResult as { success: false; error: string }).error };

    const unitIds = [...new Set(products.map((p) => p.base_unit_id))];
    const { data: unitsData, error: unitsError } = await supabase
      .from("inventory_units")
      .select(UNIT_COLUMNS)
      .eq("organization_id", orgId)
      .in("id", unitIds);
    if (unitsError) return { success: false, error: unitsError.message };

    const variants = variantsResult.data;
    const variantIds = variants.map((v) => v.id);
    const { data: balancesData, error: balancesError } = variantIds.length
      ? await supabase
          .from("inventory_balances")
          .select("variant_id, on_hand_quantity, available_quantity")
          .eq("organization_id", orgId)
          .in("variant_id", variantIds)
      : { data: [], error: null };
    if (balancesError) return { success: false, error: balancesError.message };

    const client = supabase as any;
    const { data: imagesData, error: imagesError } = products.length
      ? await client
          .from("inventory_item_images")
          .select("product_id, variant_id, public_url, storage_path, is_primary, sort_order")
          .eq("organization_id", orgId)
          .in(
            "product_id",
            products.map((product) => product.id)
          )
          .is("deleted_at", null)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
      : { data: [], error: null };
    if (imagesError) return { success: false, error: imagesError.message };

    const { data: reorderData, error: reorderError } = variantIds.length
      ? await client
          .from("inventory_reorder_rules")
          .select("variant_id, reorder_point")
          .eq("organization_id", orgId)
          .in("variant_id", variantIds)
          .eq("is_active", true)
          .is("deleted_at", null)
      : { data: [], error: null };
    if (reorderError) return { success: false, error: reorderError.message };

    const { data: optionLinkData, error: optionLinkError } = variantIds.length
      ? await client
          .from("inventory_variant_option_values")
          .select("variant_id, option_group_id, option_value_id")
          .eq("organization_id", orgId)
          .in("variant_id", variantIds)
      : { data: [], error: null };
    if (optionLinkError) return { success: false, error: optionLinkError.message };

    const optionGroupIds = [
      ...new Set(
        ((optionLinkData ?? []) as Array<{ option_group_id: string }>).map(
          (row) => row.option_group_id
        )
      ),
    ];
    const optionValueIds = [
      ...new Set(
        ((optionLinkData ?? []) as Array<{ option_value_id: string }>).map(
          (row) => row.option_value_id
        )
      ),
    ];
    const { data: optionGroupData, error: optionGroupError } = optionGroupIds.length
      ? await client
          .from("inventory_option_groups")
          .select("id, name, display_order")
          .eq("organization_id", orgId)
          .in("id", optionGroupIds)
      : { data: [], error: null };
    if (optionGroupError) return { success: false, error: optionGroupError.message };

    const { data: optionValueData, error: optionValueError } = optionValueIds.length
      ? await client
          .from("inventory_option_values")
          .select("id, value, display_order")
          .eq("organization_id", orgId)
          .in("id", optionValueIds)
      : { data: [], error: null };
    if (optionValueError) return { success: false, error: optionValueError.message };

    const { data: tagData, error: tagError } = await client
      .from("inventory_product_tags")
      .select("product_id, inventory_tags(name)")
      .eq("organization_id", orgId)
      .in(
        "product_id",
        products.map((product) => product.id)
      );
    if (tagError) return { success: false, error: tagError.message };

    const customFieldScopes = [
      `product_id.in.(${products.map((product) => product.id).join(",")})`,
    ];
    if (variants.length > 0) {
      customFieldScopes.push(`variant_id.in.(${variants.map((variant) => variant.id).join(",")})`);
    }
    const { data: customFieldValueData, error: customFieldValueError } = await client
      .from("inventory_custom_field_values")
      .select(
        "product_id, variant_id, field_id, value_text, value_number, value_date, value_boolean, value_json"
      )
      .eq("organization_id", orgId)
      .or(customFieldScopes.join(","));
    if (customFieldValueError) return { success: false, error: customFieldValueError.message };

    const unitsById = new Map(
      (unitsData ?? []).map((unit) => [(unit as InventoryUnitRow).id, unit as InventoryUnitRow])
    );
    const variantsByProduct = new Map<string, VariantRow[]>();
    for (const variant of variants) {
      const list = variantsByProduct.get(variant.product_id) ?? [];
      list.push(variant);
      variantsByProduct.set(variant.product_id, list);
    }

    const quantitiesByVariant = new Map<string, { onHand: number; available: number }>();
    for (const balance of (balancesData ?? []) as BalanceRow[]) {
      const current = quantitiesByVariant.get(balance.variant_id) ?? { onHand: 0, available: 0 };
      current.onHand += toNumber(balance.on_hand_quantity);
      current.available += toNumber(balance.available_quantity);
      quantitiesByVariant.set(balance.variant_id, current);
    }

    const productImages = new Map<string, string>();
    const variantImages = new Map<string, string>();
    for (const image of (imagesData ?? []) as Array<{
      product_id: string;
      variant_id: string | null;
      public_url: string | null;
      storage_path: string | null;
    }>) {
      const url = image.public_url ?? image.storage_path;
      if (!url) continue;
      if (image.variant_id) {
        if (!variantImages.has(image.variant_id)) variantImages.set(image.variant_id, url);
      } else if (!productImages.has(image.product_id)) {
        productImages.set(image.product_id, url);
      }
    }

    const reorderByVariant = new Map<string, number>();
    for (const rule of (reorderData ?? []) as Array<{
      variant_id: string;
      reorder_point: number | string;
    }>) {
      if (!reorderByVariant.has(rule.variant_id)) {
        reorderByVariant.set(rule.variant_id, toNumber(rule.reorder_point));
      }
    }

    const optionGroupsById = new Map(
      ((optionGroupData ?? []) as Array<{ id: string; name: string; display_order: number }>).map(
        (group) => [group.id, group]
      )
    );
    const optionValuesById = new Map(
      ((optionValueData ?? []) as Array<{ id: string; value: string; display_order: number }>).map(
        (value) => [value.id, value]
      )
    );
    const optionValuesByVariant = new Map<string, InventoryVariantOptionValue[]>();
    for (const link of (optionLinkData ?? []) as Array<{
      variant_id: string;
      option_group_id: string;
      option_value_id: string;
    }>) {
      const group = optionGroupsById.get(link.option_group_id);
      const value = optionValuesById.get(link.option_value_id);
      if (!group || !value) continue;
      const values = optionValuesByVariant.get(link.variant_id) ?? [];
      values.push({
        option_group_id: group.id,
        option_group_name: group.name,
        option_value_id: value.id,
        value: value.value,
        display_order: Number(group.display_order) * 1000 + Number(value.display_order),
      });
      optionValuesByVariant.set(link.variant_id, values);
    }

    const tagsByProduct = new Map<string, string[]>();
    for (const row of (tagData ?? []) as Array<{
      product_id: string;
      inventory_tags: { name: string } | null;
    }>) {
      const tags = tagsByProduct.get(row.product_id) ?? [];
      if (row.inventory_tags?.name) tags.push(row.inventory_tags.name);
      tagsByProduct.set(row.product_id, tags);
    }

    const customFieldsByProduct = new Map<string, Record<string, string>>();
    const customFieldsByVariant = new Map<string, Record<string, string>>();
    for (const row of (customFieldValueData ?? []) as Array<{
      product_id: string | null;
      variant_id: string | null;
      field_id: string;
      value_text: string | null;
      value_number: number | string | null;
      value_date: string | null;
      value_boolean: boolean | null;
      value_json: unknown;
    }>) {
      if (row.product_id) {
        const values = customFieldsByProduct.get(row.product_id) ?? {};
        values[row.field_id] = formatCustomFieldDisplayValue(row);
        customFieldsByProduct.set(row.product_id, values);
        continue;
      }
      if (!row.variant_id) continue;
      const values = customFieldsByVariant.get(row.variant_id) ?? {};
      values[row.field_id] = formatCustomFieldDisplayValue(row);
      customFieldsByVariant.set(row.variant_id, values);
    }

    return {
      success: true,
      data: products.map((product) => {
        const productVariants = variantsByProduct.get(product.id) ?? [];
        const defaultVariant =
          productVariants.find((v) => v.id === product.default_variant_id) ??
          productVariants.find((v) => v.is_default) ??
          productVariants[0];
        const quantities = productVariants.reduce(
          (acc, variant) => {
            const q = quantitiesByVariant.get(variant.id);
            if (q) {
              acc.onHand += q.onHand;
              acc.available += q.available;
            }
            return acc;
          },
          { onHand: 0, available: 0 }
        );
        const enrichedVariants: InventoryProductVariantListRow[] = productVariants.map(
          (variant) => {
            const q = quantitiesByVariant.get(variant.id) ?? { onHand: 0, available: 0 };
            return {
              ...variant,
              thumbnail_url: variantImages.get(variant.id) ?? productImages.get(product.id) ?? null,
              on_hand_quantity: q.onHand,
              available_quantity: q.available,
              reorder_point: reorderByVariant.get(variant.id) ?? null,
              option_values: (optionValuesByVariant.get(variant.id) ?? []).sort(
                (a, b) => a.display_order - b.display_order
              ),
              custom_field_values: customFieldsByVariant.get(variant.id) ?? {},
            };
          }
        );

        return {
          row_id: product.id,
          id: product.id,
          name: product.name,
          sku: defaultVariant?.sku ?? "",
          product_type: product.product_type,
          status: product.status,
          thumbnail_url: productImages.get(product.id) ?? null,
          variant_count: productVariants.length,
          on_hand_quantity: quantities.onHand,
          available_quantity: quantities.available,
          unit_code: unitsById.get(product.base_unit_id)?.code ?? "",
          updated_at: product.updated_at,
          sales_account_code: product.sales_account_code,
          purchase_account_code: product.purchase_account_code,
          tax_code: product.tax_code,
          tax_rate_percent: toNullableNumber(product.tax_rate_percent),
          tags: tagsByProduct.get(product.id) ?? [],
          custom_field_values: customFieldsByProduct.get(product.id) ?? {},
          variants: enrichedVariants,
          is_variant_row: false,
          variant_id: null,
          parent_product_name: null,
        };
      }),
    };
  }

  private static flattenProductRows(rows: InventoryProductListRow[]): InventoryProductListRow[] {
    return rows.flatMap((product) => {
      if (product.variant_count <= 1) return [{ ...product, row_id: product.id }];

      return product.variants.map((variant) => ({
        ...product,
        row_id: `${product.id}::${variant.id}`,
        name: variant.name,
        sku: variant.sku,
        status: variant.status,
        thumbnail_url: variant.thumbnail_url,
        variant_count: 1,
        on_hand_quantity: variant.on_hand_quantity,
        available_quantity: variant.available_quantity,
        custom_field_values: variant.custom_field_values,
        variants: [variant],
        is_variant_row: true,
        variant_id: variant.id,
        parent_product_name: product.name,
      }));
    });
  }

  private static async resolveProductListFilterProductIds(
    supabase: SupabaseClient,
    orgId: string,
    filters: DataViewListParams["filters"]
  ): Promise<ServiceResult<string[] | null>> {
    const client = supabase as any;
    let scopedIds: string[] | null = null;

    const tagFilter = Array.isArray(filters.tags)
      ? filters.tags
      : typeof filters.tags === "string" && filters.tags
        ? [filters.tags]
        : [];
    const tagNames = [...new Set(tagFilter.map((tag) => tag.trim()).filter(Boolean))];

    if (tagNames.length > 0) {
      const { data: tagsData, error: tagsError } = await client
        .from("inventory_tags")
        .select("id, name")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .in("name", tagNames);
      if (tagsError) return { success: false, error: tagsError.message };

      const tagIds = ((tagsData ?? []) as Array<{ id: string; name: string }>).map((tag) => tag.id);
      if (tagIds.length !== tagNames.length) return { success: true, data: [] };

      const { data: linksData, error: linksError } = await client
        .from("inventory_product_tags")
        .select("product_id, tag_id")
        .eq("organization_id", orgId)
        .in("tag_id", tagIds);
      if (linksError) return { success: false, error: linksError.message };

      const tagIdsByProduct = new Map<string, Set<string>>();
      for (const row of (linksData ?? []) as Array<{ product_id: string; tag_id: string }>) {
        const values = tagIdsByProduct.get(row.product_id) ?? new Set<string>();
        values.add(row.tag_id);
        tagIdsByProduct.set(row.product_id, values);
      }

      const matchedIds = [...tagIdsByProduct.entries()]
        .filter(([, values]) => tagIds.every((tagId) => values.has(tagId)))
        .map(([productId]) => productId);
      scopedIds = intersectProductIds(scopedIds, matchedIds);
    }

    for (const [key, rawValue] of Object.entries(filters)) {
      if (!key.startsWith("custom_field:")) continue;
      const query = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
      if (!query) continue;
      const fieldId = key.replace("custom_field:", "");

      const { data: valuesData, error: valuesError } = await client
        .from("inventory_custom_field_values")
        .select("product_id, value_text, value_number, value_date, value_boolean, value_json")
        .eq("organization_id", orgId)
        .eq("field_id", fieldId)
        .not("product_id", "is", null);
      if (valuesError) return { success: false, error: valuesError.message };

      const matchedIds = (
        (valuesData ?? []) as Array<{
          product_id: string | null;
          value_text: string | null;
          value_number: number | string | null;
          value_date: string | null;
          value_boolean: boolean | null;
          value_json: unknown;
        }>
      )
        .filter((row) => formatCustomFieldDisplayValue(row).toLowerCase().includes(query))
        .map((row) => row.product_id)
        .filter((productId): productId is string => Boolean(productId));

      scopedIds = intersectProductIds(scopedIds, [...new Set(matchedIds)]);
    }

    return { success: true, data: scopedIds };
  }

  private static async listVariantsForProducts(
    supabase: SupabaseClient,
    orgId: string,
    productIds: string[]
  ): Promise<ServiceResult<VariantRow[]>> {
    if (productIds.length === 0) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("inventory_variants")
      .select(VARIANT_COLUMNS)
      .eq("organization_id", orgId)
      .in("product_id", productIds)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("sku", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as VariantRow[] };
  }
}
