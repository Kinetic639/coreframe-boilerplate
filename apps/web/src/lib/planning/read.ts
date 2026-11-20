import type { PlanningReadName, PlanningReads } from "@/server/planning/read-registry";
import { fetchRead } from "@/lib/read";

/**
 * Reads planning data over GET instead of a Server Action, so it runs right
 * away instead of queueing behind saves. Same arguments and same result as
 * the action it stands for (see read-registry.ts).
 */
export function planningRead<K extends PlanningReadName>(
  name: K,
  ...args: Parameters<PlanningReads[K]>
): Promise<Awaited<ReturnType<PlanningReads[K]>>> {
  return fetchRead(`/api/planning/read`, name, args);
}
