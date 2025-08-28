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

export interface LabelTemplate {
  id: string;
  name: string;
  description?: string;
  label_type: "location" | "product" | "generic";
  category?: "small" | "medium" | "large" | "custom";

  // Physical dimensions
  width_mm: number;
  height_mm: number;
  dpi: number;

  // Template configuration
  template_config: Record<string, string | number | boolean | null>;
  qr_position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center"
    | "left"
    | "right";
  qr_size_mm: number;

  // Label text options
  show_label_text: boolean;
  label_text_position: "top" | "bottom" | "left" | "right" | "center" | "none";
  label_text_size: number;

  // Additional elements
  show_code: boolean;

  // New layout properties
  layout_direction?: "row" | "column";
  section_balance?: "equal" | "qr-priority" | "data-priority";

  // Colors and styling
  background_color: string;
  text_color: string;
  border_enabled: boolean;
  border_width: number;
  border_color: string;

  is_default: boolean;
  is_system: boolean;
  organization_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
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

export interface ProductWithQR extends Product {
  qr_label_id?: string;
  has_qr_assigned: boolean;
  qr_assigned_at?: string;
  qr_assigned_by?: string;
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
