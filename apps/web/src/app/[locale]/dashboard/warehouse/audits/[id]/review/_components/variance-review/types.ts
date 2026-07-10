import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

export type { EnrichedCountLine } from "@/lib/warehouse/count-session-types";

export interface ReviewSessionInfo {
  id: string;
  count_number: string;
  status: string;
  scope: CountSessionScope;
}
