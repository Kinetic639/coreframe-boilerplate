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
