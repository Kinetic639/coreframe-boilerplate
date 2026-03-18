// Types for QR/Barcode System

export interface QRLabel {
  id: string;
  qr_token: string;
  label_type: "location" | "product" | "asset" | "generic";
  label_template_id?: string;
  entity_type?: "location" | "product";
  entity_id?: string;
  assigned_at?: string;
  printed_at?: string;
  is_printed: boolean;
  print_count: number;
  created_by?: string;
  assigned_by?: string;
  organization_id: string;
  branch_id: string;
  is_active: boolean;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface LabelTemplateField {
  id: string;
  label_template_id: string;
  field_type: "text" | "blank" | "qr_code";
  field_name: string;
  field_value?: string | null;

  // Position and sizing
  position_x: number;
  position_y: number;
  width_mm: number;
  height_mm: number;

  // Text styling (for text fields)
  font_size?: number | null;
  font_weight?: string | null;
  text_align?: string | null;
  vertical_align?: string | null;

  // Field behavior
  show_label?: boolean | null;
  label_text?: string | null;
  label_position?: string | null;
  label_color?: string | null;
  label_font_size?: number | null;
  is_required?: boolean | null;
  sort_order?: number | null;

  // Padding (individual field padding)
  padding_top?: number | null;
  padding_right?: number | null;
  padding_bottom?: number | null;
  padding_left?: number | null;

  // Styling
  text_color?: string | null;
  background_color?: string | null;
  border_enabled?: boolean | null;
  border_width?: number | null;
  border_color?: string | null;

  // Metadata
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface LabelTemplate {
  id: string;
  name: string;
  description?: string | null;
  label_type: "location" | "product" | "generic";
  category?: string | null;

  // Physical dimensions
  width_mm: number;
  height_mm: number;
  dpi?: number | null;
  orientation?: string | null;

  // Template configuration - JSON field in database
  template_config: Record<string, any>;

  // QR Code settings
  qr_position?: string | null;
  qr_size_mm?: number | null;

  // Label text options
  show_label_text?: boolean | null;
  label_text_position?: string | null;
  label_text_size?: number | null;

  // Additional elements
  show_code?: boolean | null;
  show_additional_info?: boolean | null;
  additional_info_position?: string | null;
  show_barcode?: boolean | null;
  show_hierarchy?: boolean | null;

  // Layout properties
  layout_direction?: string | null;
  section_balance?: string | null;

  // Colors and styling
  background_color?: string | null;
  text_color?: string | null;
  border_enabled?: boolean | null;
  border_width?: number | null;
  border_color?: string | null;

  // Fields relationship
  fields?: LabelTemplateField[];

  // Template metadata
  is_default?: boolean | null;
  is_system?: boolean | null;
  organization_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface QRScanLog {
  id: string;
  qr_token: string;
  scan_type: "redirect" | "assignment" | "verification" | "delivery" | "inventory";
  scanner_type?: "camera" | "manual" | "barcode_scanner";
  user_id?: string;
  scanned_at: string;
  ip_address?: string;
  user_agent?: string;
  redirect_path?: string;
  scan_result: "success" | "unauthorized" | "not_found" | "error";
  error_message?: string;
  scan_context: Record<string, string | number | boolean | null>;
  organization_id?: string;
  branch_id?: string;
}

export interface LabelBatch {
  id: string;
  batch_name: string;
  batch_description?: string;
  label_template_id?: string;
  quantity: number;
  label_type: "location" | "product" | "generic";
  batch_status: "pending" | "generated" | "printed" | "assigned";
  pdf_generated: boolean;
  pdf_path?: string;
  labels_per_sheet: number;
  sheet_layout: string;
  created_by?: string;
  organization_id: string;
  branch_id: string;
  generated_at?: string;
  created_at: string;
}

export interface ScanningOperation {
  id: string;
  operation_type: "delivery" | "inventory_check" | "location_assignment" | "product_verification";
  operation_name: string;
  operation_status: "active" | "completed" | "cancelled";
  started_by?: string;
  started_at: string;
  completed_at?: string;
  total_items: number;
  scanned_items: number;
  organization_id: string;
  branch_id: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ScanningOperationItem {
  id: string;
  operation_id: string;
  scanned_code: string;
  code_type: "qr_code" | "barcode" | "manual";
  entity_type?: "location" | "product";
  entity_id?: string;
  scan_result: "success" | "not_found" | "duplicate" | "error";
  quantity: number;
  notes?: string;
  scanned_by?: string;
  scanned_at: string;
  location_id?: string;
  scan_data: Record<string, string | number | boolean | null>;
}

// UI Component Props Types

export interface LabelCustomizationOptions {
  template: LabelTemplate;
  qrPosition: LabelTemplate["qr_position"];
  qrSize: number;
  showText: boolean;
  textPosition: LabelTemplate["label_text_position"];
  textSize: number;
  showCode: boolean;
  showHierarchy: boolean;
  showBarcode: boolean;
  backgroundColor: string;
  textColor: string;
  borderEnabled: boolean;
  borderWidth: number;
  borderColor: string;
}

export interface LabelGenerationRequest {
  templateId: string;
  labelType: "location" | "product" | "generic";
  quantity: number;
  customization?: Partial<LabelCustomizationOptions>;
  entityIds?: string[]; // For generating labels for specific entities
  batchName?: string;
  batchDescription?: string;
}

export interface LabelPreviewData {
  qrToken: string;
  displayText?: string;
  codeText?: string;
  hierarchy?: string[];
  barcode?: string;
  template: LabelTemplate;
}

export interface ScannerResult {
  code: string;
  type: "qr_code" | "barcode";
  format?: string; // EAN-13, Code-128, QR-Code, etc.
  rawBytes?: Uint8Array;
  quality?: number;
}

export interface ScannerConfig {
  enabledFormats: string[];
  tryHarder: boolean;
  maxNumberOfSymbols: number;
  enableCamera: boolean;
  enableManualEntry: boolean;
  continuousScanning: boolean;
  beepOnSuccess: boolean;
  vibrateOnSuccess: boolean;
}

// Database extensions for existing tables

export interface LocationWithQR extends Location {
  qr_label_id?: string;
  has_qr_assigned: boolean;
  qr_assigned_at?: string;
  qr_assigned_by?: string;
  qr_label?: QRLabel;
}

export interface ProductWithQR {
  id: string;
  name: string;
  qr_label_id?: string;
  has_qr_assigned: boolean;
  qr_assigned_at?: string;
  qr_assigned_by?: string;
  [key: string]: any; // Allow additional properties
  qr_label?: QRLabel;
}

// API Response Types

export interface QRRedirectResponse {
  success: boolean;
  redirectUrl?: string;
  error?: string;
  qrLabel?: QRLabel;
}

export interface LabelGenerationResponse {
  success: boolean;
  batchId?: string;
  labels?: QRLabel[];
  pdfUrl?: string;
  error?: string;
}

export interface ScanVerificationResponse {
  success: boolean;
  entity?: {
    type: "location" | "product";
    id: string;
    name: string;
    code?: string;
  };
  qrLabel?: QRLabel;
  error?: string;
}
