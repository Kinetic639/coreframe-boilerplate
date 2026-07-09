import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

export type { EnrichedCountLine } from "../../../../_lib/enrich-count-lines.server";

export interface GuidedCountSessionInfo {
  id: string;
  status: string;
  scope: CountSessionScope;
}
