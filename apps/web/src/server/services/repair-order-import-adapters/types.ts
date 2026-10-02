import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/** One repair order as a source describes it, before verification. */
export type CanonicalRepairOrderImportOrder = {
  /** Stable key within one import (e.g. the source block id). */
  key: string;
  zlNumber: string | null;
  orderNumber: string | null;
  vin: string | null;
  vehicleBrand: string | null;
  clientName: string | null;
  dealerName: string | null;
  /** Matcher provenance; makes a re-import of the same session a no-op. */
  source: { sessionId: string; blockId: string | null } | null;
  lines: CanonicalRepairOrderImportLine[];
};

export type CanonicalRepairOrderImportLine = {
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  rawText: string | null;
  matcherLineId: string | null;
};

export type RepairOrderImportSourceField = {
  key: string;
  label: string;
  type: "select" | "text";
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string | null }>;
};

export type RepairOrderImportSourceAdapter = {
  sourceType: string;
  label: string;
  description: string;
  loadSourceFields(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<RepairOrderImportSourceField[]>>;
  loadOrders(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sourceInput: Record<string, unknown>
  ): Promise<ServiceResult<CanonicalRepairOrderImportOrder[]>>;
};
