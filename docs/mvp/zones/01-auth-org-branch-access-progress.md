# Zone 1 — Identity / Access / Branch / Authorization Progress Tracker

> **Live execution tracker.** This file records CURRENT execution state only — phase statuses, evidence, blockers, discoveries, task counts. It does not own product/architecture decisions (see `01-auth-org-branch-access.md`) or phase design/task definitions (see `01-auth-org-branch-access-implementation-plan.md`). Update this file as work happens; do not let it drift from the plan's own checkbox counts.

- **Zone:** 1
- **Priority:** P0
- **Architecture:** APPROVED
- **Runtime status:** PARTIAL / IMPLEMENTATION IN PROGRESS
- **Current phase:** Phase 3 DONE (2026-09-24) — Phase 4 — Matcher branch-aware query key is next (not started)
- **Pitch readiness:** NOT YET
- **Pilot readiness:** NOT READY
- **Last updated:** 2026-09-24

---

## Mechanical task counts

Computed directly from checkbox counts in `01-auth-org-branch-access-implementation-plan.md`. Recompute whenever a phase's task list changes.

- **Total implementation tasks (DEMO + PILOT): 24/95**
- **Pitch-required tasks (Phases 0-8): 24/49**
- **Pilot-required tasks (Phases A-I): 0/46**

Breakdown by phase (task count = number of checkboxes in that phase's "Implementation tasks" section in the plan, recomputed by direct grep against the plan file, not estimated). Phase 1 gained a 6th task (the CLAUDE.md fix, moved in from Phase E) on 2026-09-24; Phase E's own count dropped to 5 accordingly. Phases 2 and 3 completed 2026-09-24 — see the change log for all three.

| Phase     | Task count | Completed |
| --------- | ---------- | --------- |
| 0         | 9          | 9         |
| 1         | 6          | 6         |
| 2         | 4          | 4         |
| 3         | 5          | 5         |
| 4         | 4          | 0         |
| 5         | 4          | 0         |
| 6         | 6          | 0         |
| 7         | 6          | 0         |
| 8         | 5          | 0         |
| A         | 8          | 0         |
| B         | 6          | 0         |
| C         | 3          | 0         |
| D         | 5          | 0         |
| E         | 5          | 0         |
| F         | 5          | 0         |
| G         | 4          | 0         |
| H         | 6          | 0         |
| I         | 4          | 0         |
| **Total** | **95**     | **24**    |

---

## Phase tracker table

| Phase                               | Status               | Pitch/Pilot        | Completed | Notes                                                                                             |
| ----------------------------------- | -------------------- | ------------------ | --------- | ------------------------------------------------------------------------------------------------- |
| 0 — Implementation baseline         | DONE (2026-09-23)    | PITCH prerequisite | 9/9       | Satisfied entirely by the pre-implementation verification bundle, committed at `5dfce9d3`.        |
| 1 — Centralized branch transition   | ✅ DONE (2026-09-24) | PITCH              | 6/6       | Root-cause fix for the branch-switch bug, landed. See "Phase 1 — detailed tracking" below.        |
| 2 — DataView/query-key foundation   | ✅ DONE (2026-09-24) | PITCH              | 4/4       | Foundation only — no consumer migrated. See "Phase 2 — detailed tracking" below.                  |
| 3 — Migrate DataView consumers      | ✅ DONE (2026-09-24) | PITCH              | 5/5       | All 4 confirmed consumers wired. See "Phase 3 — detailed tracking" below.                         |
| 4 — Matcher query key               | NOT STARTED          | PITCH              | 0/4       | Independent of Phases 1-3.                                                                        |
| 5 — Branch-state re-sweep           | NOT STARTED          | PITCH gate         | 0/4       | Depends on Phases 1-4.                                                                            |
| 6 — Cross-branch QR/deep-link       | NOT STARTED          | PITCH              | 0/6       | Depends on Phase 1.                                                                               |
| 7 — Automated closeout              | NOT STARTED          | PITCH gate         | 0/6       | Depends on Phases 1-6.                                                                            |
| 8 — Manual DEMO READY UAT           | NOT STARTED          | PITCH gate         | 0/5       | Depends on Phases 1-7. Only after this: 🔵 DEMO READY.                                            |
| A — Ownership invariants            | NOT STARTED          | PILOT              | 0/8       | Not scheduled this week.                                                                          |
| B — Anti-escalation                 | NOT STARTED          | PILOT              | 0/6       | Not scheduled this week.                                                                          |
| C — Invitation + one-org invariant  | NOT STARTED          | PILOT              | 0/3       | Not scheduled this week.                                                                          |
| D — Branch RLS hardening            | NOT STARTED          | PILOT              | 0/5       | Not scheduled this week.                                                                          |
| E — Schema reconciliation           | NOT STARTED          | PILOT              | 0/6       | Not scheduled this week. CLAUDE.md project-ref fix moved out — completed in Phase 1 (2026-09-24). |
| F — Unsaved-work safety             | NOT STARTED          | PILOT              | 0/5       | Not scheduled this week.                                                                          |
| G — Live test infrastructure        | NOT STARTED          | PILOT              | 0/4       | Not scheduled this week.                                                                          |
| H — Administrative auditability     | NOT STARTED          | PILOT              | 0/6       | Not scheduled this week.                                                                          |
| I — PILOT READY manual verification | NOT STARTED          | PILOT gate         | 0/4       | Depends on Phases A-H. Only after this: 🟢 PILOT READY.                                           |

---

## Phase 1 — detailed tracking

Copied from the implementation plan's own task list when the phase started (2026-09-24), per the tracker's own "current/started phase gets full detail" rule. Phase completed same day.

- [x] Determine the safe start route to redirect to after a switch.
  - Evidence: Selected `/dashboard/start` — a static page with zero data fetching or branch-bound dynamic segments (`apps/web/src/app/[locale]/dashboard/start/page.tsx`), already used elsewhere in the codebase as the canonical "go home" destination (`components/v2/layout/quick-switcher.tsx`'s own default "Go to dashboard home" action). Satisfies every constraint in the task spec: exists today, valid for normal authenticated users, no object-ID dependency, cannot 404 under any branch context, no new page created.
- [x] Add `router.refresh()` call to `handleBranchSelect` after a successful `changeBranch()` call.
  - Evidence: `sidebar-branch-switcher.tsx:70`. Uses `useRouter` from `@/i18n/navigation` (the codebase's locale-aware wrapper), matching the import pattern already used by sibling dashboard components (`sidebar-org-header.tsx`, `dashboard-shell.tsx`, `quick-switcher.tsx`).
- [x] Add navigation to the safe start route after a successful switch.
  - Evidence: `sidebar-branch-switcher.tsx:69`, `router.replace(SAFE_ROUTE_AFTER_BRANCH_SWITCH)`. Used `replace` (not `push`) deliberately — a branch switch invalidates the previous route as a valid back-button target (going back would just re-surface the same stale-branch-object problem this phase closes), so no history entry should be kept for it, per the task's own "avoid unnecessary history entries" instruction. Ordering (`replace` before `refresh`) matches the one existing precedent for this exact pattern in the codebase (`inventory-movement-new-client.tsx:269-270`), and avoids briefly re-rendering the old, soon-to-be-abandoned branch-bound route before navigating away.
- [x] Confirm the toast/loading state UX is not broken by the added navigation.
  - Evidence: reviewed by inspection — `isPending`/`startTransition` (disables the switcher's buttons during the async operation) and the `toast.success`/`toast.error` calls are unchanged in structure; `router.replace`/`router.refresh` are synchronous calls scheduled inside the same `startTransition` callback and do not block or delay the toast, which is rendered via `react-toastify`'s own global portal (unaffected by client-side navigation within the same app tree).
- [x] Update `sidebar-branch-switcher.test.tsx` to assert `router.refresh()`/navigation is called on success.
  - Evidence: `sidebar-branch-switcher.test.tsx` — added a `useRouter` mock (`@/i18n/navigation`) and 3 new/updated tests: successful switch asserts `replace("/dashboard/start")` + `refresh()`; a dedicated ordering test proves `replace` is invoked before `refresh` via `mock.invocationCallOrder`; failure test asserts zero navigation/refresh/state-change occurred. Also added a same-branch no-op test (pre-existing behavior, now explicitly covered).
- [x] (Added 2026-09-24, moved from PILOT Phase E) Fix `apps/web/CLAUDE.md`'s stale project-ref instruction.
  - Evidence: `apps/web/CLAUDE.md:19` now reads `rjeraydumwechpjjzrus` and names the authoritative migration tree (`apps/web/supabase-target/supabase/migrations`), replacing the stale legacy ref (`zlcnlalwfmmtusigeuyk`). No other line in `CLAUDE.md` touched.

**Tests:** `sidebar-branch-switcher.test.tsx` — 5/5 pass. Regression suite (`changeBranch.test.ts`, `permissions-sync.test.tsx`, `use-branch-permissions-query.test.tsx`, `load-dashboard-context.v2.test.ts`, `load-app-context.v2.test.ts`) — 54/55 pass; the 1 failure is the pre-existing, already-documented `load-app-context.v2.test.ts` fixture-drift failure (BLOCKER-Z1-005, owned by Phase 7 — unrelated file, not touched by this phase). `pnpm type-check`: clean. `pnpm eslint` on both touched files: 0 errors/warnings.

**Blocker:** none. Phase 1 completed with no BLOCKED state and no architecture question raised.

---

## Phase 2 — detailed tracking

Copied from the implementation plan's own task list when the phase started (2026-09-24), per the tracker's own "current/started phase gets full detail" rule. Phase completed same day. Note (2026-09-24, correction): Phase 1's own checkboxes were left unchecked in the implementation plan when Phase 1 was first marked DONE earlier this session — this tracker's own summary numbers were briefly stated from memory rather than the plan's actual checkbox state, contrary to this tracker's own "never estimate" rule. Corrected before Phase 2's own count was computed; the plan's Phase 1 checkboxes are now marked `[x]` to match reality, and all counts above are freshly recomputed by direct grep against the plan file.

- [x] Add an optional branchId field to DataViewListParams.
  - Evidence: **deviated from the literal plan wording — corrected, not implemented as originally written.** Inspection of `use-data-view-query.ts` showed `DataViewListParams` is passed directly to every `listFetcher(listParams)` call — i.e. it IS the server request payload, not purely cache-key material. Adding `branchId` there would have leaked it into request payloads, violating the explicit "query key and server request payload are separate concerns" requirement. Instead, `branchId?: string | null` was added to `UseDataViewListQueryOptions` and `UseDataViewSidebarInfiniteQueryOptions` directly (the hook-options layer), merged into the query key via a new pure helper. `DataViewListParams` itself (`src/lib/data-view/types.ts`) was left untouched. See the implementation plan's own updated Phase 2 task list and `docs/mvp/reviews/zone1-phase2-dataview-foundation-2026-09-24/query-key-contract.md` for the full contract and rationale.
- [x] Update use-data-view-query.ts's own key-building logic to merge branchId into the query key when present, leaving it unaffected when absent (backward-compatible for org-scoped screens).
  - Evidence: `apps/web/src/components/data-view/use-data-view-query.ts` — new exported `buildDataViewQueryKey(baseKey, branchId)`; used inside `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery`. `useDataViewDetailQuery` deliberately left untouched (detail is keyed by a presumably-globally-unique `selectedId`, matching the already-verified-safe pattern for Matcher's `results`/`extractedData` keys — no confirmed bug involves a detail query).
- [x] Write a unit test for the key-building function: same params + different branchId => different key; branchId absent => unchanged from today's behavior.
  - Evidence: new file `apps/web/src/components/data-view/__tests__/use-data-view-query.test.ts` — 9 tests: 6 direct contract tests on `buildDataViewQueryKey` (append, differs-by-branch, stable-for-same-branch, omits-on-undefined, omits-on-null identically to undefined, does-not-mutate-input) + 3 integration tests via `renderHook` (different branchId → 2 distinct cache entries for identical params; branchId never forwarded to `listFetcher`'s request payload; omitted branchId reproduces the exact pre-Phase-2 key shape).
- [x] Spot-check 1-2 correctly org-scoped DataView screens (e.g. Tickets) to confirm they are unaffected.
  - Evidence: inspected `roles-client.tsx` (`ROLES_DV_KEY`) and `tasks-client.tsx` (`PLANNING_TASKS_QUERY_KEY`) — both pass a static `queryKey` with no `branchId`; since neither consumer nor `DataView`/`DataViewProvider` was touched, they cannot be affected by this phase's change at all (the new parameter isn't even reachable from their call sites yet). Full regression: `data-view.test.tsx` (38 pre-existing tests covering the `DataView` component end-to-end using a `["test-products"]`-style org-scoped key) — 38/38 pass, unmodified.

**Tests:** `use-data-view-query.test.ts` — 9/9 pass. `data-view.test.tsx` (regression) — 38/38 pass, unmodified. `pnpm type-check`: clean. `eslint` on both touched files: 0 errors/warnings.

**Blocker:** none. Phase 2 completed with no BLOCKED state; one factual planning-detail correction was needed and is recorded above and in the implementation plan (per Section 18's own "update only the factual detail, preserve history" rule) — not a redesign, not an architecture change.

---

## Phase 3 — detailed tracking

Copied from the implementation plan's own task list when the phase started (2026-09-24), per the tracker's own "current/started phase gets full detail" rule. Phase completed same day.

- [x] Locations: read live activeBranchId from useAppStoreV2, pass into the DataView's queryKey.
  - Evidence: `locations-data-view.tsx` — added `const activeBranchId = useAppStoreV2((s) => s.activeBranchId);`, passed as `branchId={activeBranchId}` to `<DataView queryKey={["locations"]} branchId={activeBranchId} ...>`. Required new plumbing: `branchId?: string | null` added to `DataViewProps` (`src/lib/data-view/types.ts`), threaded through `DataView` (`data-view.tsx`) and `DataViewProvider` (`data-view-provider.tsx`) into both `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery`. Fully optional/additive — no existing prop removed or renamed.
- [x] Inventory Balances: same.
  - Evidence: `inventory-client.tsx` — identical pattern, `branchId={activeBranchId}` on `<DataView queryKey={["inventory-balances"]} ...>`.
- [x] Inventory Movements: same, plus corrected activeBranchId source for the DataView's own key.
  - Evidence: `inventory-movements-client.tsx` — added a NEW live-read local (`liveActiveBranchId`, via `useAppStoreV2`), used for `<DataView branchId={liveActiveBranchId}>`. The pre-existing `activeBranchId` PROP (frozen SSR value) is left completely unchanged, still forwarded to `InventoryMovementDetailPanel` — verified by a dedicated test asserting both values independently.
- [x] Inventory Products: same (branchId threaded as a separate prop, not baked into the base queryKey constant — see the plan's own factual correction).
  - Evidence: `inventory-products-client.tsx` — `INVENTORY_PRODUCTS_QUERY_KEY` constant untouched; `branchId={activeBranchId}` added as a new, separate prop to `<DataView queryKey={INVENTORY_PRODUCTS_QUERY_KEY} branchId={activeBranchId} ...>`.
- [x] For each of the 4: verify switching branches produces a different query key.
  - Evidence: 4 new consumer-wiring test files (one per consumer, `*.branch-wiring.test.tsx`), each proving the consumer forwards the live store's `activeBranchId` into `DataView`'s `branchId` prop, and that a different active branch produces a different forwarded value. Plus a new generic `T-DV-BRANCH` block in `data-view.test.tsx` proving the underlying plumbing itself (`branchId` prop → list query AND sidebar query, both reachable; a branchId change on an already-mounted `DataView` triggers an immediate additional fetch, proving the cache key genuinely changed, not just a staleness re-check).

**Plumbing added (not originally itemized as a separate checkbox, but required — see plan's own Section 4 in the task prompt "Phase 3 now owns that consumer-facing plumbing if required"):** `DataViewProps.branchId` (types.ts) → `DataView` (data-view.tsx) → `DataViewProvider` (data-view-provider.tsx) → `useDataViewListQuery`/`useDataViewSidebarInfiniteQuery` (already accepted `branchId` since Phase 2). The generic `DataView` internals still never read `useAppStoreV2()` or any global store directly — `branchId` is always explicit, passed in from each concrete consumer. The `refreshToken`-based invalidation effect in `DataViewProvider` was left unchanged (uses the raw, un-branched `queryKey` prop) — React Query's default prefix-matching invalidation (`exact: false`) already correctly matches the new, longer, branch-scoped keys without needing to be branch-aware itself.

**Mutation invalidation review (see `docs/mvp/reviews/zone1-phase3-dataview-consumers-2026-09-24/mutation-invalidation-review.md` for full detail):** none of the 4 consumer files contain any `invalidateQueries`/`useQueryClient`/`refreshToken` usage today — confirmed by grep across all 4 files and their sibling detail-panel components. Classification: "no relevant mutation-invalidation logic exists to become incompatible" for all 4. One pre-existing gap was discovered and explicitly NOT fixed (out of this phase's scope): `inventory-client.tsx`'s stock receive/issue/transfer/adjust mutations do not invalidate or refresh the balances list at all today — a pre-existing UX gap unrelated to branch-awareness, not introduced or worsened by this phase.

**Tests:** 4 new consumer-wiring test files (9 tests total) — all pass. Generic `data-view.test.tsx` — 42/42 pass (38 pre-existing + 4 new `T-DV-BRANCH` tests). Phase 2's own `use-data-view-query.test.ts` — 12/12 pass (regression, unmodified). `pnpm type-check`: clean. `eslint` across all touched files: 0 errors, 4 pre-existing warnings (confirmed via a stash/diff comparison — identical line offsets before this phase's changes).

**Blocker:** none. Phase 3 completed with no BLOCKED state. One factual correction to the plan's task wording was needed (branchId threads as a separate prop per the Phase 2 contract, not concatenated into the base queryKey array) and one file-path correction (`inventory-products-client.tsx` actually lives under `warehouse/items/_components/`, not `warehouse/inventory/_components/`) — both recorded in the implementation plan with history preserved, not silently redesigned.

---

## Active blockers

Stable IDs, once assigned, are never reused. None of the items below block Phase 1 (the next phase to implement) from starting — they are recorded so they are not forgotten, per the task's own explicit instruction not to let known gaps disappear from view after the presentation.

### PITCH implementation gaps (block DEMO READY, not yet started)

- **BLOCKER-Z1-001** — Branch switch performs no `router.refresh()`/navigation/cache invalidation (`SidebarBranchSwitcher.handleBranchSelect`). Owner: Phase 1. Status: **RESOLVED (2026-09-24)** — see Phase 1 detailed tracking above.
- **BLOCKER-Z1-002** — 4 confirmed consumers (Locations, Inventory Balances, Inventory Movements, Inventory Products) have branch-agnostic cache keys. Owner: Phases 2-3. Status: **RESOLVED (2026-09-24)** — all 4 consumers now pass a live `branchId` into `<DataView>`, verified by dedicated consumer-wiring tests. See Phase 3 detailed tracking above.
- **BLOCKER-Z1-003** — `wddMatcherKeys.sessions()` is branch-agnostic; zero test coverage exists for this key. Owner: Phase 4. Status: OPEN, not yet started.
- **BLOCKER-Z1-004** — `warehouse.location` QR/deep-link silently drops cross-branch intent instead of confirm-then-switch (safe, not a leak, but a missing UX requirement). Owner: Phase 6. Status: OPEN, not yet started.
- **BLOCKER-Z1-005** — 2 Zone-1-relevant test files carry mock/fixture drift (`organization-rls.test.ts`'s `createBranch` test, `load-app-context.v2.test.ts`'s branch-field fixture). Owner: Phase 7. Status: OPEN, not yet started.

### PILOT security blockers (real vulnerabilities, deliberately deferred past the presentation)

- **BLOCKER-Z1-006** — No owner-only gate on granting/revoking `org_owner`; a second, weaker route exists via invitation acceptance (`accept_invitation_and_join_org` performs zero re-check). Owner: PILOT Phase A. Severity: HIGH. Demo-safe only because current choreography never exercises owner grant/revoke beyond one pre-rehearsed action.
- **BLOCKER-Z1-007** — No `ownerCount >= 1` enforcement at any layer; the last owner of an org can be removed/demoted with no protection. Owner: PILOT Phase A. Severity: HIGH.
- **BLOCKER-Z1-008** — No anti-privilege-escalation check anywhere in role creation/editing/assignment; any `members.manage` holder can grant themselves or others permissions broader than their own (branch-scope containment is the one safe exception). Owner: PILOT Phase B. Severity: HIGH.
- **BLOCKER-Z1-009** — Invitation acceptance does not re-validate the one-org-per-user invariant; the invariant is app-level only, not DB-enforced. Owner: PILOT Phase C. Severity: MEDIUM.
- **BLOCKER-Z1-010** — `wdd_matcher_*` and `helpdesk_tickets` have RLS enabled but NOT forced, org-scoped only despite live `branch_id` columns — any org member can read/act on another branch's Matcher session or Help Desk ticket. Owner: PILOT Phase D. Severity: MEDIUM-HIGH.
- **BLOCKER-Z1-011** — `organization-rls-integration.test.ts` (the only live-DB RLS integration coverage for org membership/roles) is structurally skipped under the project's own test command; likely also skipped in CI. Owner: PILOT Phase G. Severity: MEDIUM (masks confidence, not itself a runtime vulnerability).
- **BLOCKER-Z1-012** — No shared unsaved-work/navigation-guard mechanism; a dirty Movement Editor or RepairOrder creation form can silently lose data on a branch switch. Owner: PILOT Phase F. Severity: LOW-MEDIUM (data-loss risk, not a security hole).
- **BLOCKER-Z1-013** — No administrative auditability for sensitive admin actions (role change, branch reassignment, invitation creation, owner grant/revoke). Owner: PILOT Phase H. Severity: MEDIUM.

### Accepted deferred technical debt (not security-critical, tracked so it isn't lost)

- **BLOCKER-Z1-014** — `warehouse_locations`/`app_attachments` migrations missing from the authoritative target tree (live-correct, paper-trail-only gap). Owner: PILOT Phase E.
- **BLOCKER-Z1-015** — `qr_codes`/`qr_assignments` have no committed migration source in either tree at all; live schema was applied out-of-band. Owner: PILOT Phase E.
- **BLOCKER-Z1-017** — 3 Zone-1-relevant client test suites (`roles-client`, `invitations-client`, `members-client`) crash on load due to an unrelated `nuqs`/`parseAsJson` version mismatch in the shared `data-view-url-state.ts` module — masks their own coverage. Owner: none assigned (explicitly out of Zone 1 scope; flagged for whoever owns the shared `data-view` component).
- **BLOCKER-Z1-018** — `QrTargetDescriptor.validate()`'s JSDoc incorrectly claims `resolvePublicQrToken` runs with an authenticated, RLS-enforced client — it does not (service-role, zero auth check, by design). Stale comment, not a live security issue. Owner: Phase 6 (fixed as part of that phase's own QR work).

### No-longer-blocking findings

- **BLOCKER-Z1-016** (formerly listed under "Accepted deferred technical debt", owner PILOT Phase E) — `apps/web/CLAUDE.md` line 19's stale legacy project ref. **RESOLVED 2026-09-24** — fixed as a small operational-safety correction bundled into Phase 1 once implementation began, per explicit instruction, rather than waiting for PILOT Phase E. See Phase 1 detailed tracking above and the change log below.

---

## Change log / discoveries

Zone 3 discipline: date, phase, finding, evidence, classification, resolution, whether architecture changed, whether a product-owner decision was needed. Starts with the discoveries already made by the completed pre-implementation verification; does not rewrite that history.

### 2026-09-23 — Pre-implementation verification (Phase 0)

- **Finding:** `apps/web/CLAUDE.md` instructs the wrong Supabase project ref (legacy `zlcnlalwfmmtusigeuyk` instead of live target `rjeraydumwechpjjzrus`). Evidence: `environment-verification.md`. Classification: documentation debt, not a runtime bug. Resolution: assigned to PILOT Phase E (not fixed in Phase 0's own verification pass, per explicit scope instruction). Architecture unaffected. No product-owner decision needed.
- **Finding:** Inventory Products (`inventory-products-client.tsx:42,324`) has the identical branch-agnostic query-key bug as the 3 previously-known instances — a 4th, newly-confirmed instance, found only because the audit re-applied a systematic sweep rather than checking only the already-suspected surfaces. Evidence: `branch-state-cache-inventory.md`. Classification: CONFIRMED BUG, PITCH-relevant. Resolution: assigned to Phase 3. Architecture unaffected (fits the already-accepted branch-keyed query pattern). No product-owner decision needed.
- **Finding:** `qr_codes`/`qr_assignments` have no committed migration source in EITHER migration tree — worse than previously documented (prior belief was "missing from target, present in legacy"). Live `list_migrations` shows 3 applied entries whose filenames exist nowhere in the repository, implying out-of-band schema application. Evidence: `environment-verification.md`. Classification: PILOT schema-integrity gap, not itself a runtime vulnerability (the live tables are RLS-enabled). Resolution: assigned to PILOT Phase E, explicitly requiring from-scratch `information_schema`/`pg_catalog` reconstruction rather than any tree lookup. Architecture unaffected. No product-owner decision needed yet (a decision may be needed later if reconstruction proves impossible for some object — not yet reached).
- **Finding:** `resolvePublicQrToken` performs zero authentication and zero permission check by design (a public, anonymous-safe resolver) — but `QrTargetDescriptor.validate()`'s own JSDoc incorrectly claims it runs with an authenticated, RLS-enforced client. Evidence: `deep-link-qr-verification.md`. Classification: stale/misleading doc comment, not a live security issue (verified: no metadata leak, no unsafe silent switch, cross-org check present). Resolution: assigned to Phase 6 as a small doc-comment correction alongside that phase's own QR work. Architecture unaffected. No product-owner decision needed.
- **Finding:** `organization-rls-integration.test.ts` — the ONLY live-DB RLS integration coverage that exists for org membership/roles — never actually runs under the project's documented `pnpm vitest run` command, because `.env.local` values are never loaded into `process.env` (no dotenv, no `vitest.config.ts` env loading, no CI injection found). Evidence: `test-results.md`. Classification: PILOT test-infrastructure gap; likely also silently skipped in CI. Resolution: assigned to PILOT Phase G. Architecture unaffected. No product-owner decision needed.
- **Finding:** Help Desk's own action layer never references `activeBranchId` at all today, despite `helpdesk_tickets` having a live `branch_id` column and RLS-enabled-but-not-forced org-scoped policies. Evidence: `branch-state-cache-inventory.md`, `environment-verification.md`. Classification: ambiguous — may be intentional (Help Desk deliberately org-wide with optional manual branch filter) or may be an oversight. **Product-owner decision needed before PILOT Phase D can proceed on the Help Desk half of its scope** — explicitly flagged as an open question in that phase's own task list and blocker rule, not resolved here.

### 2026-09-23 — Zone 1 implementation planning pass (this task)

- **Decision:** Re-evaluated `recommended-implementation-pass.md`'s 3-change recommendation and expanded it into 9 DEMO-READY phases (0-8) plus 9 PILOT-READY phases (A-I), per the required A-H topic separation and the "one coherent concern per phase" discipline modeled on Zone 3's 22-phase pattern. Rationale recorded in the phase-boundary analysis (`docs/mvp/reviews/zone1-implementation-planning-2026-09-23/zone1-phase-boundary-analysis.md`). Not a redesign of the underlying fixes themselves — the 3 recommended code changes map onto Phases 1 (branch transition), 2+3+4 (query-key foundation + 4 DataView consumers + Matcher, split from one change into 3 phases because DataView and Matcher are architecturally distinct modules and the 4 DataView consumers share one mechanical fix pattern), and 6 (QR confirm-then-switch). Architecture (the product decisions in `01-auth-org-branch-access.md`) is unaffected — this is purely an execution-sequencing decision. No product-owner decision was needed for this split itself.
- **Decision:** Phase 0 is marked DONE immediately, citing the pre-implementation verification bundle as its own acceptance evidence, following the exact precedent Zone 3's own Phase 0A set (a baseline/reconciliation phase can close on verification evidence alone, without a corresponding code change).

### 2026-09-24 — Phase 1 implementation

- **Finding/fix:** `SidebarBranchSwitcher.handleBranchSelect` closed exactly as designed — added `router.replace("/dashboard/start")` then `router.refresh()` after a server-confirmed `changeBranch()` success, using the codebase's own `useRouter` (`@/i18n/navigation`) and matching the one existing in-codebase precedent for this exact ordering (`inventory-movement-new-client.tsx`). Evidence: `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx`. Classification: CONFIRMED FIX, closes BLOCKER-Z1-001. Architecture unaffected — `changeBranch` itself, authorization, and all "already correct" foundations named in the plan were not touched. No product-owner decision needed.
- **Decision:** Selected `/dashboard/start` as the safe start route (Zone 1 decision 22's "safe start screen"), based on it already being the codebase's own canonical "go home" destination (`quick-switcher.tsx`) and being fully static/branch-neutral (no data fetching, no dynamic segments) — resolved without needing a new product-owner decision, since it was directly derivable from existing code and the architecture doc.
- **Scope correction (not a redesign):** Per explicit instruction, the `apps/web/CLAUDE.md` stale-project-ref housekeeping fix — originally deferred to PILOT Phase E in the 2026-09-23 planning pass — was moved to and completed in Phase 1 instead, since implementation had now begun. PILOT Phase E's own schema-reconciliation scope is unchanged; only this one unrelated housekeeping task moved. Both the implementation plan and this tracker were updated to reflect the new ownership (Phase E's task count: 6→5; Phase 1's task count: 5→6). This mirrors Zone 3's own "SCOPE CORRECTION" banner discipline — recorded here rather than silently editing the original 2026-09-23 planning-pass entry above.
- **No blockers encountered.** No implementation evidence contradicted the accepted architecture; no STOP condition was triggered.
- **Tracker correction:** this tracker briefly stated Phase 1's mechanical task count (6/6, 15/95 total) from memory rather than from the implementation plan's own checkbox state — the plan's Phase 1 checkboxes were left unchecked (`[ ]`) even though the work was done. Caught and corrected before Phase 2's own count was computed. All counts are now freshly recomputed by direct grep against the plan file for both phases, per this tracker's own "never estimate" rule.

### 2026-09-24 — Phase 2 implementation

- **Design decision (evidence-based correction to the plan's literal wording):** `DataViewListParams` was NOT given a `branchId` field, contrary to the plan's original task #1 wording. Inspection of `use-data-view-query.ts` showed this type is passed directly to `listFetcher()` as the request payload, not just used as cache-key material — adding `branchId` there would have leaked it into server requests, violating the phase's own explicit "query key and server request payload are separate concerns" requirement. Instead, `branchId?: string | null` was added to the query hooks' own option types (`UseDataViewListQueryOptions`, `UseDataViewSidebarInfiniteQueryOptions`), merged into the key via a new pure helper `buildDataViewQueryKey`. Evidence: `apps/web/src/components/data-view/use-data-view-query.ts`. Classification: CONFIRMED, evidence-based factual correction to one task's wording — not an architecture change, not a scope change (the phase's own objective, "an optional branchId mechanism any caller CAN use," is met exactly). The plan's Phase 2 task list and acceptance criterion 1 were updated in place with history preserved (strikethrough + note, not deletion). No product-owner decision needed — this was a technical implementation-boundary question, resolvable from the existing code alone.
- **Decision:** `useDataViewDetailQuery` was deliberately left untouched (no `branchId` support added) — detail queries are keyed by a presumably-globally-unique `selectedId`, matching the same "safe because globally unique" pattern already verified for Matcher's `results`/`extractedData` query keys in the pre-implementation audit. No confirmed bug in the gap matrix involves a detail-type query. Adding branchId there would have been speculative scope beyond the evidenced problem.
- **No blockers encountered.** No implementation evidence contradicted the accepted architecture. Zero consumer files, Matcher, or QR code touched — confirmed via `git status` before closing the phase.

### 2026-09-24 — Phase 3 implementation

- **Plumbing decision:** Phase 2 deliberately left `DataViewProps`/`DataView`/`DataViewProvider` untouched, so Phase 3 needed to add the consumer-facing plumbing itself before any of the 4 consumers could actually opt in. Added `branchId?: string | null` to `DataViewProps` (`src/lib/data-view/types.ts`), threaded unchanged through `DataView` and `DataViewProvider` into both `useDataViewListQuery` and `useDataViewSidebarInfiniteQuery` (which already accepted it since Phase 2). Fully additive — no existing prop changed shape or meaning. Evidence: `apps/web/src/lib/data-view/types.ts`, `apps/web/src/components/data-view/data-view.tsx`, `apps/web/src/components/data-view/data-view-provider.tsx`. Classification: CONFIRMED, in-scope plumbing per the task's own explicit instruction ("Phase 3 now owns that consumer-facing plumbing if required"). No product-owner decision needed.
- **Finding/fix:** all 4 confirmed consumers (Locations, Inventory Balances, Inventory Movements, Inventory Products) now read the live `activeBranchId` from `useAppStoreV2` and forward it as `<DataView branchId={...}>`. Evidence: the 4 consumer files, plus 4 new dedicated wiring tests and 4 new generic `T-DV-BRANCH` tests in `data-view.test.tsx`. Classification: CONFIRMED FIX, closes BLOCKER-Z1-002 (all 4 instances). Architecture unaffected — server-side branch authorization/filtering was not touched; `branchId` remains cache-identity-only, verified structurally (no consumer forwards it into any server action or `listFetcher` call) and by Phase 2's own already-passing request-payload-isolation tests, which remain valid since the request-payload code path itself was not touched in Phase 3.
- **Factual correction (evidence-based, not a scope change):** Inventory Products' plan task said "fixing INVENTORY_PRODUCTS_QUERY_KEY ... to include branchId" — implemented instead as `branchId` being a separate, explicit prop alongside the UNCHANGED `INVENTORY_PRODUCTS_QUERY_KEY` constant, per the Phase 2 contract's own explicit rule that branchId must never be concatenated into a consumer's base queryKey array by the consumer itself (that merge happens once, centrally, inside `buildDataViewQueryKey`). Recorded in the plan with history preserved.
- **Factual correction (file path):** `inventory-products-client.tsx` actually lives at `apps/web/src/app/[locale]/dashboard/warehouse/items/_components/`, not `warehouse/inventory/_components/` as the plan originally stated. Verified by direct file lookup before implementation began. Recorded in the plan.
- **Decision:** `InventoryMovementsClient`'s pre-existing `activeBranchId` PROP (a frozen SSR value forwarded to `InventoryMovementDetailPanel`) was deliberately left unchanged — only the DataView's OWN cache-identity source was switched to a new, separate live-read local variable (`liveActiveBranchId`). Fixing the detail panel's own branch-awareness was judged out of this phase's named scope ("InventoryMovementsClient's own activeBranchId prop usage" refers to the list's own query key, not the full prop-forwarding chain) and no evidence in the gap matrix flags the detail panel itself as a confirmed bug. Verified by a dedicated test asserting both values remain independently correct.
- **Mutation invalidation review finding (discovered, explicitly not fixed):** `inventory-client.tsx`'s stock receive/issue/transfer/adjust mutations do not invalidate or refresh the DataView's list at all today — no `invalidateQueries`, no `refreshToken`, no `router.refresh()`. This is a pre-existing UX gap, unrelated to and not worsened by branch-awareness (nothing invalidated the OLD static key either, so nothing became newly incompatible with the NEW branch-scoped key). Not fixed in this phase — recorded here so it isn't silently lost. No other consumer or sibling detail/panel component has any invalidation logic at all (confirmed via grep across all 4 consumer directories).
- **No blockers encountered.** No implementation evidence contradicted the accepted architecture. Zero Matcher or QR code touched, zero DB/schema/RLS changes — confirmed via `git status` before closing the phase.

---

## DEMO READY gate

Not yet reached. Requires Phases 1-8 all DONE, with Phase 8's manual UAT evidence recorded (date, build/commit SHA, environment, accounts, PASS/FAIL per scenario step) directly in this section once it happens. Placeholder — to be filled in when Phase 8 executes:

```
Manual DEMO READY UAT — NOT YET RUN
Date: —
Build/commit: —
Environment: —
Accounts used: —
Result: —
```

## PILOT READY gate

Not yet reached. Requires Phases A-I all DONE, with Phase I's manual verification evidence recorded here once it happens. Placeholder:

```
Manual PILOT READY verification — NOT YET RUN
Date: —
Build/commit: —
Environment: —
Accounts used: —
Result: —
```
