import type {
  InventoryMovementType,
  InventoryVariantOption,
} from "@/lib/warehouse/inventory-types";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";

export type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

export type LineDraft = {
  key: string;
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
};

export type MovementFormInitialValues = {
  movementId: string;
  movementTypeCode: string;
  draftNumber: string;
  documentDate: string;
  operationDate: string;
  counterpartyName: string;
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
  }>;
};

export type MovementFormProps = {
  mode: "create" | "edit";
  branchName: string;
  createdByName?: string;
  movementTypes: InventoryMovementType[];
  stockableLocations: LocationOption[];
  variants: InventoryVariantOption[];
  initialValues?: MovementFormInitialValues;
};

export type ValidationResult = {
  documentErrors: string[];
  positionErrors: string[];
  allErrors: string[];
  isValid: boolean;
};
