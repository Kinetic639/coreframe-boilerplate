import type { HelpdeskReadName, HelpdeskReads } from "@/server/help-desk/read-registry";
import { fetchRead } from "@/lib/read";

/**
 * Reads help desk data over GET instead of a Server Action, so it runs right
 * away instead of queueing behind saves. Same arguments and same result as
 * the action it stands for (see read-registry.ts).
 */
export function helpdeskRead<K extends HelpdeskReadName>(
  name: K,
  ...args: Parameters<HelpdeskReads[K]>
): Promise<Awaited<ReturnType<HelpdeskReads[K]>>> {
  return fetchRead(`/api/help-desk/read`, name, args);
}
