import type {
  InventoryMovementType,
  InventoryUnitRow,
  InventoryVariantOption,
  MovementFieldPolicyBundle,
  MovementPartyDetails,
} from "@/lib/warehouse/inventory-types";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";

export type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

export type LineDraft = {
  key: string;
  origin: "manual" | "imported";
  source_type?: string | null;
  source_label?: string | null;
  source_line_id?: string | null;
  source_order_number?: string | null;
  variant_id: string;
  unit_id: string;
  sku: string;
  product_name: string;
  unit_code: string;
  brand_name: string | null;
  barcode: string | null;
  quantity: string;
  on_hand_at_source: number | null;
  source_location_id: string;
  destination_location_id: string;
  note: string | null;
};

export type MovementFormInitialValues = {
  movementId: string;
  movementTypeCode: string;
  draftNumber: string;
  documentDate: string;
  operationDate: string;
  senderName: string;
  senderDetails?: MovementPartyDetails | null;
  recipientName: string;
  recipientDetails?: MovementPartyDetails | null;
  externalReference: string;
  note: string;
  lines: Array<{
    variant_id: string;
    unit_id: string;
    sku: string;
    product_name: string;
    unit_code: string;
    quantity: number;
    source_location_id: string | null;
    destination_location_id: string | null;
    note?: string | null;
  }>;
};

export type ImportedMovementDocumentDraft = {
  movementTypeCode: string;
  senderName: string | null;
  senderDetails?: MovementPartyDetails | null;
  recipientName: string | null;
  recipientDetails?: MovementPartyDetails | null;
  externalReference: string | null;
  note: string | null;
  lines: Array<{
    variant_id: string;
    unit_id: string;
    sku?: string;
    product_name?: string;
    unit_code?: string;
    quantity: number;
    source_location_id: string | null;
    destination_location_id: string | null;
    note?: string | null;
    source_type?: string | null;
    source_label?: string | null;
    source_line_id?: string | null;
    source_order_number?: string | null;
  }>;
};

export type MovementFormProps = {
  mode: "create" | "edit";
  organizationName?: string;
  branchName: string;
  createdByName?: string;
  movementTypes: InventoryMovementType[];
  fieldPolicies: MovementFieldPolicyBundle;
  stockableLocations: LocationOption[];
  variants: InventoryVariantOption[];
  units: InventoryUnitRow[];
  canManageProducts: boolean;
  initialValues?: MovementFormInitialValues;
};

export type ValidationResult = {
  documentErrors: string[];
  positionErrors: string[];
  allErrors: string[];
  isValid: boolean;
};
