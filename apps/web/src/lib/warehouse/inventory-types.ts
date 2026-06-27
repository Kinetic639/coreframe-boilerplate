export type InventoryProductListRow = {
  row_id: string;
  id: string;
  name: string;
  sku: string;
  product_type: string;
  status: string;
  thumbnail_url: string | null;
  variant_count: number;
  on_hand_quantity: number;
  available_quantity: number;
  unit_code: string;
  updated_at: string;
  sales_account_code: string | null;
  purchase_account_code: string | null;
  tax_code: string | null;
  tax_rate_percent: number | null;
  tags: string[];
  custom_field_values: Record<string, string>;
  variants: InventoryProductVariantListRow[];
  is_variant_row?: boolean;
  variant_id?: string | null;
  parent_product_name?: string | null;
};

export type InventoryProductDetail = InventoryProductListRow & {
  description: string | null;
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
  images: InventoryProductImageRow[];
  unit_conversions: InventoryProductUnitConversionRow[];
  tags: string[];
  variants: InventoryProductVariantListRow[];
};

export type InventoryProductVariantListRow = {
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
  thumbnail_url: string | null;
  on_hand_quantity: number;
  available_quantity: number;
  reorder_point: number | null;
  option_values: InventoryVariantOptionValue[];
  custom_field_values: Record<string, string>;
};

export type InventoryVariantOption = {
  id: string;
  sku: string;
  label: string;
  product_name: string;
  unit_id: string;
  unit_code: string;
  on_hand_quantity?: number;
  available_quantity?: number;
  location_count?: number;
  location_summaries?: Array<{
    location_id: string;
    location_name: string;
    location_code: string | null;
    on_hand_quantity: number;
    available_quantity: number;
  }>;
};

export type InventoryVariantOptionValue = {
  option_group_id: string;
  option_group_name: string;
  option_value_id: string;
  value: string;
  display_order: number;
};

export type InventoryProductImageRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  public_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
  sort_order: number;
  is_primary: boolean;
};

export type InventoryProductUnitConversionRow = {
  id: string;
  product_id: string;
  from_unit_id: string;
  from_unit_code?: string;
  to_unit_id: string;
  to_unit_code?: string;
  factor: number;
  rounding_mode: "half_up" | "up" | "down";
};

export type InventoryUnitConversionRow = {
  id: string;
  from_unit_id: string;
  from_unit_code: string;
  to_unit_id: string;
  to_unit_code: string;
  factor: number;
};

export type InventoryTaxRateRow = {
  id: string;
  name: string;
  code: string;
  rate_percent: number;
  is_default: boolean;
};

export type InventoryTagRow = {
  id: string;
  name: string;
  color: string | null;
};

export type InventorySkuTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  rules: unknown[];
  is_default: boolean;
};

export type ProductCsvImportMode = "create_only" | "skip_existing";

export type InventorySkuCollision = {
  sku: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
};

export type InventoryProductImportPreviewRow = {
  row_number: number;
  product_name: string;
  product_sku: string | null;
  variant_name: string;
  variant_sku: string;
  unit_code: string;
  errors: string[];
};

export type InventoryProductImportPreview = {
  rows: InventoryProductImportPreviewRow[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
};

export type InventoryMasterDataRow = {
  id: string;
  name: string;
};

export type CreateInventoryProductInput = {
  name: string;
  product_type: string;
  base_unit_id: string;
  sku?: string | null;
  description?: string | null;
  returnable?: boolean;
  brand_name?: string | null;
  manufacturer_name?: string | null;
  length_value?: number | null;
  width_value?: number | null;
  height_value?: number | null;
  dimension_unit?: string | null;
  weight_value?: number | null;
  weight_unit?: string | null;
  sales_description?: string | null;
  purchase_description?: string | null;
  preferred_supplier_id?: string | null;
  sales_account_code?: string | null;
  purchase_account_code?: string | null;
  tax_code?: string | null;
  tax_rate_percent?: number | null;
};

export type EnhancedVariantInput = {
  sku: string;
  name: string;
  options?: Record<string, string>;
  option_value_ids?: string[];
  barcode?: string | null;
  upc?: string | null;
  ean?: string | null;
  isbn?: string | null;
  mpn?: string | null;
  purchase_price?: number | null;
  sales_price?: number | null;
  price_currency?: string | null;
  reorder_point?: number | null;
  opening_quantity?: number | null;
  opening_unit_cost?: number | null;
};

export type EnhancedCustomFieldValueInput = {
  field_id: string;
  entity_type: "product" | "variant";
  variant_sku?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
};

export type EnhancedAttributeInput = {
  name: string;
  values: string[];
};

export type CreateEnhancedInventoryProductInput = CreateInventoryProductInput & {
  attributes?: EnhancedAttributeInput[];
  variants?: EnhancedVariantInput[];
  track_inventory?: boolean;
  opening_location_id?: string | null;
  branch_id?: string | null;
  tags?: string[];
  custom_fields?: EnhancedCustomFieldValueInput[];
  unit_conversions?: Array<{
    from_unit_id: string;
    to_unit_id: string;
    factor: number;
    rounding_mode?: "half_up" | "up" | "down";
  }>;
};

export type UpdateInventoryProductInput = {
  id: string;
  name?: string;
  description?: string | null;
  status?: string;
  product_type?: string;
  base_unit_id?: string;
  returnable?: boolean;
  brand_name?: string | null;
  manufacturer_name?: string | null;
  length_value?: number | null;
  width_value?: number | null;
  height_value?: number | null;
  dimension_unit?: string | null;
  weight_value?: number | null;
  weight_unit?: string | null;
  sales_description?: string | null;
  purchase_description?: string | null;
  preferred_supplier_id?: string | null;
  sales_account_code?: string | null;
  purchase_account_code?: string | null;
  tax_code?: string | null;
  tax_rate_percent?: number | null;
  tags?: string[];
  unit_conversions?: Array<{
    from_unit_id: string;
    to_unit_id: string;
    factor: number;
    rounding_mode?: "half_up" | "up" | "down";
  }>;
};

export type CreateInventoryUnitInput = {
  code: string;
  name: string;
  unit_kind: string;
  precision?: number;
};

export type InventoryCustomFieldDefinition = {
  id: string;
  entity_type: "product" | "variant" | "lot" | "serial";
  name: string;
  field_key: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
  is_required: boolean;
  is_filterable?: boolean;
  options: string[];
  display_order: number;
  section_name?: string | null;
  help_text?: string | null;
  placeholder?: string | null;
};

export type InventoryUnitRow = {
  id: string;
  code: string;
  name: string;
};

export type InventoryBalanceListRow = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  location_name: string;
  location_code: string | null;
  on_hand_quantity: number;
  available_quantity: number;
  unit_code: string;
  average_unit_cost: number;
  total_value: number;
  currency: string;
  last_movement_id: string | null;
  last_movement_number: string | null;
  last_movement_at: string | null;
  updated_at: string;
};

export type InventoryBalanceDetail = InventoryBalanceListRow & {
  reserved_quantity: number;
  allocated_quantity: number;
};

export type InventoryMovementLineInput = {
  variant_id: string;
  source_location_id?: string | null;
  destination_location_id?: string | null;
  lot_id?: string | null;
  serial_id?: string | null;
  unit_id: string;
  quantity: number;
  unit_cost?: number | null;
  total_cost?: number | null;
  currency?: string | null;
  note?: string | null;
};

export type MovementPartyDetails = {
  name: string;
  nip?: string;
  phone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
};

export type CreateDraftMovementInput = {
  movement_type_code: string;
  lines: InventoryMovementLineInput[];
  operation_date?: string | null;
  document_date?: string | null;
  sender_name?: string | null;
  sender_details?: MovementPartyDetails | null;
  recipient_name?: string | null;
  recipient_details?: MovementPartyDetails | null;
  external_reference?: string | null;
  note?: string | null;
  idempotency_key?: string | null;
};

export type InventoryDocumentType = {
  id: string;
  code: string;
  name: string;
  name_pl: string | null;
  name_en: string | null;
  category: string;
};

export type InventoryMovementType = {
  id: string;
  code: string;
  name: string;
  name_pl: string | null;
  name_en: string | null;
  document_type_code: string;
  category: string;
  requires_source_location: boolean;
  requires_destination_location: boolean;
  requires_reference: boolean;
  requires_note: boolean;
  cost_impact: string;
};

export type MovementFieldScope = "header" | "line";
export type MovementFieldPolicyState = "required" | "optional" | "system" | "forbidden" | "hidden";

export type MovementFieldPolicy = {
  field_key: string;
  field_scope: MovementFieldScope;
  value_type: string;
  resolver_kind: string | null;
  label: string;
  label_pl: string | null;
  is_importable: boolean;
  policy: MovementFieldPolicyState;
  default_strategy: string | null;
  default_value: Record<string, unknown>;
  validation: Record<string, unknown>;
  display_order: number;
};

export type MovementFieldPolicyBundle = Record<string, MovementFieldPolicy[]>;

export type MovementImportSourceField = {
  key: string;
  label: string;
  type?: "text" | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{
    value: string;
    label: string;
    description?: string | null;
    disabled?: boolean;
  }>;
};

export type MovementImportSource = {
  source_type: string;
  label: string;
  description: string | null;
  supported_movement_type_codes: string[];
  input_fields: MovementImportSourceField[];
};

export type MovementImportPreviewLine = {
  line_number: number;
  source_line_id: string;
  raw_product_code: string | null;
  raw_product_name: string | null;
  raw_unit: string | null;
  raw_quantity: number | null;
  raw_source_location: string | null;
  raw_destination_location: string | null;
  raw_metadata: Record<string, unknown>;
  variant_id: string | null;
  unit_id: string | null;
  source_location_id: string | null;
  destination_location_id: string | null;
  quantity: number | null;
  validation_errors: string[];
};

export type MovementImportPreviewDocument = {
  source_document_id: string;
  source_document_number: string | null;
  source_metadata: Record<string, unknown>;
  movement_type_code: string;
  external_reference: string | null;
  sender_name: string | null;
  sender_details: MovementPartyDetails | null;
  recipient_name: string | null;
  recipient_details: MovementPartyDetails | null;
  validation_errors: string[];
  lines: MovementImportPreviewLine[];
};

export type MovementImportPreview = {
  source_type: string;
  source_label: string;
  movement_type_code: string;
  documents: MovementImportPreviewDocument[];
};

export type InventoryMovementListRow = {
  id: string;
  draft_number: string | null;
  document_number: string | null;
  route_key: string;
  document_type_code: string | null;
  movement_type_code: string;
  movement_type_name: string;
  status: string;
  line_count: number;
  product_names: string;
  sender_name: string | null;
  recipient_name: string | null;
  external_reference: string | null;
  created_by: string | null;
  created_at: string;
  posted_at: string | null;
};

export type InventoryPickerItem = {
  variant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  product_name: string;
  brand_name: string | null;
  manufacturer_name: string | null;
  unit_id: string;
  unit_code: string;
  total_on_hand: number | null;
  source_location_on_hand: number | null;
};

export type LocationVariantStock = {
  variant_id: string;
  product_name: string;
  sku: string;
  unit_id: string;
  unit_code: string;
  on_hand_quantity: number;
};

export type InventoryMovementAuditEntry = {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  actor_user_id: string | null;
  actor_user_name: string | null;
  created_at: string;
};

export type InventoryMovementDetail = InventoryMovementListRow & {
  note: string | null;
  operation_date: string | null;
  document_date: string | null;
  branch_name: string | null;
  created_by_name: string | null;
  sender_details: MovementPartyDetails | null;
  recipient_details: MovementPartyDetails | null;
  lines: Array<{
    id: string;
    line_number: number;
    variant_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    unit_code: string;
    unit_cost: number | null;
    source_location_id: string | null;
    source_location_name: string | null;
    destination_location_id: string | null;
    destination_location_name: string | null;
    note: string | null;
  }>;
  audit_log: InventoryMovementAuditEntry[];
};

export type CreateOptionGroupInput = {
  name: string;
  display_order?: number;
  actor_user_id?: string | null;
};

export type CreateOptionValueInput = {
  option_group_id: string;
  value: string;
  display_order?: number;
  actor_user_id?: string | null;
};

export type GenerateVariantInput = {
  product_id: string;
  variants: Array<{
    sku: string;
    name: string;
    option_value_ids: string[];
    barcode?: string | null;
    purchase_price?: number | null;
    sales_price?: number | null;
    price_currency?: string | null;
  }>;
  actor_user_id?: string | null;
};

export type CreateLotInput = {
  product_id: string;
  variant_id: string;
  lot_number: string;
  manufactured_at?: string | null;
  expires_at?: string | null;
  supplier_reference?: string | null;
  actor_user_id?: string | null;
};

export type CreateSerialInput = {
  product_id: string;
  variant_id: string;
  serial_number: string;
  lot_id?: string | null;
  current_branch_id?: string | null;
  current_location_id?: string | null;
  actor_user_id?: string | null;
};

export type StockHoldLineInput = {
  variant_id: string;
  location_id: string;
  quantity: number;
  lot_id?: string | null;
  serial_id?: string | null;
  reservation_line_id?: string | null;
};

export type CreatePurchaseOrderInput = {
  supplier_id: string;
  expected_delivery_date?: string | null;
  delivery_location_id?: string | null;
  currency?: string | null;
  notes?: string | null;
  lines: Array<{
    variant_id: string;
    unit_id: string;
    quantity: number;
    unit_cost?: number | null;
  }>;
  actor_user_id?: string | null;
};

export type ReceivePurchaseOrderInput = {
  purchase_order_id: string;
  lines: Array<{
    purchase_order_line_id: string;
    quantity: number;
    destination_location_id?: string | null;
  }>;
  actor_user_id?: string | null;
};

export type InventoryBranchTransferListRow = {
  id: string;
  transfer_number: string;
  source_branch_id: string;
  source_branch_name: string;
  destination_branch_id: string;
  destination_branch_name: string;
  status: string;
  line_count: number;
  notes: string | null;
  decline_reason: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
};

export type BranchTransferLineInput = {
  variant_id: string;
  source_location_id: string;
  lot_id?: string | null;
  serial_id?: string | null;
  unit_id: string;
  quantity: number;
};

export type CreateCustomFieldInput = {
  entity_type: "product" | "variant" | "lot" | "serial";
  name: string;
  field_key: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
  is_required?: boolean;
  is_filterable?: boolean;
  options?: string[];
  display_order?: number;
  actor_user_id?: string | null;
};
