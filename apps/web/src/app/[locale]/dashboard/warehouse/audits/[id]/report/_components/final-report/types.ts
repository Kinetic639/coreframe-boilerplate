import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

export type { EnrichedCountLine } from "../../../../_lib/enrich-count-lines.server";
export type { EnrichedReorderReportRow } from "../../../../../_lib/enrich-reorder-report.server";

export interface FinalReportSessionInfo {
  id: string;
  count_number: string;
  status: string;
  scope: CountSessionScope;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface AdjustmentLine {
  id: string;
  movement_number: string;
  variant_id: string;
  sku: string;
  productName: string;
  unitCode: string;
  quantity: number;
  direction: "increase" | "decrease";
  reasonCode: string | null;
}
