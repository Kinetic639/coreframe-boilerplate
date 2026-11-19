import type { PlanningReadName, PlanningReads } from "@/server/planning/read-registry";

/**
 * Reads planning data over GET instead of a Server Action, so it runs right
 * away instead of queueing behind saves. Same arguments and same result as
 * the action it stands for (see read-registry.ts).
 */
export async function planningRead<K extends PlanningReadName>(
  name: K,
  ...args: Parameters<PlanningReads[K]>
): Promise<Awaited<ReturnType<PlanningReads[K]>>> {
  const query = args.length ? `?args=${encodeURIComponent(JSON.stringify(args))}` : "";
  try {
    const response = await fetch(`/api/planning/read/${name}${query}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    return (await response.json()) as Awaited<ReturnType<PlanningReads[K]>>;
  } catch {
    return { success: false, error: "Network error" } as Awaited<ReturnType<PlanningReads[K]>>;
  }
}
