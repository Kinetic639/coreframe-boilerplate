import type { AppReadName, AppReads } from "@/server/reads/registry";

/** Longer arguments go in a POST body instead of the address. */
const MAX_QUERY_LENGTH = 1800;

/**
 * Calls a read route with the action's own arguments. GET (or POST for long
 * arguments) runs at once instead of queueing behind Server Actions.
 */
export async function fetchRead<T>(base: string, name: string, args: unknown[]): Promise<T> {
  const json = args.length ? JSON.stringify(args) : "";
  const query = json ? `?args=${encodeURIComponent(json)}` : "";
  const post = query.length > MAX_QUERY_LENGTH;
  try {
    const response = await fetch(post ? `${base}/${name}` : `${base}/${name}${query}`, {
      method: post ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      ...(post ? { body: json, headers: { "Content-Type": "application/json" } } : {}),
    });
    return (await response.json()) as T;
  } catch {
    return { success: false, error: "Network error" } as T;
  }
}

/** A shared read (src/server/reads/registry.ts): same arguments and result as its action. */
export function appRead<K extends AppReadName>(
  name: K,
  ...args: Parameters<AppReads[K]>
): Promise<Awaited<ReturnType<AppReads[K]>>> {
  return fetchRead(`/api/read`, name, args);
}
