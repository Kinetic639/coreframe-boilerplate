# Zone 3 Phases 4–6 — Corrective Review Context

Verify-first corrective pass over 9 external reviewer findings (A–I) on the
2026-09-11 Phase 4/5/6 implementation bundle
(`docs/mvp/reviews/zone3-phases4-6-review/`). Every finding was independently
re-investigated against live Supabase, the codebase, repository conventions,
and existing tests before any change was made — no finding was implemented
on the reviewer's word alone.

---

## Original review findings A–I

### Finding A — Matcher approval RLS

- **Original hypothesis**: the application requires `wdd_matcher.approve` to approve a session, but the live UPDATE RLS policy on `wdd_matcher_sessions` gates on `wdd_matcher.upload` — a potential DB-layer bypass.
- **Classification: CONFIRMED SECURITY GAP.**
- **Evidence checked**: live `pg_policies` inspection of `wms_update` (`qual: has_permission(organization_id, 'wdd_matcher.upload')`, `with_check: null`); all UPDATE call sites in the app (`WddMatcherService.approveSession`'s own atomic `WHERE status='ready_for_review'` guard); the only trigger on the table (`wdd_matcher_sessions_updated_at`, bookkeeping only — no state-machine constraint); the established precedent for this exact kind of fix (`repair_orders_update`'s prior archive-restriction migration, `20260910074716`); live 4 Matcher permission slugs (`.approve`/`.read`/`.review`/`.upload`, all independent, no implicit coupling).
- **Conclusion**: an upload-only actor (holding `.upload` but not `.approve`) could set `status='approved'` directly via a raw client `.update()`, fully bypassing `approveSessionAction`'s server-side permission check — the DB layer never independently enforced the same approval-authority contract the application layer does.
- **Code changed**: yes — new migration `20260911071854_wdd_matcher_sessions_approval_rls_restriction.sql`.

### Finding B — Materialization status permission/RLS semantics

- **Original hypothesis**: `getMaterializationStatusAction` checks Matcher-read but reads Workshop/RepairOrder tables — rows hidden by Workshop RLS could be misread as "not materialized."
- **Classification: CONFIRMED BUG.**
- **Evidence checked**: live RLS on `workshop_source_documents_select` (`has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read')`) and `repair_order_source_document_links_select` (requires the linked `repair_orders` row to have `deleted_at IS NULL` AND the same `workshop.repair_orders.read` branch permission); confirmed `wdd_matcher.read` and `workshop.repair_orders.read` are structurally independent permission slugs (no shared wildcard); confirmed existing repo precedent for a dual-permission-check pattern (`QrAssignmentsService.listByBranch`'s `qr.read` + `warehouse.locations.read`).
- **Conclusion**: a caller with `wdd_matcher.read` but not `workshop.repair_orders.read` would have every row silently hidden by RLS (not an error), computing `repairOrderIds.size === 0` — indistinguishable from a genuine "not yet materialized" result.
- **Code changed**: yes — added a second permission check (`WORKSHOP_REPAIR_ORDERS_READ`), not a new RPC, per the existing dual-permission convention.

### Finding C — Explicit org/branch scoping

- **Original hypothesis**: several Phase 4–6 paths accept `branchId: string | null` and omit the branch filter when null — possible org-wide leak.
- **Classification: FALSE POSITIVE / ACCEPTABLE CURRENT DESIGN.**
- **Evidence checked**: `resolveActiveBranch(savedBranchId, accessibleBranchIds)` in `packages/domain/src/branch.ts` — returns `null` only when `accessibleBranchIds` is empty (a real, intentional domain state: an org-level user, or a user mid-onboarding), otherwise deterministic; live RLS on the Workshop tables (`has_branch_permission`) independently enforces branch scoping per row regardless of whether the application layer also applies an explicit `.eq("branch_id", …)` filter; `loadDashboardContextV2` behavior; comparable modules that follow the same "explicit filter when known, rely on RLS otherwise" pattern.
- **Conclusion**: a caller with no accessible branch simply sees zero rows via RLS — never a cross-branch/cross-org leak. Nullable branch is a legitimate domain state, not a bug, and every affected path was checked individually rather than assumed.
- **Code changed**: no.

### Finding D — Materialization failure event scope

- **Original hypothesis**: `workshop.repair_orders.materialization_failed` may be emitted without complete organizationId/branchId on one or both code paths.
- **Classification: CONFIRMED.**
- **Evidence checked**: read both emission call sites in `apps/web/src/app/actions/tools/wdd-matcher.ts` (`approveAndMaterializeSessionAction`'s failure branch, `retryMaterializationAction`'s failure branch); compared against the Phase 4 `workshop.matcher_session.approved` event (includes both fields) and the Phase 3 `workshop.repair_orders.materialized` event (omits both — a pre-existing, out-of-scope precedent inconsistency, not touched this pass); confirmed `EmitEventInput`'s `organizationId`/`branchId` are top-level fields stored directly into `platform_events` columns, separate from `metadata`.
- **Conclusion**: the initial-attempt failure path never loaded `context` at all (no org/branch anywhere on the event); the retry-failure path had `organizationId` but was missing `branchId`.
- **Code changed**: yes — both paths now derive org/branch strictly from the trusted server-loaded context, never client input.

### Finding E — Search filter construction

- **Original hypothesis**: `listForWorkshop`'s manually-built PostgREST `.or(...)` string escapes only `%`/`_`, risking malformed filters for values containing `,`/`(`/`)`.
- **Classification: ACCEPTABLE CURRENT DESIGN relative to repo-wide precedent, hardened anyway as a small optional local improvement.**
- **Evidence checked**: repo-wide grep of every other `.or(` caller — found at least 7 other pre-existing services building `.or()` filters identically or less carefully than the reviewed code, and **no shared PostgREST-filter-escaping helper exists anywhere in the repo**; live-tested directly against the target Supabase REST endpoint (`https://rjeraydumwechpjjzrus.supabase.co`) with real HTTP requests, not just reasoning: an unquoted, comma-containing value produced a genuine `HTTP 400 {"code":"PGRST100", ...}` filter-parse failure; the fixed (double-quoted) form of the identical value returned `HTTP 200` as a single, correctly-scoped condition; also confirmed live that embedded double-quotes and parentheses are both handled correctly once the value is quoted.
- **Conclusion**: not a Phase-4-6-specific regression — this is the established repo-wide pattern, and this code already escaped more (`%`/`_`) than most existing precedent. Still a real, live-provable brittleness for any value containing `,`/`(`/`)`, so a small, local, optional hardening was applied rather than left alone or escalated into a repo-wide refactor.
- **Code changed**: yes (optional hardening — quote the value, escape `"`/`\`, in addition to the existing `%`/`_` escaping).

### Finding F — Materialization status UI state machine

- **Original hypothesis**: the UI may treat a status-query error/undefined as success and render the green materialized state; the initial mutation's cache-seeded RepairOrder count may use only `createdRepairOrders` while other paths use `created + reused`.
- **Classification: CONFIRMED BUG (both sub-issues).**
- **Evidence checked**: traced React Query's actual `isLoading`/`isError`/`data` semantics (`isLoading` is true only while `status==='pending'`; becomes false once either data or error settles; `data` stays `undefined` on error) against `extraction-review-view.tsx`'s prior `materializationNeedsRetry` derivation, which checked `materializationStatus?.materialized === false` — `undefined === false` is `false`, so an error silently fell through to the "else" (success) branch; compared `useApproveAndMaterializeSessionMutation`'s cache-seed against `useRetryMaterializationMutation`'s (`createdRepairOrders + reusedRepairOrders`) and the component's own already-correct inline computation for the same value.
- **Conclusion**: both confirmed as described.
- **Code changed**: yes — new distinct `materializationStatusUnavailable` UI state (component); corrected `repairOrderCount` cache-seed (hook).

### Finding G — Raw internal materialization error exposure

- **Original hypothesis**: a raw RPC/DB error may be copied into `materializationError` and returned directly to the browser.
- **Classification: CONFIRMED DESIGN INCONSISTENCY.**
- **Evidence checked**: read `materializeFromSession`'s error branch (`return { success: false, error: error.message }` — no normalization) side by side with `WddMatcherService.approveSession`'s own `normalizeDbError` helper (which does normalize); read the RPC's own source (`materialize_repair_orders_from_session`) to enumerate its 4 deliberately-authored `RAISE` messages and their specific ERRCODEs (`P0002`, `55000` ×2, `28000`, `42501`); confirmed the action-layer/UI path this error reaches (`materializationError` in `ApproveAndMaterializeResult`, present in the JSON/RSC payload even though the current UI only checks its presence as a boolean).
- **Conclusion**: confirmed, but blindly copying `normalizeDbError`'s pattern would have been the wrong fix — the RPC's own 4 messages are themselves the intended, specific, safe user-facing text and must not be replaced by a generic one.
- **Code changed**: yes — errcode allowlist (`P0002`/`55000`/`28000`/`42501` pass through verbatim; anything else becomes generic, with the raw message still logged server-side).

### Finding H — Approval/materialization authorization recheck

- **Original hypothesis**: nested action calls across the four actions might load inconsistent contexts, use different branch context between approval and materialization, or create TOCTOU issues.
- **Classification: FALSE POSITIVE / ACCEPTABLE CURRENT DESIGN.**
- **Evidence checked**: traced all four actions' authorization points end-to-end — `approveSessionAction` (own permission check + atomic DB-level `WHERE status='ready_for_review'` guard), `approveAndMaterializeSessionAction` (calls `approveSessionAction` fresh, then calls the RPC which independently re-checks `has_branch_permission` itself), `retryMaterializationAction` (own permission check + the same RPC re-check), `getMaterializationStatusAction` (own dual permission check). Confirmed each privileged operation re-verifies its own authorization against live state at the point of use, never a cached/shared/stale snapshot.
- **Conclusion**: no TOCTOU gap exists — every step is independently authorized against current state. The one real observation (a redundant double context-load between approval and materialization) is a minor, non-security performance nit, not worth trading away `approveSessionAction`'s standalone reusability/testability for. The accepted two-transaction approve→materialize design itself was correctly left untouched.
- **Code changed**: no.

### Finding I — Materialization status read model robustness

- **Original hypothesis**: `repairOrderIds.size > 0` may not be the correct definition of "materialized" — e.g. a soft-deleted linked RepairOrder would still count.
- **Classification: CONFIRMED, low-severity, currently unreachable in practice.**
- **Evidence checked**: compared `getMaterializationStatusForSession`'s query against its own sibling methods `listForWorkshop`/`getByIdForWorkshop`, both of which explicitly filter `.is("deleted_at", null)`; live RLS on `repair_order_source_document_links_select` already requires the joined `repair_orders` row to have `deleted_at IS NULL` — meaning a soft-deleted RO's link is already invisible to any caller today via that policy alone.
- **Conclusion**: the gap this closes is currently unreachable given the existing RLS policy, but the read model should not depend solely on an unrelated table's RLS policy staying exactly as it is today to remain correct — fixed as explicit defense-in-depth, matching the sibling methods' own convention. Not redesigned beyond this minimal addition.
- **Code changed**: yes — added a second query against `repair_orders` filtering `deleted_at IS NULL`.

---

## Confirmed fixes — exact behavior before/after

| Finding   | Before                                                                                                                                                                                     | After                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A         | Upload-only actor could `UPDATE wdd_matcher_sessions SET status='approved'` directly via a raw client call — RLS allowed it.                                                               | The same UPDATE now fails with a Postgres RLS violation (`new row violates row-level security policy`) unless the actor also holds `wdd_matcher.approve`. Upload-only actors can still perform every other lifecycle transition. |
| B         | A caller with `wdd_matcher.read` (no `workshop.repair_orders.read`) got `{ success: true, data: { materialized: false, repairOrderCount: 0 } }` even for an actually-materialized session. | The same caller now gets `{ success: false, error: "Unauthorized" }`, and the underlying service is never even called.                                                                                                           |
| D         | `materialization_failed` events: initial-attempt path had no `organizationId`/`branchId`; retry path had `organizationId` but no `branchId`.                                               | Both paths now always carry both fields, derived only from trusted server context.                                                                                                                                               |
| E         | A search value containing an unescaped `,`/`(`/`)` could produce a malformed `.or()` filter string (live-proven `HTTP 400 PGRST100`).                                                      | The value is now double-quoted (PostgREST's own documented mechanism for structural characters); the identical case now returns `HTTP 200` as a single correctly-scoped condition.                                               |
| F         | A materialization-status query error rendered the green "Approved" success state, with either a stale/zero count or the "checking status" text stuck indefinitely.                         | A genuine query error now renders a distinct amber "Approved — Status unavailable" state with a manual "Refresh Status" action; it is never presented as success.                                                                |
| F (cache) | The just-approved mutation's cache-seed used `createdRepairOrders` alone, undercounting when RepairOrders were reused rather than created.                                                 | Now uses `createdRepairOrders + reusedRepairOrders`, matching the retry mutation and the component's own inline logic.                                                                                                           |
| G         | A raw DB/RPC error message (any errcode) was returned to the client verbatim.                                                                                                              | Only the RPC's own 4 deliberately-authored, safe messages (specific errcodes) pass through verbatim; every other error becomes a generic, safe message. The raw error is always logged server-side regardless.                   |
| I         | A hypothetical soft-deleted RepairOrder's link would count toward `repairOrderCount`/`materialized` if it were ever visible.                                                               | Explicitly excluded via a second `deleted_at IS NULL` query, independent of the upstream RLS policy that already (today) prevents this.                                                                                          |

---

## Findings rejected

### Finding C

The reviewer's hypothesis assumed a nullable `branchId` is inherently risky. It is not: `resolveActiveBranch` only ever returns `null` when the user genuinely has zero accessible branches in the org — there is no code path where a user with real branch access ends up with `branchId: null` by accident. Separately, and independently of whatever the application layer does with that value, every affected table's own RLS policy (`has_branch_permission`) re-enforces branch scoping per row. Live inspection confirmed this is not merely theoretical — the RLS policies on `workshop_source_documents`, `repair_order_source_document_links`, and `repair_orders` itself all include `has_branch_permission(..., branch_id, ...)` in their `USING` clause. No cross-org/cross-branch leak is possible via this path.

### Finding H

The reviewer's hypothesis assumed nested action calls might create a TOCTOU window or reuse stale authorization. Tracing all four actions end-to-end shows every privileged operation — `approveSessionAction`'s permission check, its own atomic DB guard, the materialization RPC's own independent `has_branch_permission` re-check inside its own transaction, `retryMaterializationAction`'s permission check, `getMaterializationStatusAction`'s dual permission check — re-verifies against live state at the exact point of use. There is no shared, cacheable authorization snapshot passed between these calls that could go stale between an initial check and a later use. The one real inefficiency found (approval and materialization each independently reload `context` rather than sharing one load) is a performance observation, not a security gap, and changing it would trade away `approveSessionAction`'s value as a standalone, independently testable/reusable action — not a worthwhile trade for a correctness-neutral change. The accepted two-transaction approve→materialize architecture was correctly not touched, per explicit scope instruction.

---

## Database changes

| Migration                | `20260911071854_wdd_matcher_sessions_approval_rls_restriction.sql`                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**              | Close Finding A: add a transition-aware `WITH CHECK` to `wdd_matcher_sessions`' `wms_update` RLS policy so `status='approved'` requires `wdd_matcher.approve` at the DB layer, not just the application layer.                                                                                                                                                                     |
| **Live applied version** | `20260911071854` — applied via Supabase MCP (`apply_migration`) against `supabase-target`; local filename matches the live-tracked version exactly.                                                                                                                                                                                                                                |
| **Live verification**    | `pg_policies` re-queried post-apply — `wms_update`'s `qual`/`with_check` match the migration text exactly. Functional live test: 3/3 pgTAP assertions passing, run as the genuinely non-bypassing `authenticated` Postgres role (not `postgres`, which was discovered mid-session to have `rolbypassrls=true` and so never actually exercises RLS regardless of JWT-claim tricks). |
| **Local/live parity**    | Confirmed — single forward migration, no live-only SQL changes, no historical migration edits.                                                                                                                                                                                                                                                                                     |

No other schema/RPC/function changes were made this pass. No generated-types regeneration was needed (this migration changes only an RLS policy, not a table/column/function signature).

---

## Authorization model after fixes

**Matcher approval**

- Application layer: `approveSessionAction` requires `wdd_matcher.approve`; `WddMatcherService.approveSession` performs an atomic `UPDATE … WHERE status='ready_for_review'` guard (race-safe).
- DB layer (new): `wms_update`'s RLS `WITH CHECK` independently requires `wdd_matcher.approve` whenever the resulting `status='approved'`, regardless of caller (server action or a hypothetical raw client call). Both layers are additive/consistent, not redundant-and-conflicting — the RLS layer is defense-in-depth under the same application-level guard.

**Materialization status**

- `getMaterializationStatusAction` now requires **both** `wdd_matcher.read` and `workshop.repair_orders.read` — matching the two independent RLS domains the underlying query actually touches. Modeled on the existing dual-permission convention (`QrAssignmentsService.listByBranch`), not a new RPC.

**Active branch behavior**

- Unchanged this pass (Finding C rejected). `branchId: string | null` remains a legitimate, RLS-backed state; every affected read path applies an explicit branch filter when `branchId` is known and otherwise relies on each table's own `has_branch_permission` RLS enforcement per row.

**RLS**

- One new policy definition (Finding A), layered onto the existing policy set, following the exact established `repair_orders_update` precedent pattern. No existing policy was destructively replaced with a weaker one; no `FORCE RLS` toggled.

**Permission checks**

- `getMaterializationStatusAction`: now `wdd_matcher.read` AND `workshop.repair_orders.read` (was `wdd_matcher.read` alone).
- `approveSessionAction`, `approveAndMaterializeSessionAction`, `retryMaterializationAction`: permission checks unchanged this pass (already correct — `wdd_matcher.approve`), only their event-emission scope (org/branch) was corrected.

---

## UI behavior after fixes

**Materialization states** — the approval-status strip now has three distinct states instead of two:

1. **Materialized (green)** — `CheckCircle2`, repair-order count shown, "Go to Workshop" link.
2. **Needs retry (red)** — `AlertTriangle`, "Approved — Materialization failed," Retry button.
3. **Status unavailable (amber, new)** — `AlertCircle`, "Approved — Status unavailable," explanatory copy, manual "Refresh Status" button. Only shown when the status query has genuinely errored (not merely loading) and this tab did not itself just complete the approval (in which case the mutation's own result is authoritative regardless of the background query).

**Error handling** — a materialization-status query error is never rendered as the "materialized" success state. `isError`/`refetch` are now destructured from `useMaterializationStatusQuery` and drive the new third state.

**Counts** — the just-approved mutation's cache-seeded `repairOrderCount` now uses `createdRepairOrders + reusedRepairOrders` everywhere in this feature (matching the retry mutation and the component's own inline "just approved" display), eliminating the prior undercount on a reuse-only materialization.

**Retry behavior** — unchanged: `retryMaterializationAction` still calls the same idempotent Phase 3 RPC; the Retry button is only shown in the "needs retry" state, not in the new "status unavailable" state (which offers a status refresh instead, since retrying materialization is not obviously the right action when the actual materialization outcome is simply unknown).

---

## Search behavior after fixes

**Sanitization strategy** — `listForWorkshop`'s single combined `zl_number`/`vin`/`order_number` search value is now: (1) backslashes escaped first (`\` → `\\`), (2) double quotes escaped (`"` → `\"`), (3) `%`/`_` ilike wildcards escaped (`\%`/`\_`), then (4) the whole value wrapped in double quotes inside each `ilike."%…%"` clause — PostgREST's own documented mechanism for protecting structural characters (`,`, `(`, `)`, spaces) inside a filter value.

**Tested edge cases** (unit tests, all passing):

- Plain business value (`ZL/9000`) — matches literally, correctly quoted.
- Value with a space and a slash (`BLWK/900 3252`) — matches literally.
- Value with `%`/`_` (`100%_off`) — wildcards escaped, matched literally not as patterns.
- Value crafted to look like a second OR condition (`x",status.eq.approved,y`) — stays inside one quoted value; **live-verified** (not just unit-tested) against the real Supabase REST endpoint using the exact string the service produces: `HTTP 200`, single scoped condition, no injected second condition.
- Empty/whitespace-only search — no `.or()` clause applied at all (pre-existing, unchanged behavior).
- Branch/org scoping — unchanged; `.eq("organization_id", …)` / `.eq("branch_id", …)` continue to apply before the search filter, independent of the search-value fix.

---

## Tests

| File                                                                                                    | Result                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`                                  | 25/25 passing (11 new/updated this pass)                                                                                                                                               |
| `apps/web/src/app/actions/tools/__tests__/wdd-matcher-approval-actions.test.ts`                         | 12/12 passing (2 new this pass)                                                                                                                                                        |
| `apps/web/src/server/services/__tests__/wdd-matcher.service.test.ts`                                    | unchanged, re-run, passing                                                                                                                                                             |
| `apps/web/src/components/tools/svwms-wdd-matcher/__tests__/extraction-review-approval.test.tsx`         | unchanged, re-run, 7/7 passing — no regression from the Finding F UI changes                                                                                                           |
| `apps/web/src/app/[locale]/dashboard/workshop/_components/__tests__/repair-order-status-badge.test.tsx` | unchanged, re-run, passing                                                                                                                                                             |
| `apps/web/src/app/[locale]/dashboard/workshop/_components/__tests__/repair-orders-search.test.tsx`      | unchanged, re-run, passing                                                                                                                                                             |
| **Combined (all 6 files run together)**                                                                 | **56/56 passing**                                                                                                                                                                      |
| `apps/web/supabase/tests/092_wdd_matcher_approval_rls_test.sql`                                         | 3/3 pgTAP assertions passing — executed live via Supabase MCP, both as inline SQL and as the literal file's own statement sequence, against `supabase-target`, inside `BEGIN…ROLLBACK` |
| `pnpm type-check` (apps/web)                                                                            | clean                                                                                                                                                                                  |
| `pnpm lint` (apps/web, changed files)                                                                   | clean, 0 errors                                                                                                                                                                        |

---

## Remaining gaps

- **Browser E2E**: not attempted again this pass, per explicit instruction not to re-spend time on the already-established sandbox Chromium/screenshot rendering limitation from the prior session. Status is unchanged from the 2026-09-11 Phase 4/5/6 entry — genuine Playwright browser E2E and visual/screenshot review remain outstanding for all three phases.
- **Manual verification**: not performed this pass (out of scope — this was a code-level corrective pass, not a manual UAT pass). A dedicated E2E test account and a real persisted demonstration RepairOrder already exist from the prior session for whoever performs that review.
- **DEMO READY status**: unchanged — still NOT READY, pending the browser E2E/visual review above. This pass fixed defense-in-depth/correctness/consistency gaps underneath Phases 4–6; it did not complete or attempt to complete the outstanding acceptance criterion.
- **Finding B live-authenticated re-test**: the underlying RLS/permission model (workshop.repair_orders.read gating the relevant tables) was independently live-confirmed while investigating the finding, and the fix itself is a fully-typed, unit-testable conditional — a further live-authenticated integration re-test specifically reproducing the old false-negative vs. new "Unauthorized" response was not additionally run this pass (covered instead by the new mocked action-level test). This is a smaller gap than Finding A's live RLS re-test, and is noted here rather than silently assumed complete.
- **Finding F, error-state branch**: no dedicated new component test was added asserting the new amber "status unavailable" render path specifically (the existing 7/7 component suite was re-run and confirmed non-regressing, but does not exercise the new branch). Flagged here as a legitimate small follow-up, not hidden.
- **No Phase 7, container, reservation, allocation, QR, WU, or Legacy Stock work was started**, per explicit scope boundary for this pass.
