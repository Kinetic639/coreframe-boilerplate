# Zone 1 / Phase 4 — Matcher Branch-Aware Query Key Contract

## The key factory

```ts
// apps/web/src/hooks/queries/tools/wdd-matcher.ts
export const wddMatcherKeys = {
  all: ["svwms-wdd-matcher"] as const,
  sessions: (branchId: string | null) => [...wddMatcherKeys.all, "sessions", branchId] as const,
  results: (sessionId: string) => [...wddMatcherKeys.all, "results", sessionId] as const,
  extractedData: (sessionId: string) =>
    [...wddMatcherKeys.all, "extracted-data", sessionId] as const,
  enhancedPdfData: (sessionId: string) =>
    [...wddMatcherKeys.all, "enhanced-pdf-data", sessionId] as const,
  materializationStatus: (sessionId: string) =>
    [...wddMatcherKeys.all, "materialization-status", sessionId] as const,
};
```

- **Before:** `sessions: () => [...wddMatcherKeys.all, "sessions"] as const` — no branch identity, one shared bucket for every branch.
- **After:** `sessions: (branchId: string | null) => [...wddMatcherKeys.all, "sessions", branchId] as const` — Branch A → `["svwms-wdd-matcher", "sessions", "branch-a"]`, Branch B → `["svwms-wdd-matcher", "sessions", "branch-b"]`, no active branch → `["svwms-wdd-matcher", "sessions", null]` (deterministic, never populated — see below).
- `branchId` is **required**, not optional — TypeScript enforces that every call site supplies it, making the old zero-arg misuse a compile error rather than a silent bug.

## Where it's used

| Hook                                                | Type                    | branchId source                     |
| --------------------------------------------------- | ----------------------- | ----------------------------------- |
| `useSessionsQuery(branchId, initialData?)`          | Query                   | Explicit parameter, caller-supplied |
| `useCreateAutoSessionMutation(onCreated, branchId)` | Mutation (invalidation) | Explicit parameter, caller-supplied |
| `useRunMatchingMutation(branchId, onComplete?)`     | Mutation (invalidation) | Explicit parameter, caller-supplied |
| `useApproveAndMaterializeSessionMutation(branchId)` | Mutation (invalidation) | Explicit parameter, caller-supplied |

`branchId` is never read internally via `useAppStoreV2()` inside `wdd-matcher.ts` itself — every hook receives it as an explicit argument. This matches the already-proven `workshopKeys.lineReservations(branchId, lineId)` / `useRepairOrderLineReservationsQuery(lineId, enabled, branchId)` reference pattern (`apps/web/src/hooks/queries/workshop/index.ts`) exactly, confirmed by direct inspection before writing any code.

## Consumer-side branchId source

Both consumer components read the live value directly at their own top level:

```ts
const activeBranchId = useAppStoreV2((s) => s.activeBranchId);
```

- `apps/web/src/components/tools/svwms-wdd-matcher/index.tsx` (`SvwmsWddMatcher`)
- `apps/web/src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx` (`ExtractionReviewView`)

No prop-drilling between the two sibling view components — each independently subscribes to the same global store value, guaranteeing consistency without synchronization concerns.

## Null / initial-branch semantics

`branchId: string | null` throughout — `null` is a first-class, deterministic key segment (not specially omitted, unlike the Phase 2 DataView `buildDataViewQueryKey` helper's own "omit on null" behavior — Matcher's session list is _always_ branch-scoped, so there is no equivalent "org-scoped" fallback state to preserve).

`useSessionsQuery` additionally gates with `enabled: !!branchId` — the query does not fire while no branch is active. This means the `["svwms-wdd-matcher", "sessions", null]` bucket is a real, valid, deterministic key shape, but in practice is never populated with fetched data, since nothing ever queries into it. Verified by a dedicated test (`does not run (stays disabled) when branchId is null`).

## Invalidation semantics

All 3 mutations that invalidate the session list target **only the current branch's key** (`wddMatcherKeys.sessions(branchId)`), the narrowest correct behavior — none of these mutations (create session, run matching, approve+materialize) has any reason to affect a _different_ branch's session list, since sessions are created and scoped to the branch active at creation time. Proven by a dedicated cross-branch-isolation test: a Branch-A mutation does not mark Branch B's cached query state as invalidated.

## Hard invariants (do not violate in later work)

1. **`branchId` is cache identity ONLY.** Never forwarded to `listSessionsAction`/`createAutoSessionAction`/`runMatchingAction`/`approveAndMaterializeSessionAction` as part of the request payload. Verified structurally and by test.
2. **`branchId` is never trusted authorization input.** Server-side branch scope for Matcher sessions is derived entirely from the authoritative server context, unchanged by this phase.
3. **No global store coupling inside `wdd-matcher.ts`.** The hook module never imports or reads `useAppStoreV2()`. `branchId` is always passed in explicitly by the caller.
4. **Every real consumer must supply `branchId`.** There is no default/optional fallback — a missing argument is a compile-time TypeScript error, not a silent runtime bug.

## Non-goals of this contract

Migrating `results`/`extractedData`/`enhancedPdfData`/`materializationStatus` (all correctly `sessionId`-keyed, no bug, not touched). Fixing the Matcher PILOT-scope RLS gap (deferred, unrelated). Any DataView/QR/warehouse-consumer work (Phases 2/3/6, architecturally separate).
