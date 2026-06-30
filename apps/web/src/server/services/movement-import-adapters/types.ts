import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovementImportSourceField } from "@/lib/warehouse/inventory-types";
import type { ServiceResult } from "../inventory-movements.service";

export type CanonicalMovementImportLine = {
  sourceLineId: string;
  lineNumber: number;
  rawProductCode: string | null;
  rawProductName: string | null;
  rawUnit: string | null;
  rawQuantity: number | null;
  rawSourceLocation?: string | null;
  rawDestinationLocation?: string | null;
  rawLocation?: string | null;
  rawMetadata: Record<string, unknown>;
};

export type CanonicalMovementImportDocument = {
  sourceDocumentId: string;
  sourceDocumentNumber: string | null;
  externalReference: string | null;
  senderName: string | null;
  senderDetails?: Record<string, unknown> | null;
  recipientName: string | null;
  recipientDetails?: Record<string, unknown> | null;
  sourceMetadata: Record<string, unknown>;
  lines: CanonicalMovementImportLine[];
};

export type MovementImportSourceAdapter = {
  sourceType: string;
  label: string;
  description: string | null;
  supportedMovementTypeCodes: string[];
  inputFields: MovementImportSourceField[];
  loadSourceFields?(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    movementTypeCode: string
  ): Promise<ServiceResult<MovementImportSourceField[]>>;
  loadCanonicalDocuments(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sourceInput: Record<string, unknown>
  ): Promise<ServiceResult<CanonicalMovementImportDocument[]>>;
};
