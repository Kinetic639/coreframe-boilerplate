/**
 * Labels each Supabase request with where in the app it came from.
 *
 * Supabase stores the `X-Client-Info` request header in its API logs
 * (`request.headers.x_client_info`), so grouping the logs by it shows which
 * kind of request (server action, client navigation, full page load) and which
 * page sends how many queries. Without it every server-side request shows up
 * only as "node".
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MAX_PATH = 120;

export const CLIENT_INFO_PREFIX = "ambra-web";

/** `https://host/pl/dashboard/x/<uuid>?a=1` → `/pl/dashboard/x/:id` */
export function normalizeSourcePath(value: string | null | undefined): string {
  if (!value) return "-";
  let path = value;
  try {
    path = new URL(value, "http://local").pathname;
  } catch {
    return "-";
  }
  return path.replace(UUID, ":id").slice(0, MAX_PATH);
}

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Builds the label from request headers Next.js already sends:
 * - a server action carries `Next-Action` (the action id) and `Referer` (the page it ran on),
 * - a client navigation carries `RSC` and `Next-Url` (the page it came from),
 * - anything else is a full document request.
 */
export function buildClientInfo(headers: HeaderReader): string {
  const action = headers.get("next-action");
  if (action) {
    const id = action.replace(/[^0-9a-zA-Z]/g, "").slice(0, 16);
    return `${CLIENT_INFO_PREFIX}; kind=action; action=${id}; page=${normalizeSourcePath(headers.get("referer"))}`;
  }
  if (headers.get("rsc")) {
    return `${CLIENT_INFO_PREFIX}; kind=rsc; from=${normalizeSourcePath(headers.get("next-url") ?? headers.get("referer"))}`;
  }
  return `${CLIENT_INFO_PREFIX}; kind=page`;
}

/**
 * fetch for Supabase clients that sets `X-Client-Info` on every request.
 *
 * Passing the label in `global.headers` is not enough for clients made by
 * @supabase/ssr: createServerClient writes its own
 * `X-Client-Info: supabase-ssr/<version> createServerClient` over it, so the
 * logs only showed that fixed string. The header is set here, last, at request
 * time.
 */
export function fetchWithClientInfo(
  clientInfo: string,
  baseFetch: typeof fetch = fetch
): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Client-Info", clientInfo);
    return baseFetch(input, { ...init, headers });
  };
}
