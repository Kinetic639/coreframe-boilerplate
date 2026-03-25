# Phase 8 — Mobile Data Layer

## Summary

Phase 8 establishes the typed data layer for the mobile app: a typed Supabase client, a TanStack Query setup, and the first set of query functions + hooks following a consistent architectural pattern.

---

## What Was Built

| Slice                    | File(s)                                                                                                    | Status                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| Infrastructure           | `lib/supabase/client.ts` (typed), `lib/query-client.ts`, `lib/queries/types.ts`                            | Done                     |
| QueryClientProvider      | `app/(app)/_layout.tsx`                                                                                    | Done                     |
| A — Entitlements hook    | `hooks/use-entitlements.ts`                                                                                | Done                     |
| B1 — Org profile query   | `lib/queries/organization/org-profile.ts`, `hooks/queries/organization/use-org-profile-query.ts`           | Done                     |
| B2 — Org members summary | `lib/queries/organization/org-members-summary.ts`, `hooks/queries/organization/use-org-members-summary.ts` | Done                     |
| C — Tools catalog        | —                                                                                                          | **Deferred** (see below) |

---

## Query Architecture Pattern

Every data fetch follows a two-layer model:

### Layer 1: Query function (`lib/queries/`)

- Pure async function: `fetch*(supabase, ...args): Promise<QueryResult<T>>`
- Accepts a typed `SupabaseClient<Database>` — no module-level client import
- Classifies errors at this layer via `classifyPostgrestError(status, code, message)`
- Returns `QueryResult<T>` — never throws, never returns `loading`
- Testable with a mock Supabase builder (no network, no React)

### Layer 2: Hook (`hooks/queries/`)

- Wraps the query function with `useQuery` from TanStack Query
- Owns the `loading` state (not the query fn)
- Returns `HookResult<T>` — always has `kind`, UI branches exhaustively
- Imports `mobileSupabase` (singleton) internally — callers pass only `orgId` etc.

### HookResult discriminated union

```typescript
type QueryResult<T> =
  | { kind: "data"; data: T }
  | { kind: "empty" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

type HookResult<T> = { kind: "loading" } | QueryResult<T>;
```

UI components branch on `kind` with no string parsing and no raw error inspection.

---

## Why Entitlements Are NOT React Query

`useEntitlements` reads from `AppContext`, not from TanStack Query. This is intentional:

- Entitlements are loaded **once at bootstrap** by `AppProvider` before any screen renders
- They are part of the auth session, not a separate resource with its own lifecycle
- Using React Query for entitlements would duplicate state that already lives in `AppContext`
- The hook is a thin accessor: it exposes the snapshot + two pure domain functions from `@repo/domain/entitlements`

`entitlements === null` is a valid state (free-tier org, no subscription row). Both helpers return safe defaults:

- `hasModuleAccess` → `false`
- `getEffectiveLimit` → `0`

---

## Error Classification Model

Forbidden classification is **structured**, not string-based. The `classifyPostgrestError` utility:

```typescript
function classifyPostgrestError(
  status,
  code,
  message
): { kind: "forbidden" } | { kind: "error"; message: string };
```

Rules:

1. HTTP 403 → `forbidden`
2. SQLSTATE `42501` (insufficient_privilege / RLS) → `forbidden`, regardless of HTTP status
3. Everything else → `error` with the original message

This lives in `lib/queries/types.ts` and is called by every query function. Hooks and UI components never parse error messages or status codes.

---

## QueryClientProvider Placement

`QueryClientProvider` is mounted in `app/(app)/_layout.tsx` (the authenticated tree), wrapping `AppProvider`. The `QueryClient` instance is created via `useMemo(() => createMobileQueryClient(), [])`.

Cache safety: the authenticated tree is unmounted on sign-out (React Navigation replaces the `(app)` segment with `(auth)`). This destroys the `QueryClient` instance and all cached data — no explicit `queryClient.clear()` needed on sign-out.

---

## Normalizer Pattern

Query functions use `Pick<Row, selected_columns>` typed normalizers to match exactly what the SELECT returns:

```typescript
type SelectedRow = Pick<OrgProfileRow,
  "organization_id" | "name" | "name_2" | ...
>;
export function normalizeOrgProfile(row: SelectedRow): OrgProfileData { ... }
```

This excludes audit columns (`created_at`, `updated_at`) that are not fetched and prevents TypeScript from requiring fields the query doesn't select.

---

## Deferred Items

### Slice C — Tools catalog (`tools_catalog`)

**Blocked**: `tools_catalog` is not present in the generated `Database` types for the TARGET Supabase project. The migration exists in `apps/web/supabase/migrations/` (legacy) but has not been applied to the TARGET project.

**Resolution path**:

1. Apply `tools_catalog` migration to TARGET via `mcp__supabase-target__apply_migration`
2. Regenerate types via `mcp__supabase-target__generate_typescript_types`
3. Copy output to `packages/supabase/src/database.ts`
4. Implement `lib/queries/tools/tools-catalog.ts` + `hooks/queries/tools/use-tools-catalog.ts`

### Branch context queries (Phase 10)

Branch-scoped queries (e.g. branch member counts, branch settings) require the active `branchId` from `AppContext`. This is deferred until the branch context model is finalized for mobile.

### Realtime subscriptions (Phase 11)

`useQuery` with `refetchInterval` covers polling use cases. True realtime (Supabase `channel().on(...)`) is deferred — requires connection lifecycle management tied to auth state.
