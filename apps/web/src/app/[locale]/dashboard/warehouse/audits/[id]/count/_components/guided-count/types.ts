import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

export type { EnrichedCountLine } from "@/lib/warehouse/count-session-types";

export interface GuidedCountSessionInfo {
  id: string;
  status: string;
  scope: CountSessionScope;
}
