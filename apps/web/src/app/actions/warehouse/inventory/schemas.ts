import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid id");
const nullableUuidSchema = uuidSchema.nullable().optional();
const quantitySchema = z.number().positive("Quantity must be greater than 0");
const moneySchema = z.number().min(0).nullable().optional();

export const dataViewListParamsSchema = z.object({
  search: z.string().optional().default(""),
  sort: z
    .object({
      field: z.string(),
      direction: z.enum(["asc", "desc"]),
    })
    .nullable()
    .optional()
    .default(null),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50),
  filters: z.record(z.union([z.string(), z.array(z.string()), z.boolean(), z.null()])).optional(),
});

export const getByIdSchema = z.object({
  id: uuidSchema,
});

export const createInventoryProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).nullable().optional(),
  product_type: z
    .enum(["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"])
    .default("stocked"),
  base_unit_id: uuidSchema,
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  returnable: z.boolean().optional().default(true),
  brand_name: z.string().max(160).nullable().optional(),
  manufacturer_name: z.string().max(160).nullable().optional(),
  length_value: z.number().min(0).nullable().optional(),
  width_value: z.number().min(0).nullable().optional(),
  height_value: z.number().min(0).nullable().optional(),
  dimension_unit: z.string().max(20).nullable().optional(),
  weight_value: z.number().min(0).nullable().optional(),
  weight_unit: z.string().max(20).nullable().optional(),
  sales_description: z.string().max(1000).nullable().optional(),
  purchase_description: z.string().max(1000).nullable().optional(),
  preferred_supplier_id: nullableUuidSchema,
  sales_account_code: z.string().max(80).nullable().optional(),
  purchase_account_code: z.string().max(80).nullable().optional(),
  tax_code: z.string().max(80).nullable().optional(),
  tax_rate_percent: z.number().min(0).nullable().optional(),
});

const enhancedAttributeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  values: z.array(z.string().trim().min(1).max(100)).min(1),
});

const enhancedVariantSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  options: z.record(z.string()).optional().default({}),
  option_value_ids: z.array(uuidSchema).optional().default([]),
  barcode: z.string().max(120).nullable().optional(),
  upc: z.string().max(120).nullable().optional(),
  ean: z.string().max(120).nullable().optional(),
  isbn: z.string().max(120).nullable().optional(),
  mpn: z.string().max(120).nullable().optional(),
  purchase_price: moneySchema,
  sales_price: moneySchema,
  price_currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  reorder_point: z.number().min(0).nullable().optional(),
  opening_quantity: z.number().min(0).nullable().optional(),
  opening_unit_cost: moneySchema,
});

const enhancedCustomFieldValueSchema = z.object({
  field_id: uuidSchema,
  entity_type: z.enum(["product", "variant"]),
  variant_sku: z.string().max(100).nullable().optional(),
  value_text: z.string().max(1000).nullable().optional(),
  value_number: z.number().nullable().optional(),
  value_date: z.string().date().nullable().optional(),
  value_boolean: z.boolean().nullable().optional(),
  value_json: z.unknown().nullable().optional(),
});

export const createEnhancedInventoryProductSchema = createInventoryProductSchema.extend({
  attributes: z.array(enhancedAttributeSchema).optional().default([]),
  variants: z.array(enhancedVariantSchema).optional().default([]),
  track_inventory: z.boolean().optional().default(true),
  opening_location_id: nullableUuidSchema,
  tags: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  custom_fields: z.array(enhancedCustomFieldValueSchema).optional().default([]),
  unit_conversions: z
    .array(
      z.object({
        from_unit_id: uuidSchema,
        to_unit_id: uuidSchema,
        factor: z.number().positive(),
        rounding_mode: z.enum(["half_up", "up", "down"]).optional().default("half_up"),
      })
    )
    .optional()
    .default([]),
});

export const createInventoryUnitSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  unit_kind: z
    .enum(["count", "weight", "length", "volume", "time", "area", "other"])
    .default("count"),
  precision: z.number().int().min(0).max(9).optional(),
});

export const archiveInventoryUnitSchema = getByIdSchema;

export const createInventoryTaxRateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  rate_percent: z.number().min(0).max(100),
  is_default: z.boolean().optional().default(false),
});

export const archiveInventoryTaxRateSchema = getByIdSchema;

export const createInventoryTagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(40).nullable().optional(),
});

export const archiveInventoryTagSchema = getByIdSchema;

export const updateInventoryProductSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(["active", "archived", "discontinued"]).optional(),
  product_type: z
    .enum(["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"])
    .optional(),
  base_unit_id: uuidSchema.optional(),
  returnable: z.boolean().optional(),
  brand_name: z.string().max(160).nullable().optional(),
  manufacturer_name: z.string().max(160).nullable().optional(),
  length_value: z.number().min(0).nullable().optional(),
  width_value: z.number().min(0).nullable().optional(),
  height_value: z.number().min(0).nullable().optional(),
  dimension_unit: z.string().max(20).nullable().optional(),
  weight_value: z.number().min(0).nullable().optional(),
  weight_unit: z.string().max(20).nullable().optional(),
  sales_description: z.string().max(1000).nullable().optional(),
  purchase_description: z.string().max(1000).nullable().optional(),
  preferred_supplier_id: nullableUuidSchema,
  sales_account_code: z.string().max(80).nullable().optional(),
  purchase_account_code: z.string().max(80).nullable().optional(),
  tax_code: z.string().max(80).nullable().optional(),
  tax_rate_percent: z.number().min(0).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).optional(),
  unit_conversions: z
    .array(
      z.object({
        from_unit_id: uuidSchema,
        to_unit_id: uuidSchema,
        factor: z.number().positive(),
        rounding_mode: z.enum(["half_up", "up", "down"]).optional().default("half_up"),
      })
    )
    .optional(),
});

export const createInventoryMasterDataSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const archiveInventoryProductSchema = z.object({
  id: uuidSchema,
});

const movementLineSchema = z.object({
  variant_id: uuidSchema,
  source_location_id: nullableUuidSchema,
  destination_location_id: nullableUuidSchema,
  lot_id: nullableUuidSchema,
  serial_id: nullableUuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
  unit_cost: moneySchema,
  total_cost: moneySchema,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  note: z.string().max(500).nullable().optional(),
});

export const createDraftMovementSchema = z.object({
  movement_kind: z.enum(["receipt", "issue", "transfer", "adjustment", "opening_balance"]),
  adjustment_direction: z.enum(["increase", "decrease"]).nullable().optional(),
  lines: z.array(movementLineSchema).min(1),
  reason_id: nullableUuidSchema,
  note: z.string().max(1000).nullable().optional(),
  reference_type: z.string().max(100).nullable().optional(),
  reference_id: z.string().max(200).nullable().optional(),
  idempotency_key: z.string().max(200).nullable().optional(),
});

export const postMovementSchema = z.object({
  id: uuidSchema,
});

export const reverseMovementSchema = z.object({
  id: uuidSchema,
  note: z.string().max(1000).nullable().optional(),
});

export const receiveStockSchema = z.object({
  variant_id: uuidSchema,
  destination_location_id: uuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
  note: z.string().max(1000).nullable().optional(),
});

export const issueStockSchema = z.object({
  variant_id: uuidSchema,
  source_location_id: uuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
  note: z.string().max(1000).nullable().optional(),
});

export const transferStockSchema = z.object({
  variant_id: uuidSchema,
  source_location_id: uuidSchema,
  destination_location_id: uuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
  note: z.string().max(1000).nullable().optional(),
});

const branchTransferLineSchema = z.object({
  variant_id: uuidSchema,
  source_location_id: uuidSchema,
  lot_id: nullableUuidSchema,
  serial_id: nullableUuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
});

export const createBranchTransferSchema = z.object({
  destination_branch_id: uuidSchema,
  lines: z.array(branchTransferLineSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
});

export const acceptBranchTransferSchema = z.object({
  id: uuidSchema,
  destination_location_id: uuidSchema,
});

export const declineBranchTransferSchema = z.object({
  id: uuidSchema,
  decline_reason: z.string().max(1000).nullable().optional(),
});

export const adjustStockSchema = z.object({
  variant_id: uuidSchema,
  location_id: uuidSchema,
  unit_id: uuidSchema,
  quantity: quantitySchema,
  adjustment_direction: z.enum(["increase", "decrease"]),
  note: z.string().max(1000).nullable().optional(),
});

export const createOptionGroupSchema = z.object({
  name: z.string().min(1).max(100),
  display_order: z.number().int().optional().default(0),
});

export const createOptionValueSchema = z.object({
  option_group_id: uuidSchema,
  value: z.string().min(1).max(100),
  display_order: z.number().int().optional().default(0),
});

export const generateVariantsSchema = z.object({
  product_id: uuidSchema,
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(100),
        name: z.string().trim().min(1).max(200),
        option_value_ids: z.array(uuidSchema).optional().default([]),
        barcode: z.string().max(120).nullable().optional(),
        purchase_price: moneySchema,
        sales_price: moneySchema,
        price_currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .nullable()
          .optional(),
      })
    )
    .min(1),
});

export const updateVariantPricingSchema = z.object({
  variant_id: uuidSchema,
  purchase_price: moneySchema,
  sales_price: moneySchema,
  price_currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
});

export const updateInventoryVariantSchema = z.object({
  variant_id: uuidSchema,
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  status: z.enum(["active", "archived", "discontinued"]).optional(),
  barcode: z.string().max(120).nullable().optional(),
  purchase_price: moneySchema,
  sales_price: moneySchema,
  price_currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  reorder_point: z.number().min(0).nullable().optional(),
  preferred_supplier_id: nullableUuidSchema,
});

export const updateInventoryVariantOptionsSchema = z.object({
  variant_id: uuidSchema,
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        value: z.string().trim().min(1).max(100),
      })
    )
    .max(12),
});

export const createLotSchema = z.object({
  product_id: uuidSchema,
  variant_id: uuidSchema,
  lot_number: z.string().min(1).max(120),
  manufactured_at: z.string().date().nullable().optional(),
  expires_at: z.string().date().nullable().optional(),
  supplier_reference: z.string().max(200).nullable().optional(),
});

export const createSerialSchema = z.object({
  product_id: uuidSchema,
  variant_id: uuidSchema,
  serial_number: z.string().min(1).max(120),
  lot_id: nullableUuidSchema,
  current_branch_id: nullableUuidSchema,
  current_location_id: nullableUuidSchema,
});

const stockHoldLineSchema = z.object({
  variant_id: uuidSchema,
  location_id: uuidSchema,
  quantity: quantitySchema,
  lot_id: nullableUuidSchema,
  serial_id: nullableUuidSchema,
  reservation_line_id: nullableUuidSchema,
});

export const createReservationSchema = z.object({
  lines: z.array(stockHoldLineSchema.omit({ reservation_line_id: true })).min(1),
  reference_type: z.string().max(100).nullable().optional(),
  reference_id: nullableUuidSchema,
  reference_number: z.string().max(120).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const releaseReservationSchema = z.object({
  id: uuidSchema,
});

export const createAllocationSchema = z.object({
  lines: z.array(stockHoldLineSchema).min(1),
  reservation_id: nullableUuidSchema,
  reference_type: z.string().max(100).nullable().optional(),
  reference_id: nullableUuidSchema,
  reference_number: z.string().max(120).nullable().optional(),
});

export const releaseAllocationSchema = z.object({
  id: uuidSchema,
});

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplier_id: uuidSchema,
  expected_delivery_date: z.string().date().nullable().optional(),
  delivery_location_id: nullableUuidSchema,
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  notes: z.string().max(1000).nullable().optional(),
  lines: z
    .array(
      z.object({
        variant_id: uuidSchema,
        unit_id: uuidSchema,
        quantity: quantitySchema,
        unit_cost: moneySchema,
      })
    )
    .min(1),
});

export const receivePurchaseOrderSchema = z.object({
  purchase_order_id: uuidSchema,
  lines: z
    .array(
      z.object({
        purchase_order_line_id: uuidSchema,
        quantity: quantitySchema,
        destination_location_id: nullableUuidSchema,
      })
    )
    .min(1),
});

export const previewInventorySkuSchema = z.object({
  product_name: z.string().min(1).max(200),
  product_type: z
    .enum(["stocked", "consumable", "service", "serialized", "lot_tracked", "bundle"])
    .default("stocked"),
});

export const createUnitConversionSchema = z.object({
  from_unit_id: uuidSchema,
  to_unit_id: uuidSchema,
  factor: z.number().positive(),
});

export const archiveInventoryUnitConversionSchema = getByIdSchema;

export const createProductUnitConversionSchema = createUnitConversionSchema.extend({
  product_id: uuidSchema,
  rounding_mode: z.enum(["half_up", "up", "down"]).default("half_up"),
});

export const createCustomFieldSchema = z.object({
  entity_type: z.enum(["product", "variant", "lot", "serial"]),
  name: z.string().min(1).max(120),
  field_key: z.string().min(1).max(120),
  field_type: z.enum(["text", "number", "date", "boolean", "select", "multi_select"]),
  is_required: z.boolean().optional().default(false),
  is_filterable: z.boolean().optional().default(false),
  options: z.array(z.string()).optional().default([]),
  display_order: z.number().int().optional().default(0),
});

export const archiveCustomFieldSchema = z.object({
  id: uuidSchema,
});

export const updateCustomFieldSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  is_required: z.boolean().optional().default(false),
  is_filterable: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  display_order: z.number().int().optional().default(0),
});

export const setCustomFieldValueSchema = z.object({
  field_id: uuidSchema,
  product_id: nullableUuidSchema,
  variant_id: nullableUuidSchema,
  lot_id: nullableUuidSchema,
  serial_id: nullableUuidSchema,
  value_text: z.string().max(1000).nullable().optional(),
  value_number: z.number().nullable().optional(),
  value_date: z.string().date().nullable().optional(),
  value_boolean: z.boolean().nullable().optional(),
  value_json: z.unknown().nullable().optional(),
});

export const assignInventoryVariantGalleryImageSchema = z
  .object({
    product_id: uuidSchema,
    variant_id: uuidSchema,
    image_id: uuidSchema,
    sort_order: z.number().int().min(0).optional(),
    is_primary: z.boolean().optional(),
  })
  .refine((value) => value.product_id !== value.variant_id, {
    message: "Variant image assignment target is invalid",
  });

export const updateInventoryProductImagesSchema = z.object({
  product_id: uuidSchema,
  variant_id: uuidSchema.nullable().optional(),
  images: z.array(
    z.object({
      id: uuidSchema,
      sort_order: z.number().int().min(0).optional(),
      is_primary: z.boolean().optional(),
      deleted: z.boolean().optional(),
    })
  ),
});

export const checkInventorySkuCollisionsSchema = z.object({
  skus: z.array(z.string().trim().min(1).max(100)).min(1),
  exclude_variant_ids: z.array(uuidSchema).optional().default([]),
});

export const createInventorySkuTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  rules: z.array(z.unknown()).min(1),
  is_default: z.boolean().optional().default(false),
});

export const updateInventorySkuTemplateSchema = createInventorySkuTemplateSchema.extend({
  id: uuidSchema,
});

export const archiveInventorySkuTemplateSchema = z.object({
  id: uuidSchema,
});

const PRODUCT_IMPORT_PAYLOAD_MAX_CHARS = 25 * 1024 * 1024;

export const productCsvImportSchema = z.object({
  csv: z.string().min(1).max(PRODUCT_IMPORT_PAYLOAD_MAX_CHARS),
  mode: z.enum(["create_only", "skip_existing"]).optional().default("create_only"),
});

export const productCsvTextSchema = z.object({
  csv: z.string().min(1).max(PRODUCT_IMPORT_PAYLOAD_MAX_CHARS),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).nullable().optional(),
  collection_type: z.enum(["manual", "dynamic"]).default("manual"),
  filter_json: z.record(z.unknown()).nullable().optional(),
});

export const addCollectionItemSchema = z.object({
  collection_id: uuidSchema,
  product_id: uuidSchema,
});

export const saveInventoryViewSchema = z.object({
  entity: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  config: z.record(z.unknown()),
  is_shared: z.boolean().optional().default(false),
});

export const createInventoryImportJobSchema = z.object({
  import_type: z.enum(["products", "opening_stock", "counts"]),
  file_name: z.string().max(240).nullable().optional(),
  storage_path: z.string().max(500).nullable().optional(),
  mapping: z.record(z.unknown()).optional().default({}),
});

export const createInventoryExportJobSchema = z.object({
  export_type: z.enum(["products", "inventory", "movements", "valuation", "counts"]),
  filters: z.record(z.unknown()).optional().default({}),
});

export const createValuationSnapshotSchema = z.object({
  snapshot_date: z.string().date().nullable().optional(),
});

export const createCountSessionSchema = z.object({
  scope: z.record(z.unknown()).optional().default({}),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateCountLineSchema = z.object({
  id: uuidSchema,
  counted_quantity: z.number().min(0),
  note: z.string().max(1000).nullable().optional(),
});

export const approveCountSessionSchema = z.object({
  id: uuidSchema,
});
