# Zone 1 — Identity / Access / Branch / Authorization Implementation Plan

- **Zone:** 1
- **Priority:** P0
- **Architecture status:** APPROVED
- **Runtime status:** PARTIAL
- **Plan status:** ACTIVE
- **Primary goal:** DEMO READY first, then PILOT READY
- **Last updated:** 2026-09-23

## Source-of-truth hierarchy

`docs/mvp/zones/01-auth-org-branch-access.md` is the approved product/architecture source of truth — accepted product decisions, intended workflows, IAM/branch/security architecture, DEMO READY and PILOT READY gates, scope boundaries. It is NOT a daily implementation log and is not edited by phase work.

This file (`01-auth-org-branch-access-implementation-plan.md`) owns: phase structure, dependencies, tasks, acceptance criteria, testing requirements, repository areas, DB impact, pitch/pilot classification, implementation sequence.

`docs/mvp/zones/01-auth-org-branch-access-progress.md` owns: current phase, phase statuses, mechanical task counts, implementation evidence, test results, blockers, discoveries, UAT evidence, current DEMO READY / PILOT READY state.

**If implementation evidence contradicts the accepted architecture: STOP that phase. Record the exact evidence, the BLOCKED reason, and the product/architecture decision needed. Never silently redesign.** This mirrors Zone 3's own established discipline exactly.

## Approved architecture summary

Per `01-auth-org-branch-access.md`'s own "Product decisions" section (44 numbered decisions, all DECIDED, not reopened here): one org per user; org is the tenant boundary; `org_owner` is a protected system role requiring `ownerCount >= 1` always; branch access and branch permissions are conceptually separate; multi-branch, multi-role, union-permission model; active branch is the operational context and branch switching must be atomic (validate → handle unsaved work → persist → refresh permissions → invalidate cache → safe redirect → reload); cross-branch deep links use one shared confirm-then-switch (accessible) / safe-deny (inaccessible) rule; server-side authorization is mandatory, RLS is an additional hard boundary; revocation applies on the next protected request; invitations require accept-time one-org re-validation as defense-in-depth; member removal preserves historical identity.

## Verified-current foundation summary

Per the completed Zone 1 Pre-Implementation Verification (`docs/mvp/reviews/zone1-preimplementation-verification-2026-09-23/`), the following are **VERIFIED CORRECT and must not be reworked**:

`changeBranch` server-side validation; `resolveActiveBranch`'s safe fallback + explicit re-validation; the permission-context-after-switch bridge (`PermissionsSync` → `useBranchPermissionsQuery` → Zustand), proven correct with a concrete Manager-A/Worker-B scenario; multi-role union (`compile_user_permissions`); org-wide wildcard/NULL-branch inheritance; branch-scope containment (cannot escalate to org-wide via a branch role); member removal, next-request revocation, and historical-identity preservation; `session-branch.ts` per-tab isolation; the Warehouse Map page and `workshopKeys.lineReservations` as reference implementations of the correct branch-keyed query pattern; the `warehouse.location` QR/deep-link resolver's cross-org rejection, no-metadata-leak, and open-redirect protection.

## Known confirmed gaps

**DEMO-relevant** (implementation-required this week): the branch-switch root-cause bug — `SidebarBranchSwitcher.handleBranchSelect` updates Zustand only, with no `router.refresh()`, no cache invalidation, no navigation, stranding RSC-rendered pages; 5 confirmed branch-agnostic query-key bugs (Matcher sessions, Locations, Inventory Balances, Inventory Movements, Inventory Products — the last confirmed newly during this audit); the cross-branch `warehouse.location` QR/deep-link missing confirm-then-switch UX (safe today — no leak, no unwanted switch — but the deep-link intent is silently dropped instead of honored).

**PILOT-only** (real, confirmed, explicitly NOT implemented this week per the accepted demo-vs-pilot boundary): no owner-only gate on granting/revoking `org_owner` (plus a weaker route via invitation acceptance); no last-owner-count enforcement at any layer; no self-demotion warning; no anti-privilege-escalation checks anywhere in role creation/editing/assignment; invitation acceptance doesn't re-validate the one-org invariant; one-org-per-user is app-level only, not DB-enforced; Matcher/Help Desk RLS is enabled but not forced, org-scoped only despite live `branch_id` columns; `warehouse_locations`/`wdd_matcher_*`/`app_attachments`/`helpdesk_tickets` migrations missing from the authoritative target tree (though `warehouse_locations`/`app_attachments` are live-correct — paper-trail-only gaps); `qr_codes`/`qr_assignments` have no committed source in either tree at all; the one existing live-DB RLS integration test file is structurally skipped under the project's own test command; no shared unsaved-work/navigation-guard mechanism exists; administrative auditability is absent; `apps/web/CLAUDE.md` has a stale project-ref instruction.

**These are real vulnerabilities, not minimized.** They are deferred per Zone 1's own already-accepted scope note, on the explicit condition that demo choreography never exercises self-demotion, owner removal/grant beyond one pre-rehearsed action, or role-creation-beyond-authority. See "Active blockers" in the progress tracker.

---

# PHASE ROADMAP

## DEMO READY phases (in execution order)

| Phase | Name                                               | Scope classification |
| ----- | -------------------------------------------------- | -------------------- |
| 0     | Implementation baseline / frozen boundary          | PITCH prerequisite   |
| 1     | Centralized branch transition                      | PITCH                |
| 2     | Branch-aware DataView/query-key foundation         | PITCH                |
| 3     | Migrate confirmed branch-scoped DataView consumers | PITCH                |
| 4     | Matcher branch-aware query key                     | PITCH                |
| 5     | Systematic branch-state re-sweep                   | PITCH gate           |
| 6     | Cross-branch warehouse.location deep-link/QR       | PITCH                |
| 7     | DEMO READY automated closeout                      | PITCH gate           |
| 8     | Manual DEMO READY UAT                              | PITCH gate           |

## PILOT READY phases (after DEMO READY, in execution order)

| Phase | Name                                          | Scope classification |
| ----- | --------------------------------------------- | -------------------- |
| A     | Ownership invariants                          | PILOT                |
| B     | Anti-escalation / role administration         | PILOT                |
| C     | Invitation + one-org invariant                | PILOT                |
| D     | Branch RLS hardening                          | PILOT                |
| E     | Schema source-of-truth reconciliation         | PILOT                |
| F     | Unsaved-work / navigation safety              | PILOT                |
| G     | Live security/integration test infrastructure | PILOT                |
| H     | Administrative auditability                   | PILOT                |
| I     | PILOT READY manual verification               | PILOT gate           |

---

# DEMO READY PHASES — DETAIL

## Phase 0 — Implementation baseline / frozen boundary

### Status

**DONE (2026-09-23)** — verification/documentation phase, already satisfied by the completed pre-implementation audit. No runtime implementation occurs in this phase.

### Scope classification

PITCH prerequisite

### Objective

Lock the current-state baseline: authoritative Supabase target, current schema drift, current authorization-model correctness, current branch/cache bug inventory, current test state, and the exact demo-vs-pilot boundary — so every later phase builds on verified ground truth, not assumption.

### Why it exists

Mirrors Zone 3's own Phase 0A discipline: establish a trustworthy, scoped baseline without attempting a disproportionate full reconciliation, and explicitly accept residual out-of-scope drift as documented debt rather than silently ignoring it.

### Dependencies

None.

### Repository areas affected

None — documentation only.

### Supabase changes

NONE.

### Existing infrastructure reused

N/A.

### Implementation tasks

- [x] Environment/schema verification — environment-verification.md
- [x] Systematic branch-state/cache inventory — branch-state-cache-inventory.md
- [x] Authorization-model verification — authorization-model-verification.md
- [x] Admin/security verification — admin-security-verification.md
- [x] Cross-branch QR/deep-link verification — deep-link-qr-verification.md
- [x] Existing test execution — test-results.md
- [x] Gap matrix synthesis — gap-matrix.md
- [x] Demo-vs-pilot boundary — demo-vs-pilot-boundary.md
- [x] Recommended implementation pass (input/evidence only, not blindly reused for phase structure) — recommended-implementation-pass.md

### Testing requirements

N/A — this phase IS the verification.

### Acceptance criteria

The Zone 1 pre-implementation verification bundle (11 files) exists, is committed (5dfce9d3), and its findings are cross-referenced by every phase below. **Met.**

### Out of scope

Any runtime implementation. Any fix to apps/web/CLAUDE.md's stale project-ref instruction — originally assigned to PILOT Phase E; moved to Phase 1 and fixed there on 2026-09-24 as a tiny operational-safety documentation correction once implementation began (see Phase 1's own "Implementation tasks" and PILOT Phase E's updated scope note below).

### Blocker rule

N/A — phase complete, no blockers found.

---

## Phase 1 — Centralized branch transition

### Status

NOT STARTED

### Scope classification

PITCH

### Objective

SidebarBranchSwitcher correctly completes the atomic branch-switch transition: after a successful changeBranch() call, refresh the server-rendered tree and navigate to a safe route, so no RSC-rendered page remains stranded showing the old branch's data.

### Why it exists

Closes the confirmed root-cause bug: SidebarBranchSwitcher.handleBranchSelect only updates the Zustand store today — no router.refresh(), no cache invalidation, no navigation. This is the single highest-pitch-impact bug found.

### Dependencies

Phase 0.

### Repository areas affected

- apps/web/src/app/[locale]/dashboard/\_components/sidebar-branch-switcher.tsx
- Possibly a new small shared helper (e.g. apps/web/src/lib/branch-transition.ts) if the logic doesn't fit cleanly inline — TO VERIFY DURING PHASE.

### Supabase changes

NONE.

### Existing infrastructure reused

changeBranch server action (already correct, do not modify); Next.js router.refresh()/navigation primitives.

### Implementation tasks

- [x] Determine the safe start route to redirect to after a switch. TO VERIFY DURING PHASE.
- [x] Add router.refresh() call to handleBranchSelect after a successful changeBranch() call.
- [x] Add navigation to the safe start route after a successful switch.
- [x] Confirm the toast/loading state UX is not broken by the added navigation.
- [x] Update sidebar-branch-switcher.test.tsx to assert router.refresh()/navigation is called on success.
- [x] (Added 2026-09-24, moved from PILOT Phase E per explicit instruction once implementation began) Fix apps/web/CLAUDE.md's stale "always use zlcnlalwfmmtusigeuyk" project-reference instruction to reference the live target ref (rjeraydumwechpjjzrus) and the authoritative migration tree (apps/web/supabase-target/supabase/migrations). Tiny operational-safety documentation correction only — not part of Phase 1's own runtime logic, and does not touch PILOT Phase E's actual schema-reconciliation scope.

### Testing requirements

- Unit/component: extend the existing (currently passing) sidebar-branch-switcher.test.tsx.
- Manual UAT: deferred to Phase 8, but a developer-level sanity check is expected before marking this phase DONE.

### Acceptance criteria

1. Switching branches while on a RepairOrder detail page for an ID belonging to the OLD branch results in the user being redirected to the safe start route, not a broken/404 page and not a stale render.
2. Switching branches while on an Inventory Movement detail/edit page for an ID belonging to the OLD branch behaves the same way.
3. sidebar-branch-switcher.test.tsx passes with the new assertions.
4. pnpm type-check and pnpm lint remain clean for the touched files.

### Out of scope

Any DataView/query-key work (Phase 2/3). Any QR/deep-link work (Phase 6). Any unsaved-work protection (PILOT Phase F).

### Blocker rule

If the "safe start route" decision cannot be resolved from the existing architecture doc without a genuine new product decision, STOP and record the exact question.

---

## Phase 2 — Branch-aware DataView/query-key foundation

### Status

NOT STARTED

### Scope classification

PITCH

### Objective

DataViewListParams/use-data-view-query.ts gain a systematic, optional branchId mechanism that any caller CAN use to get correctly branch-scoped cache identity — closing this bug class for every future DataView-based screen, not just the 4 confirmed instances.

### Why it exists

4 of 4 branch-scoped DataView consumers checked in the pre-implementation audit have the identical static-key bug, because the underlying shared type has no branchId field at all — a structural gap, not 4 independent oversights. Fixing the foundation once prevents a 5th instance next month.

### Dependencies

Phase 0. Independent of Phase 1 (can run in parallel), though its own manual verification is more useful once Phase 1 has also landed.

### Repository areas affected

- apps/web/src/components/data-view/use-data-view-query.ts
- apps/web/src/lib/data-view/types.ts (DataViewListParams)
- Possibly apps/web/src/components/data-view/data-view-provider.tsx/data-view.tsx — TO VERIFY DURING PHASE.

### Supabase changes

NONE.

### Existing infrastructure reused

The already-correct workshopKeys.lineReservations(branchId, lineId) pattern as the reference shape.

### Implementation tasks

- [x] ~~Add an optional branchId field to DataViewListParams.~~ **Factual correction (2026-09-24, evidence-based):** `DataViewListParams` is not purely cache-key material — it is also the exact object passed as the request payload to every `listFetcher`. Adding `branchId` there would have leaked it into server request payloads, violating the query-key/request-payload separation. Instead, `branchId?: string | null` was added directly to `UseDataViewListQueryOptions`/`UseDataViewSidebarInfiniteQueryOptions` in `use-data-view-query.ts` (the hook layer, not the shared request-payload type), merged into the query key via a new pure, exported helper `buildDataViewQueryKey(baseKey, branchId)`. `DataViewListParams` itself was left untouched. See `docs/mvp/reviews/zone1-phase2-dataview-foundation-2026-09-24/query-key-contract.md` for the full contract.
- [x] Update use-data-view-query.ts's own key-building logic to merge branchId into the query key when present, leaving it unaffected when absent (backward-compatible for org-scoped screens).
- [x] Write a unit test for the key-building function: same params + different branchId => different key; branchId absent => unchanged from today's behavior.
- [x] Spot-check 1-2 correctly org-scoped DataView screens (e.g. Tickets) to confirm they are unaffected.

### Testing requirements

- Unit: the new key-building test above.
- Regression: confirm 1-2 org-scoped DataView screens still pass their own existing tests unmodified.

### Acceptance criteria

1. ~~DataViewListParams accepts an optional branchId.~~ Superseded by the factual correction above: the DataView query hook options (`UseDataViewListQueryOptions`, `UseDataViewSidebarInfiniteQueryOptions`) accept an optional `branchId`, not `DataViewListParams`.
2. A unit test proves two calls differing only in branchId produce different query keys.
3. A unit test (or existing test re-run) proves an org-scoped DataView call with no branchId produces the exact same key as before this change.
4. pnpm type-check and pnpm lint remain clean.

### Out of scope

Actually migrating any consumer to pass branchId — that is Phase 3. This phase only builds the mechanism.

### Blocker rule

If threading branchId through the provider layer turns out to require a broader refactor than a type addition + key-merge, STOP and report the exact obstruction rather than forcing an oversized change into what should be a small foundation phase.

---

## Phase 3 — Migrate confirmed branch-scoped DataView consumers

### Status

NOT STARTED

### Scope classification

PITCH

### Objective

The 4 confirmed branch-scoped DataView consumers pass branchId (read live from useAppStoreV2, not a stale SSR prop) into their own queryKey, using the Phase 2 foundation.

### Why it exists

Closes 4 confirmed bugs: Locations, Inventory Balances, Inventory Movements, Inventory Products. Grouped into one phase rather than 4 separate phases because all 4 are the identical mechanical fix against the identical foundation from Phase 2 — splitting further would be ceremony without a corresponding risk-reduction benefit.

### Dependencies

Phase 2 (the foundation must exist first). Independent of Phase 1 and Phase 4.

### Repository areas affected

- apps/web/src/app/[locale]/dashboard/warehouse/locations/\_components/locations-data-view.tsx
- apps/web/src/app/[locale]/dashboard/warehouse/inventory/\_components/inventory-client.tsx
- apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/\_components/inventory-movements-client.tsx
- apps/web/src/app/[locale]/dashboard/warehouse/items/\_components/inventory-products-client.tsx (**factual correction, 2026-09-24**: actual path is `warehouse/items/_components/`, not `warehouse/inventory/_components/` as originally written — verified by direct file lookup before Phase 3 implementation began; the plan's own earlier citation of `inventory-products-client.tsx:42,324` from the pre-implementation audit remains accurate for line numbers within the file itself)

### Supabase changes

NONE.

### Existing infrastructure reused

Phase 2's foundation; the live activeBranchId read pattern already correctly used by map-list-client.tsx.

### Implementation tasks

- [x] Locations: read live activeBranchId from useAppStoreV2, pass into the DataView's queryKey. Implemented via the new `branchId` prop on `<DataView>` (per the Phase 2 contract), not by literally concatenating branchId into the `["locations"]` array — the merge happens inside `buildDataViewQueryKey`.
- [x] Inventory Balances: same.
- [x] Inventory Movements: same. Also confirmed InventoryMovementsClient's own activeBranchId prop usage: the DataView's own cache-identity source now reads live from the store (new local variable `liveActiveBranchId`); the existing, separate `activeBranchId` prop (frozen SSR value) is deliberately left forwarding unchanged to `InventoryMovementDetailPanel`, since that downstream component's own branch-awareness was not part of this phase's named scope.
- [x] Inventory Products: **factual correction (2026-09-24)** — `INVENTORY_PRODUCTS_QUERY_KEY = ["inventory-products"]` itself was deliberately NOT modified to "include branchId" as originally worded; per the Phase 2 contract, branchId must be threaded as a separate, explicit prop (not concatenated into the consumer's own base queryKey array), so the actual fix passes `branchId={activeBranchId}` alongside the unchanged `queryKey={INVENTORY_PRODUCTS_QUERY_KEY}` — the merge happens inside `buildDataViewQueryKey`, exactly as for the other 3 consumers.
- [x] For each of the 4: manual developer-level/automated check that switching branches produces a different query key without a manual reload — verified via dedicated consumer-wiring tests (see the Phase 3 closeout bundle) proving each consumer forwards a changed `activeBranchId` into a changed `branchId` prop.

### Testing requirements

- Manual UAT (developer-level sanity, full formal UAT is Phase 8): switch branch on each of the 4 screens, confirm content updates.
- No new automated test type needed beyond what Phase 2 already covers at the foundation level.

### Acceptance criteria

1. Switch Branch A to B while viewing Locations: the list shows Branch B's locations without a manual reload.
2. Same for Inventory Balances (stock quantities correctly reflect Branch B).
3. Same for Inventory Movements.
4. Same for Inventory Products (stock-quantity columns correctly reflect Branch B, not stale Branch A values).
5. pnpm type-check and pnpm lint remain clean for all 4 touched files.

### Out of scope

Matcher (Phase 4). Any other DataView consumer not confirmed as branch-scoped in the gap matrix.

### Blocker rule

If any of the 4 consumers turns out to have additional, previously-undiscovered branch-scoping issues beyond the query key itself, STOP and record the exact finding — this would contradict the pre-implementation verification's own "server always derives branch context fresh" finding and needs to be understood before proceeding, not silently patched.

---

## Phase 4 — Matcher branch-aware query key

### Status

NOT STARTED

### Scope classification

PITCH

### Objective

wddMatcherKeys.sessions() becomes wddMatcherKeys.sessions(branchId), threaded through useSessionsQuery and its callers/invalidation sites, following the exact pattern already proven correct in workshopKeys.lineReservations(branchId, lineId).

### Why it exists

Closes the confirmed Matcher session-list bug — the exact instance the product owner personally suspected before any audit began. Matcher is a headline pitch feature, and test-results.md confirms zero test coverage exists for this key today.

### Dependencies

Phase 0. Kept as its OWN phase, separate from Phase 3, deliberately — wdd-matcher.ts is an architecturally distinct module (a purpose-built hook file, not the generic DataView component), so combining it with Phase 3 would mix two different code patterns in one diff for no shared-mechanism benefit. Independent of Phase 1, 2, 3.

### Repository areas affected

- apps/web/src/hooks/queries/tools/wdd-matcher.ts (wddMatcherKeys.sessions(), useSessionsQuery, the 2-3 invalidateQueries call sites referencing it)
- apps/web/src/components/tools/svwms-wdd-matcher/index.tsx (the consumer)
- **Factual correction (2026-09-24, implementation evidence):** the actual consumer surface is larger than originally itemized. `wdd-matcher.ts` has exactly 3 `invalidateQueries` call sites referencing `wddMatcherKeys.sessions()` (`useCreateAutoSessionMutation` — confirmed dead code, zero callers anywhere in the codebase, but fixed for consistency and to close the bug class; `useRunMatchingMutation`; `useApproveAndMaterializeSessionMutation`), not merely "the main list hook." `index.tsx` additionally has 2 direct `queryClient.setQueryData(wddMatcherKeys.sessions(), ...)` cache-write call sites (in `runBackgroundPersistence` and `processFiles`) not named in the original repository-areas note. A second consumer file, `apps/web/src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx`, was also found and updated — it calls `useRunMatchingMutation`/`useApproveAndMaterializeSessionMutation` and needed its own live `activeBranchId` read to supply them. All 6 call sites (1 query + 3 invalidations + 2 cache writes) across 3 files were reconciled — see the Phase 4 closeout bundle's `consumer-invalidation-matrix.md` for the complete, verified list.

### Supabase changes

NONE.

### Existing infrastructure reused

workshopKeys.lineReservations(branchId, lineId)'s own pattern.

### Implementation tasks

- [x] Change wddMatcherKeys.sessions to accept branchId.
- [x] Update useSessionsQuery to read live activeBranchId and pass it in. Implemented as an explicit `branchId` parameter (caller-supplied), matching the established `workshopKeys.lineReservations`/`useRepairOrderLineReservationsQuery` convention exactly — not read internally via `useAppStoreV2()` inside the hook itself, per the standing "no global store coupling inside query hooks" rule.
- [x] Update the 2-3 invalidateQueries({queryKey: wddMatcherKeys.sessions()}) call sites to match the new key shape. Actual count: 3 invalidateQueries + 2 setQueryData call sites — see the factual correction above.
- [x] Add a unit test on the key factory (branch change => different key) — closing the confirmed zero-coverage gap. 12 tests added in total (key factory + query behavior + invalidation semantics) — see the Phase 4 closeout bundle.

### Testing requirements

- Unit: the new key-factory test.
- Manual UAT (developer-level sanity, formal UAT is Phase 8): open Matcher in Branch A, switch to Branch B, confirm the session list updates.

### Acceptance criteria

1. wddMatcherKeys.sessions(branchId) produces different keys for different branches.
2. Switching branches while Matcher is open updates the "Past uploads" list without a manual reload.
3. A new unit test for the key factory exists and passes.
4. pnpm type-check and pnpm lint remain clean.

### Out of scope

Any other Matcher query key (results, extractedData, etc.) — these are keyed by globally-unique sessionId and were classified as correctly safe (no cross-branch leak); not touched here.

### Blocker rule

Standard — if evidence contradicts the pre-implementation finding, stop and report.

---

## Phase 5 — Systematic branch-state re-sweep

### Status

NOT STARTED

### Scope classification

PITCH gate

### Objective

Verification-only phase proving Phases 1-4 closed the systemic problem, not just the originally-known instances — re-run the same systematic sweep methodology from the pre-implementation audit AFTER the fixes land, to catch anything missed and confirm no regression.

### Why it exists

The pre-implementation audit itself found a bug (Inventory Products) that an earlier, narrower check would have missed — proving the systemic-sweep discipline finds real things a targeted-only check would not. This phase re-applies that discipline once, after implementation, as a closing gate rather than trusting the original enumeration was perfectly complete.

### Dependencies

Phases 1, 2, 3, 4 (all must be complete).

### Repository areas affected

None (verification only) unless the sweep finds something, in which case: TO VERIFY DURING PHASE.

### Supabase changes

NONE expected.

### Existing infrastructure reused

The exact grep/trace methodology from branch-state-cache-inventory.md.

### Implementation tasks

- [x] Re-sweep all useQuery/useMutation/DataView call sites in apps/web/src for any branch-scoped surface not covered by Phases 1-4. All 16 current `<DataView>` consumers classified (4 already fixed by Phase 3; 12 confirmed ORG-SCOPED BY DESIGN or NOT PITCH-RELEVANT, zero new bugs); every query-key factory module in `hooks/queries/` inspected; every direct `invalidateQueries`/`setQueryData`/`getQueryData`/`removeQueries`/`prefetchQuery` call site app-wide inspected. Zero new branch-scoped-static-key bugs found. See `docs/mvp/reviews/zone1-phase5-systematic-resweep-2026-09-24/branch-sensitive-surface-matrix.md` and `query-key-resweep.md`.
- [x] Confirm no RSC-rendered route remains stranded after a branch switch (spot-check RepairOrder and Movement detail pages again, post-Phase-1 fix). Confirmed structurally: Phase 1's redirect is unconditional (fires on every successful switch regardless of current route), and neither the RepairOrder nor Movement detail/edit pages have been touched since the pre-implementation audit (confirmed via `git log`) — the previously-documented `notFound()` compounding risk is now moot, since the user is redirected away before ever re-rendering the stale page.
- [x] Confirm no alternate branch-switch entry point exists that bypasses the Phase 1 fix. Exhaustive app-wide grep for every `changeBranch(`/`setActiveBranch(` call site found exactly one user-facing switch path (`SidebarBranchSwitcher`, the Phase-1-fixed centralized transition) and one non-switch reconciliation call (`_providers.tsx`'s session-hydration effect, which runs only in response to already-fresh SSR context and is compatible with the branch-aware-key architecture — not a second switch path). The Phase-6-specific cross-check noted in the original task wording ("once that lands") cannot be performed yet, since Phase 6 has not started — deferred to Phase 6's own implementation, not a Phase 5 gap.
- [x] Confirm permission-context-after-switch remains correct (regression check against the already-verified-correct PermissionsSync bridge). `PermissionsSync.tsx` and `use-branch-permissions-query.ts` confirmed untouched by any commit since before Zone 1 Phase 1 began (`git log`); both existing test suites re-run and pass (see test-results.md).

### Testing requirements

Read-only code sweep; no new automated tests expected unless a new gap is found.

### Acceptance criteria

1. Zero additional CONFIRMED BUG-classified branch-scoped surfaces found beyond what Phases 1-4 already fixed.
2. Zero stranded RSC routes found on re-check.
3. Zero alternate branch-switch bypass paths found.
4. Permission-context-after-switch re-confirmed correct.

### Out of scope

Fixing anything PILOT-classified (that's Phases A-I). Expanding scope to non-pitch-relevant screens.

### Blocker rule

If this sweep finds a genuinely new, non-trivial bug (not a variant of the already-fixed pattern), STOP, record it, and treat it as requiring its own small follow-up phase rather than silently folding it into this verification-only phase's own scope.

---

## Phase 6 — Cross-branch warehouse.location deep-link / QR

### Status

DONE (2026-09-24), CORRECTED (2026-09-24, same day, pre-commit review) — see `docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/` for full evidence, including `phase6-closeout.md`'s "Correction pass summary".

### Scope classification

PITCH

### Objective

Scanning/opening a warehouse.location QR/deep-link for an object in a DIFFERENT branch than the current active one prompts a confirm-then-switch dialog (if accessible) instead of silently falling back to the wrong branch's first location; inaccessible-branch targets remain safely denied exactly as today.

### Why it exists

Closes the confirmed UX gap — currently safe (no leak, no unwanted switch) but not per Zone 1 decisions 24-27, and this degrades the pitch's own QR-scan moment.

### Dependencies

Phase 1 (the confirm-then-switch flow should land on the Phase-1-fixed, correctly-refreshing branch-switch behavior, not an unfixed one).

### Repository areas affected

- apps/web/src/server/qr/public-token-resolver.ts (resolvePublicQrToken)
- apps/web/src/server/qr/target-registry.ts (QrTargetDescriptor.validate() JSDoc correction)
- **Factual correction (implemented 2026-09-24):** the plan's original interception point (`LocationsPage.tsx`'s reset-effect at ~line 485-490) is a purely presentational, controlled child. The actual owner of URL-derived selection state, branch context, and navigation is `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx` (`AmbraLocationsClient`) — confirmed as `LocationsPage`'s only consumer via grep. The confirm-then-switch dialog and all new state (`pendingCrossBranch`, `isSwitchingBranch`) live there instead. `LocationsPage.tsx` itself was not modified.
- apps/web/src/app/[locale]/dashboard/warehouse/locations/page.tsx — **not anticipated by the original plan.** Required a `key={branchId ?? "no-branch"}` prop on `<AmbraLocationsClient>` (the Server Component parent). Next.js's `router.refresh()` re-executes Server Components but does not reset an already-mounted client component's own `useState` — since this flow stays on the same route (to preserve the deep-link target) rather than navigating away like Phase 1's sidebar switch, no natural remount would otherwise occur after a same-route branch switch. Keying on `branchId` forces React to remount `AmbraLocationsClient` on every branch change, guaranteeing fresh state.

### Supabase changes

NONE.

### Existing infrastructure reused

The already-correct, already-validated changeBranch() server action (no new authorization primitive needed).

### Implementation tasks

- [x] resolvePublicQrToken: for a logged-in caller, read their current active branch. Mechanism: a second, separate RLS-scoped client (`createClient()` from `@/utils/supabase/server`, kept apart from the pre-existing service-role client) calls `.auth.getUser()` then reads the caller's own `user_preferences.default_branch_id` row. `getUser()` resolves to no user for anonymous/logged-out scans, making this block a safe no-op in that case.
- [x] Encode a crossBranch=<targetBranchId> flag on the redirect when the target's branch differs from the caller's active branch (logged-in callers only; anonymous/logged-out flow unaffected).
- [x] `AmbraLocationsClient` (not `LocationsPage` — see factual correction above): when `crossBranch` is present, render a confirm dialog instead of silently falling back to locations[0]. The pending target is deliberately held outside `treeSelectedId` (in a separate `pendingCrossBranch` state) so the pre-existing reset-effect never overwrites it before the user responds.
- [x] On confirm: call changeBranch(), then re-navigate to the target location.
- [x] On cancel: clear the param, preserving today's existing silent-drop-to-current-branch behavior as the cancel outcome.
- [x] Correct the stale QrTargetDescriptor.validate() JSDoc claim that this resolver "runs with the authenticated Supabase client (RLS enforced)" — factually incorrect for this caller today (it's a service-role client; the JSDoc now says so).

### Testing requirements

- Unit/service: a test for resolvePublicQrToken's new cross-branch-flag behavior. DONE — `apps/web/src/server/qr/__tests__/public-token-resolver.test.ts` (5 tests).
- Component: a test for the new confirm dialog. DONE — `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/__tests__/ambra-locations-client.cross-branch.test.tsx` (6 tests, targets `AmbraLocationsClient` per the corrected component ownership above).
- Manual UAT (formal, Phase 8): on the actual presentation phone — scan a location QR belonging to a different branch, confirm the dialog appears, confirm switching works, confirm cancel leaves the user safely on the original branch. NOT YET PERFORMED — deferred to Phase 8 as originally planned.

### Acceptance criteria

1. Scanning a QR for a Branch-B location while active branch is A, with access to B: a confirm dialog appears (not a silent fallback). PASS.
2. Confirming switches to Branch B and opens the exact target location. PASS.
3. Cancelling leaves the user on Branch A with no location selected/opened. PASS.
4. Scanning a QR for a Branch-B location without access to B: behavior is unchanged from today (safe, no leak, no dialog implying access that doesn't exist). PASS.
5. Logged-out scan behavior is unchanged. PASS.

### Bug found and fixed during implementation (not anticipated by the plan)

Radix UI's `AlertDialogAction`/`AlertDialogCancel` are thin wrappers over `DialogPrimitive.Close`, which fires the dialog's own `onOpenChange(false)` on every click via `composeEventHandlers`, independent of any custom `onClick` handler. This meant clicking "Confirm" always triggered `handleCancelCrossBranch()` (clearing `pendingCrossBranch` and the URL) synchronously, before the async `changeBranch()` result was known — so a **failed** switch would silently close the dialog with no visible error/retry path, even though `isSwitchingBranch`/`pendingCrossBranch` state was written to stay open on failure. Caught by the "failed switch" component test (initially red). Fixed by calling `event.preventDefault()` in both buttons' `onClick` handlers, which Radix's `composeEventHandlers` respects (`checkForDefaultPrevented` defaults to `true`), making the app's own handlers the sole source of truth for closing the dialog.

### Correction pass (2026-09-24, same day, pre-commit review)

Before commit, review found two contract gaps and required a correction pass. Both are recorded here as factual additions to the phase's own contract — the implementation tasks above remain checked off/DONE unchanged; this is a refinement of task 2 (the cross-branch flag logic) and task 1's downstream consequences, not new scope.

**Correction A — access-aware hint.** The original implementation appended the `crossBranch` hint for ANY same-org branch mismatch, regardless of whether the caller could actually access the target branch — relying on `changeBranch()` to reject an inaccessible target only after the user clicked "Switch branch". Corrected: the resolver now calls `isBranchAccessible()` (extracted from `changeBranch()`'s own inline check into `apps/web/src/lib/utils/branch-access.ts`, so the hint decision and the real authorization decision share one implementation) before appending the hint. An inaccessible target now returns the resolver's existing `{ok:false, error:"TARGET_NOT_FOUND"}` shape instead — no switch offer is ever shown for a target that can never succeed.

**Correction B — logged-out auth-return re-evaluation.** The original implementation proved the logged-out redirect string was byte-for-byte unchanged, but never traced what happens next. Tracing found that `dashboard/layout.tsx`'s own returnUrl mechanism preserves only the request pathname (`x-pathname` = `request.nextUrl.pathname`, which excludes the query string) — so an anonymous caller's `selected=<id>` would have been silently dropped on the sign-in round trip, and the branch-aware hint logic would never have run under an authenticated context. Corrected: an anonymous caller (`loadDashboardContextV2()` returns `null`) is now redirected to `/sign-in?returnUrl=/qr/<token>` (the QR page itself, which has no query string to lose) instead of the pre-computed dashboard path — guaranteeing `resolvePublicQrToken` re-runs in full, under a real authenticated context, before any dashboard redirect is ever computed. `dashboard/layout.tsx` and `signInAction` were read and traced but not modified — this correction only changes what the QR resolver redirects an anonymous caller TO.

Both corrections re-use `validation.branchId` as their gate, exactly like the original implementation — no scope expansion beyond `warehouse.location`. Full detail, evidence, and the corrected 21-item acceptance-criteria walkthrough: `docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/phase6-closeout.md`.

### Out of scope

Generalizing this to helpdesk.ticket/planning.task — noted as a future extension, not built now.

### Blocker rule

If reading the caller's active branch from within resolvePublicQrToken turns out to require a larger authentication-context change than anticipated, STOP and report — this phase should remain a narrow UI/service addition, not a resolver-architecture change. (Not triggered — `loadDashboardContextV2()`, the existing authoritative context loader, proved sufficient for both the original implementation and this correction pass.)

---

## Phase 7 — DEMO READY automated closeout

### Status

NOT STARTED

### Scope classification

PITCH gate

### Objective

All Zone-1-relevant automated tests pass (or are correctly classified as pre-existing/unrelated), pnpm type-check and pnpm lint are clean, and the 2 confirmed Zone-1-relevant test/mock-drift failures found in the pre-implementation audit are fixed.

### Why it exists

Zone 1's own "Status change rules" state passing automated tests alone cannot promote DEMO READY — but a genuinely clean automated baseline is still a required GATE before the manual UAT phase, not optional.

### Dependencies

Phases 1-6.

### Repository areas affected

- apps/web/src/server/services/**tests**/organization-rls.test.ts (fix the supabase.rpc mock gap for the createBranch test)
- apps/web/src/server/loaders/v2/**tests**/load-app-context.v2.test.ts (fix the fixture to expect branch_number, public_warehouse_maps_enabled)

### Supabase changes

NONE.

### Existing infrastructure reused

N/A.

### Implementation tasks

- [ ] Fix organization-rls.test.ts's mock client to stub .rpc for the branch-numbering call.
- [ ] Fix load-app-context.v2.test.ts's fixture to expect the 2 additional branch fields.
- [ ] Re-run every test file touched by Phases 1-6 plus the 2 fixed here; confirm all pass.
- [ ] Run pnpm type-check (whole apps/web); confirm clean.
- [ ] Run pnpm lint (whole apps/web); confirm 0 errors.
- [ ] Note, do NOT fix, the 3 client-suite crashes caused by the unrelated nuqs/parseAsJson library mismatch — flag in the progress tracker as a known, pre-existing, out-of-Zone-1-scope test-infrastructure issue.

### Testing requirements

Covered above — this phase IS the testing gate.

### Acceptance criteria

1. Both identified test/mock-drift fixes land and their own test files pass.
2. Every test file touched or newly added by Phases 1-6 passes.
3. pnpm type-check clean.
4. pnpm lint clean (0 errors).
5. The 3 unrelated nuqs-crash files and their masking of Zone-1-relevant coverage are explicitly documented in the progress tracker.

### Out of scope

Fixing the nuqs/parseAsJson library issue itself. Fixing the organization-rls-integration.test.ts env-loading gap (that's PILOT Phase G). Fixing the unrelated rls-permission-invariants.test.ts VMI-wildcard test.

### Blocker rule

Standard.

---

## Phase 8 — Manual DEMO READY UAT

### Status

NOT STARTED

### Scope classification

PITCH gate

### Objective

Execute Zone 1's own already-defined "Gate to DEMO READY" integrated manual scenario on the current build, on the actual presentation laptop and phone, with prepared accounts, and record PASS/FAIL per step with date/build/environment/accounts/result.

### Why it exists

Zone 1's own "Status change rules" are explicit: static inspection and passing automated tests alone CANNOT promote DEMO READY. Only this manual pass can.

### Dependencies

Phases 1-7 (all must be complete and green).

### Repository areas affected

None (no code changes in this phase, unless a UAT failure exposes an in-scope regression from Phases 1-7).

### Supabase changes

NONE.

### Existing infrastructure reused

N/A.

### Implementation tasks

- [ ] Prepare accounts per docs/mvp/presentation-demo-setup.md (at least 2 branches, presenter/admin + warehouse-worker accounts with genuinely different roles/access).
- [ ] Execute the integrated "Gate to DEMO READY" scenario (login, org/branch confirm, distinct-role accounts shown, restricted operation denied, branch switch with immediate data+permission change with no refresh, one administrative action, cross-branch QR confirm/deny, optional revocation check).
- [ ] Execute on the actual presentation laptop.
- [ ] Execute the QR/login-path portion specifically on the presentation phone.
- [ ] Record date, build/commit SHA, environment, accounts/roles used, and PASS/FAIL per step.

### Testing requirements

Manual only, by design.

### Acceptance criteria

Every pitch-critical step of the scenario passes on the current build, on both devices, with recorded evidence.

### Out of scope

Last-owner/self-demotion negative tests (deferred to PILOT Phase I). Full privilege-escalation matrix. Any PILOT-scope verification.

### Blocker rule

If any step fails and the cause is a regression from Phases 1-6, fix it, re-run Phase 7's automated gate, then re-run this entire manual scenario from the top. If any step fails and the cause is a genuine architecture question, STOP and report.

### Only after this phase passes may Zone 1 be marked DEMO READY.

---

# PILOT READY PHASES — DETAIL

These are deliberately NOT scheduled or estimated for this week. Detailed here so Zone 1 does not need to be redesigned after the presentation.

## PILOT Phase A — Ownership invariants

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

org_owner grant/revoke is gated to existing owners only (both the direct role-assignment path and the weaker invitation-acceptance path); ownerCount >= 1 is enforced transactionally, not just assumed; self-demotion shows a warning.

### Why it exists

Closes the confirmed vulnerabilities: no owner-only gate exists anywhere today (app, RLS, or DB-trigger level), including a second, independently weaker route via invites.create.

### Dependencies

Depends on Phase 0 only; should follow DEMO READY (Phase 8) being reached, per this plan's own DEMO-then-PILOT sequencing.

### Repository areas affected

- apps/web/src/app/actions/organization/roles.ts (assignRoleToUserAction/removeRoleFromUserAction)
- Live RLS policies "V2 assign roles"/"V2 delete role assignments" on user_role_assignments (new migration)
- accept_invitation_and_join_org RPC (new migration — add an owner-grant authorization re-check)
- OrgMembersService.removeMember (organization.service.ts)
- A DB-level mechanism for ownerCount >= 1 — TO VERIFY DURING PHASE: trigger vs. deferred constraint vs. transactional application-layer check; the existing is_org_owner() RPC may be reusable.

### Supabase changes

Migration (RLS policy update to special-case org_owner role assignment/revocation), RPC changes (accept_invitation_and_join_org re-check; possibly a new trigger or constraint for last-owner enforcement).

### Existing infrastructure reused

is_org_owner() RPC (currently orphaned from role-management — this phase is the natural place to actually wire it in).

### Implementation tasks

- [ ] Add an owner-only check to the org_owner grant path (RLS and/or RPC layer — TO VERIFY DURING PHASE).
- [ ] Add the same to the revoke path.
- [ ] Add owner-count check to OrgMembersService.removeMember when the target holds org_owner.
- [ ] Add owner-count check to the revoke path.
- [ ] Add an authorization re-check to accept_invitation_and_join_org for any org_owner role assignment being accepted.
- [ ] Add a last-owner DB-level enforcement mechanism.
- [ ] Add a self-demotion UI warning.
- [ ] pgTAP tests: owner-only grant/revoke, last-owner rejection on removal/revocation/self-demotion, invitation-path owner-grant rejection.

### Testing requirements

pgTAP (live-DB), Vitest for any new action-layer logic, manual UAT (Phase I).

### Acceptance criteria

1. A members.manage-only (non-owner) actor cannot grant or revoke org_owner, at any layer (app, RLS).
2. An invitation carrying an org_owner role assignment is rejected at acceptance unless the original inviter was themselves an owner.
3. Removing/revoking the last owner is rejected server-side, with evidence it cannot be bypassed by a direct RPC/RLS-level call.
4. Self-demotion of the last owner is rejected; self-demotion of a non-last owner succeeds with a UI warning shown first.

### Out of scope

Anti-escalation for non-owner roles (Phase B). Invitation one-org re-validation (Phase C).

### Blocker rule

Standard.

## PILOT Phase B — Anti-escalation / role administration

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

Role creation, role editing, and role assignment (org and branch scope) all compare the requested grant against the acting user's own compiled effective permissions before persisting — closing the confirmed "any members.manage holder can grant themselves or others broader permissions than they hold" vulnerability.

### Why it exists

3 confirmed vulnerabilities, all sharing the same root cause (no actor-vs-grant comparison anywhere in role management).

### Dependencies

Phase 0. Logically related to Phase A but kept separate since Phase A is specifically about the org_owner special case while this phase is about the general N-role escalation problem.

### Repository areas affected

- apps/web/src/app/actions/organization/roles.ts (createRoleAction, updateRoleAction, assignRoleToUserAction)
- OrgRolesService.setRolePermissions / equivalent (organization.service.ts)
- Live RLS policies roles_insert_permission, roles_update_permission, role_permissions_insert_permission, "V2 assign roles" (new migrations)

### Supabase changes

Migration (RLS policy updates); possibly a new DB function comparing a proposed permission set against the actor's own compiled user_effective_permissions.

### Existing infrastructure reused

user_effective_permissions/compile_user_permissions (already correct, read from — not rewritten).

### Implementation tasks

- [ ] Design the actor-vs-grant comparison mechanism (a DB function callable from both RLS and RPC contexts is likely cleanest — TO VERIFY DURING PHASE).
- [ ] Apply it to role creation.
- [ ] Apply it to role editing.
- [ ] Apply it to role assignment, org scope.
- [ ] Apply it to role assignment, branch scope (respecting the already-correct branch-scope containment).
- [ ] pgTAP tests for all 4 paths, both self-target and other-target.

### Testing requirements

pgTAP, Vitest, manual UAT (Phase I).

### Acceptance criteria

1. An actor holding only members.manage cannot create a role containing a permission they don't themselves hold.
2. An actor cannot assign a role (to self or other) whose permission set exceeds their own.
3. Branch-scope containment (already correct) remains unaffected — a regression test confirms this.
4. org_owner grant/revoke (Phase A's own scope) is unaffected by this phase's changes.

### Out of scope

org_owner-specific handling (Phase A already covers this narrower case).

### Blocker rule

Standard.

## PILOT Phase C — Invitation + one-org invariant

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

Invitation acceptance re-validates the one-organization-per-user invariant (defense-in-depth, matching the already-working creation-time check); the invariant is additionally enforced at the DB level, not app-level-only.

### Why it exists

Confirmed gap: accept_invitation_and_join_org never re-checks; confirmed gap: no DB constraint prevents a user from belonging to 2 orgs.

### Dependencies

Phase 0. Independent of Phases A/B.

### Repository areas affected

- accept_invitation_and_join_org RPC (new migration — add the re-check, reusing check_invitation_eligibility's own logic)
- A DB-level one-org enforcement mechanism (unique index or trigger — TO VERIFY DURING PHASE)

### Supabase changes

Migration (RPC update + new constraint/trigger).

### Existing infrastructure reused

check_invitation_eligibility()'s own ALREADY_IN_ORG logic (already correct at creation time — reused, not rewritten, at acceptance time).

### Implementation tasks

- [ ] Add a re-check of check_invitation_eligibility (or equivalent) inside accept_invitation_and_join_org, before the membership upsert.
- [ ] Design and add DB-level one-org enforcement.
- [ ] pgTAP tests: the exact race condition (invite to org A, join org B, then attempt to accept org A's invite) is now rejected.

### Testing requirements

pgTAP (live-DB, race-condition-shaped test), manual UAT (Phase I).

### Acceptance criteria

1. Accepting an invitation to org A while already an active member of org B is rejected.
2. A direct INSERT INTO organization_members creating a second active org for an existing user is rejected at the DB level.
3. The existing, correct creation-time check remains unaffected (regression test).

### Out of scope

Any change to the invitation UI/UX beyond what's needed to surface the new rejection case gracefully.

### Blocker rule

Standard.

## PILOT Phase D — Branch RLS hardening

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

wdd*matcher*\* and helpdesk_tickets (if Help Desk is in pilot scope) get FORCE RLS and genuine branch-scoped policies, closing the confirmed "any org member can read/act on another branch's session/ticket" gap.

### Why it exists

Both confirmed live today: RLS enabled but NOT forced, org-scoped only despite live branch_id columns.

### Dependencies

Phase E is related (schema source-of-truth) but not a hard dependency.

### Repository areas affected

New migrations only — no application code expected to change if the existing app-layer code already correctly derives activeBranchId (TO VERIFY DURING PHASE specifically for Matcher and Help Desk's own action layers — Help Desk's own actions never reference activeBranchId at all today, which may be intentional or may need reconsideration).

### Supabase changes

Migration (RLS policy rewrite + FORCE RLS on both table groups).

### Existing infrastructure reused

The already-correct warehouse_locations FORCE-RLS pattern as the template.

### Implementation tasks

- [ ] Product decision: confirm Help Desk should genuinely become branch-scoped (today it's deliberately org-wide with an optional manual branch filter — this may be correct by design).
- [ ] Write new RLS policies for wdd*matcher*\* requiring branch-permission match, not just org-permission.
- [ ] FORCE ROW LEVEL SECURITY on all 4 Matcher tables.
- [ ] If Help Desk is confirmed in scope: same treatment for helpdesk_tickets.
- [ ] pgTAP live-DB RLS tests: cross-branch read/write denial for both table groups.

### Testing requirements

pgTAP (live-DB RLS), manual UAT (Phase I).

### Acceptance criteria

1. A user without access to Branch B cannot read/write Branch B's Matcher sessions, even with a valid org-level Matcher permission.
2. Same for Help Desk tickets, IF confirmed in scope.
3. FORCE ROW LEVEL SECURITY is set on all affected tables, live-verified.

### Out of scope

Any other table's RLS not named here.

### Blocker rule

If the Help Desk branch-scoping product decision cannot be resolved from existing documentation, STOP and report it as a genuine open product decision.

## PILOT Phase E — Schema source-of-truth reconciliation

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

warehouse*locations, wdd_matcher*\*, app_attachments get their CREATE TABLE migrations authored into the authoritative target tree (reconstructed from live schema). qr_codes/qr_assignments get a from-scratch reconstruction since no source exists anywhere.

### Why it exists

The authoritative tree is missing source for 4 confirmed live tables, and has NO source at all (in either tree) for 2 more.

### Dependencies

Phase 0. Should ideally precede or run alongside Phase D — TO VERIFY DURING PHASE which sequencing is cleaner.

### Repository areas affected

New migration files only, in apps/web/supabase-target/supabase/migrations. (The apps/web/CLAUDE.md stale project-ref fix originally planned for this phase was moved to and completed in Phase 1 on 2026-09-24, once implementation began — see that phase's own task list. This phase's own schema-reconciliation scope below is unaffected by that move.)

### Supabase changes

New migrations (schema reconstruction, applied idempotently against the ALREADY-LIVE schema).

### Existing infrastructure reused

The exact reconstruction methodology already proven in this project's own Inventory Core IC-8 work.

### Implementation tasks

- [ ] Reconstruct warehouse_locations's CREATE TABLE + RLS from live schema, as a new migration in the target tree.
- [ ] Reconstruct all 4 wdd*matcher*\* tables' CREATE TABLE + RLS, same approach.
- [ ] Reconstruct app_attachments's CREATE TABLE + RLS, same approach.
- [ ] Reconstruct qr_codes/qr_assignments from scratch (no source anywhere) — pure information_schema/pg_catalog reverse-engineering, explicitly disclosed as such.
- [ ] Cross-verify every reconstructed migration replays cleanly, without claiming to resolve the BROADER clean-room reproducibility gap Inventory Core already found and deferred.

(The task "fix apps/web/CLAUDE.md's stale project-ref instruction," originally listed here, was moved to and completed in Phase 1 on 2026-09-24 once implementation began — removed from this list; this phase now has 5 implementation tasks, not 6. See Phase 1's own task list for the completed item.)

### Testing requirements

Live schema diff/comparison; no new Vitest/pgTAP expected since no application behavior changes.

### Acceptance criteria

1. All 6 tables have a reviewable CREATE TABLE + RLS migration in the authoritative target tree.
2. This work does not claim to resolve Inventory Core's own separately-accepted, broader clean-room reproducibility gap.

(The original acceptance criterion 2 — apps/web/CLAUDE.md correctly references the live target project ref — was met early, in Phase 1 on 2026-09-24, and is no longer this phase's own criterion to satisfy.)

### Out of scope

The broader clean-room reproducibility reconciliation (Inventory Core's own accepted, deferred debt).

### Blocker rule

If exact historical reconstruction cannot be proven for any of these 6 tables, report that specific table as blocked rather than fabricating a plausible-but-unproven definition.

## PILOT Phase F — Unsaved-work / navigation safety

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

A shared, reusable "is this form dirty" mechanism exists and is wired into the branch-switch handler (confirm-before-switch if dirty), closing the gap found in the Movement Editor and RepairOrder creation form.

### Why it exists

Confirmed absent as a shared mechanism; real risk for real multi-tasking pilot users, even though low-risk for this week's rehearsed demo.

### Dependencies

Phase 1 (the branch-switch handler this hooks into).

### Repository areas affected

- New shared hook, e.g. apps/web/src/hooks/use-unsaved-work-guard.ts — TO VERIFY DURING PHASE.
- sidebar-branch-switcher.tsx (wire the confirm check in).
- Movement Editor and RepairOrder creation form, as the first 2 consumers.

### Supabase changes

NONE.

### Existing infrastructure reused

The one existing local pattern (Warehouse Map editor's own isDirty flag) as a reference shape, generalized into a shared mechanism.

### Implementation tasks

- [ ] Design the shared dirty-state-registry mechanism.
- [ ] Wire it into SidebarBranchSwitcher.
- [ ] Wire the Movement Editor into it.
- [ ] Wire the RepairOrder creation form into it.
- [ ] (Optional stretch) a generic beforeunload guard for hard navigation/tab-close.

### Testing requirements

Component tests for the new hook; manual UAT (Phase I).

### Acceptance criteria

1. A dirty Movement Editor blocks a branch switch with a confirm dialog.
2. A dirty RepairOrder creation form does the same.
3. A non-dirty form does not block the switch (no false positives).

### Out of scope

Generalizing to every form in the app.

### Blocker rule

Standard.

## PILOT Phase G — Live security/integration test infrastructure

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

organization-rls-integration.test.ts (and any new live-DB RLS tests added by Phases A-D) actually run under the project's own documented test command, closing the confirmed env-loading gap.

### Why it exists

Confirmed: the one existing live-DB RLS integration test file is structurally skipped today because .env.local values aren't loaded into process.env by plain vitest.

### Dependencies

Phase 0. Should ideally land before or alongside Phases A-D's own pgTAP work.

### Repository areas affected

- apps/web/vitest.config.ts (add env loading)
- CI configuration if the fix needs to extend there too — TO VERIFY DURING PHASE

### Supabase changes

NONE.

### Existing infrastructure reused

The existing organization-rls-integration.test.ts file itself.

### Implementation tasks

- [ ] Add env-loading to vitest.config.ts so .env.local values populate process.env under pnpm test:run.
- [ ] Confirm organization-rls-integration.test.ts's 4 tests actually run and pass.
- [ ] Confirm CI runs this file too.
- [ ] Extend this same infrastructure to cover the new live-DB RLS tests added by Phases A/C/D.

### Testing requirements

This phase IS test-infrastructure work.

### Acceptance criteria

1. organization-rls-integration.test.ts runs (not skipped) and passes under pnpm test:run.
2. The same is true in CI.
3. No unintended side effect on other test files' env handling.

### Out of scope

Fixing the unrelated nuqs/parseAsJson crash.

### Blocker rule

Standard.

## PILOT Phase H — Administrative auditability

### Status

NOT STARTED

### Scope classification

PILOT

### Objective

Sensitive admin actions (role change, branch reassignment, invitation creation, owner grant/revoke) are recorded in an auditable trail.

### Why it exists

Zone 1's own accepted architecture implication that sensitive administrative changes should be recorded for later investigation — currently absent.

### Dependencies

Phase 0. Naturally sequenced after Phases A/B.

### Repository areas affected

- The same action files touched by Phases A/B (roles.ts, invitations.ts, members.ts) — add audit-log emission.
- Likely reuses the existing platform_events/eventService.emit() pattern — TO VERIFY DURING PHASE whether that fits admin-security events or a dedicated table is warranted.

### Supabase changes

Possibly a new migration if a dedicated audit table/view is chosen.

### Existing infrastructure reused

platform_events/eventService.emit(), if confirmed as the right fit.

### Implementation tasks

- [ ] Decide the audit-storage mechanism.
- [ ] Add audit emission to role assignment/revocation.
- [ ] Add audit emission to owner grant/revoke.
- [ ] Add audit emission to branch access reassignment.
- [ ] Add audit emission to invitation creation.
- [ ] A minimal admin-facing view/query to read the trail — TO VERIFY DURING PHASE whether UI is needed or write-side is sufficient.

### Testing requirements

Unit/service tests confirming each named action emits the expected audit event; manual UAT (Phase I).

### Acceptance criteria

1. Each of the 4 named sensitive action types produces a recorded audit entry when performed.
2. The entry includes actor, target, action, and timestamp at minimum.

### Out of scope

A full audit-log browsing UI (write-side only, unless evidence during the phase shows the read-side is trivially small enough to include).

### Blocker rule

Standard.

## PILOT Phase I — PILOT READY manual verification

### Status

NOT STARTED

### Scope classification

PILOT gate

### Objective

Execute Zone 1's own "Gate to PILOT READY" checklist with representative pilot roles on real/representative data, recording evidence exactly as Phase 8 did for DEMO READY.

### Why it exists

Mirrors Phase 8's own discipline — pilot readiness requires manual verification beyond automated tests, extended to the pilot-grade scenario set (last-owner negative test, self-demotion, privilege-escalation matrix subset, concurrent role/branch mutation, representative multi-role E2E).

### Dependencies

Phases A-H (all must be complete and green).

### Repository areas affected

None (verification only, same pattern as Phase 8).

### Supabase changes

NONE.

### Existing infrastructure reused

N/A.

### Implementation tasks

- [ ] Execute Zone 1's own "Gate to PILOT READY" checklist in full.
- [ ] Include the last-owner negative test (deliberately deferred from Phase 8).
- [ ] Include a representative multi-role pilot E2E (owner/manager/warehouse-worker/advisor-equivalent accounts).
- [ ] Record date/build/environment/accounts/scenario/result for every item.

### Testing requirements

Manual only, by design.

### Acceptance criteria

Every item in Zone 1's own Gate to PILOT READY checklist is checked with recorded evidence.

### Out of scope

N/A — this is the final gate.

### Blocker rule

Same as Phase 8 — fix-and-re-run-from-the-top on any failure caused by a Phases A-H regression; STOP-and-report on any genuine new architecture question.

### Only after this phase passes may Zone 1 be marked PILOT READY.
