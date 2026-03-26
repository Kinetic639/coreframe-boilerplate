/**
 * Shared result and error-classification types for all mobile query functions.
 *
 * Design rule: query functions classify PostgREST errors into machine-readable
 * kinds. Hooks and UI components branch on `kind` only — they never inspect
 * error message strings to determine behavior.
 */

// ─── Result union ─────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by every mobile query function.
 *
 * - "data"      — query succeeded and returned a non-null row
 * - "empty"     — query succeeded but the row does not exist (valid DB state)
 * - "forbidden" — RLS denied access (42501 / HTTP 403); not a network error
 * - "error"     — unexpected server or network failure; may be retried
 */
export type QueryResult<T> =
  | { kind: "data"; data: T }
  | { kind: "empty" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

/**
 * Hook-level result: QueryResult extended with a "loading" state.
 *
 * Hooks own the loading state; query functions do not (they are async and
 * always return a settled result). UI components branch on this union only.
 */
export type HookResult<T> = { kind: "loading" } | QueryResult<T>;

// ─── Disabled query key sentinel ──────────────────────────────────────────────

/**
 * Stable placeholder used as a query-key segment when a query is disabled
 * because a required parameter (e.g. orgId) is not yet available.
 *
 * TanStack Query requires a non-null key at every render, even when
 * `enabled: false` prevents the query from firing. Using `null` in the key
 * creates ghost cache slots that are confusing to inspect and invalidate.
 * This constant provides a single, intentional, documented alternative.
 *
 * Usage:  queryKey: myQueryKey(orgId ?? QUERY_KEY_DISABLED)
 * Rule:   every hook that accepts a nullable parameter MUST use this constant
 *         rather than embedding null or ad hoc strings in its key ternary.
 */
export const QUERY_KEY_DISABLED = "__disabled__" as const;

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Classifies a PostgREST response into a machine-readable error kind.
 * Called from query functions — NOT from hooks or UI.
 *
 * Mirrors the strategy in bootstrap-loader.ts classifyError:
 *   1. HTTP status is the primary signal (403 → forbidden)
 *   2. PostgreSQL SQLSTATE code is the secondary hint (42501 → forbidden)
 *      Some PostgREST deployments surface RLS denials without a 403 HTTP status.
 *   3. All other cases → "error" (fail-closed)
 *
 * Note on 401 (Unauthenticated): 401 is intentionally NOT handled here.
 * By the time a feature query runs, the session is already established inside
 * the authenticated (app) tree. If a 401 appears mid-session, the Supabase
 * auth state listener (onAuthStateChange in useAuth) handles the re-auth
 * redirect independently — feature queries surface it as kind="error" and let
 * the auth layer own the navigation response.
 * Contrast: bootstrap-loader.ts classifyError() DOES handle 401 → "invalid-session"
 * because bootstrap is the first gate before the authenticated tree is entered.
 *
 * @param status  HTTP status code from the PostgREST response wrapper
 * @param code    PostgreSQL SQLSTATE code from PostgrestError (may be undefined)
 * @param message Human-readable error message; passed through on "error"
 */
export function classifyPostgrestError(
  status: number,
  code: string | undefined,
  message: string
): { kind: "forbidden" } | { kind: "error"; message: string } {
  if (status === 403) return { kind: "forbidden" };
  if (code === "42501") return { kind: "forbidden" };
  return { kind: "error", message };
}
