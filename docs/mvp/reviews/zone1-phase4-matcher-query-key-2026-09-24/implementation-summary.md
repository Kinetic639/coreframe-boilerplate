# Zone 1 / Phase 4 — Matcher Branch-Aware Query Key — Implementation Summary

**Date:** 2026-09-24
**Starting SHA:** 713b2d53d6152eb56391a14b0a6745d5e68e38bf ("docs: dashboard demo-sufficient decision and container operating model clarification")

## Objective

Close the confirmed branch-cache bug in the Matcher session list: `wddMatcherKeys.sessions()` had no branch identity in its React Query cache key despite the underlying data being branch-scoped server-side, allowing Branch A's session list to be silently reused after switching to Branch B.

## What was inspected first

`workshopKeys.lineReservations(branchId, lineId)`/`useRepairOrderLineReservationsQuery` (`apps/web/src/hooks/queries/workshop/index.ts`) as the explicit reference pattern named by the plan, then the full current `wdd-matcher.ts` module, then a full-codebase grep for every consumer of `wddMatcherKeys.sessions`/`useSessionsQuery` (not just the 2 files the plan's own repository-areas note anticipated).

## Key finding that shaped the design

The reference pattern (`workshopKeys.lineReservations`) threads `branchId: string | null` as an **explicit, caller-supplied parameter** on both the query hook and its mutation siblings — it is never read internally via `useAppStoreV2()` inside the hook module itself. This matches the same "no global store coupling inside query/hook internals" principle already established in Phase 2 for the generic DataView foundation, now confirmed as the project's consistent convention across two independent modules. `useSessionsQuery`, `useCreateAutoSessionMutation`, `useRunMatchingMutation`, and `useApproveAndMaterializeSessionMutation` were all changed to accept `branchId: string | null` as an explicit parameter, matching this convention exactly.

## The consumer surface was larger than the plan's own estimate

The plan's repository-areas note anticipated "2-3 invalidateQueries call sites" across `wdd-matcher.ts` and one consumer file (`index.tsx`). A full-codebase grep for every consumer of `wddMatcherKeys.sessions`/`useSessionsQuery` — required by the task's own explicit Section 5 instruction ("Systematically find every current use... including useQuery, prefetch, invalidateQueries, setQueryData, getQueryData, removeQueries, optimistic updates, mutation callbacks, tests, helper wrappers") — found:

- 1 query (`useSessionsQuery`'s own `queryKey`)
- 3 `invalidateQueries` call sites (`useCreateAutoSessionMutation`, `useRunMatchingMutation`, `useApproveAndMaterializeSessionMutation`)
- 2 direct `setQueryData` cache-write call sites, both inside `index.tsx` (`runBackgroundPersistence`, `processFiles`) — not itemized in the plan's original repository-areas note
- A SECOND consumer file, `extraction-review-view.tsx`, calling `useRunMatchingMutation`/`useApproveAndMaterializeSessionMutation` — also not named in the plan's original repository-areas note

All 6 real call sites across 3 files were reconciled. See `consumer-invalidation-matrix.md` for the complete, per-call-site record.

## Null/initial-branch semantics

`branchId: string | null` (not optional, not silently omitted) — `wddMatcherKeys.sessions(null)` is a deterministic, valid key segment distinct from any real branch's key, matching the reference pattern exactly. `useSessionsQuery` additionally gates with `enabled: !!branchId`, per the task's own explicit "prefer the existing enabled/guard pattern" instruction — the query simply does not fire while no branch is active, so the `null` bucket is never actually populated with data. This is a small, deliberate, in-scope behavior addition (not present before this phase), directly required to make the branch-cache-identity fix deterministic rather than ambiguous.

## What was NOT done, and why

- `wddMatcherKeys.results/.extractedData/.enhancedPdfData/.materializationStatus(sessionId)` were not touched — all keyed by a globally-unique `sessionId`, no cross-branch leak possible by construction, matching the pre-implementation audit's own classification exactly. Confirmed, not merely assumed.
- No Matcher RLS, `approve_wdd_matcher_session`, Matcher permissions, or server-side branch filtering was touched. `branchId` never reaches any server action's request payload — verified structurally (grep) and by a dedicated test.
- The documented PILOT-scope Matcher RLS gap (branch isolation weaker than target) was not reopened — recorded as already-known/deferred, per explicit instruction.
- DataView, QR, warehouse consumers, SidebarBranchSwitcher, and DB/schema/RLS were not touched.
