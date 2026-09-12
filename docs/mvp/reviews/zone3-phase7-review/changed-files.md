# Zone 3 Phase 7 — Changed File Manifest

Scope: **only** "Phase 7 — Header, advisor ownership, lifecycle, and manual RepairOrder creation."
23 files, all captured verbatim in `zone3-phase7.diff` (see Bundle Validation at the bottom).

Baseline: `HEAD` at bundle time (commit `00221132` "docs update" — the Phase 4-6 manual-UAT
tracker-correction commit). See `review-context.md` §H for how this baseline was confirmed to
predate all Phase 7 work with zero Phase 7 content already present.

---

## DB migrations

### `apps/web/supabase-target/supabase/migrations/20260911172022_repair_orders_insert_advisor_self_restriction.sql`

- **Status**: NEW
- **Category**: DB migration
- **Local filename**: `20260911172022_repair_orders_insert_advisor_self_restriction.sql`
- **Live-applied version**: `20260911172022` (re-verified live via `list_migrations` while preparing this bundle — identical, no drift)
- **Local/live parity**: ✅ verified
- **DB objects affected**: `repair_orders_insert` RLS policy (`repair_orders` table) — dropped and recreated
- **What changed**: hardens the INSERT policy so a `workshop.repair_orders.manage_own`-only actor may only set `advisor_contact_id` to `NULL` or to their own linked `crm_contacts` row at creation time. `manage_all` is unaffected (unrestricted).
- **Why Phase 7 needed it**: Phase 7 introduces the first real INSERT path (`createRepairOrder`/manual creation). Without this, a `manage_own` actor could name an unrelated contact as advisor at creation — inconsistent with the UPDATE policy's own self-consistent design, and would create an order the creator could never again edit via `manage_own`.
- **Security/business behavior affected**: **Yes — this is one of the two security-relevant migrations.** See `review-context.md` §D for the full writeup.

### `apps/web/supabase-target/supabase/migrations/20260911172434_repair_orders_advisor_self_check_fn.sql`

- **Status**: NEW
- **Category**: DB migration
- **Local filename**: `20260911172434_repair_orders_advisor_self_check_fn.sql`
- **Live-applied version**: `20260911172434` (re-verified live — identical, no drift)
- **Local/live parity**: ✅ verified
- **DB objects affected**: new function `public.is_own_advisor_contact(uuid) RETURNS boolean` (`SECURITY DEFINER`); `repair_orders_update` and `repair_orders_insert` RLS policies — both dropped and recreated to call it instead of a raw subquery
- **What changed**: fixes a **CONFIRMED, pre-existing, live bug** (present since Phase 2, not introduced by Phase 7) where the ownership-check subquery against `crm_contacts` was itself subject to `crm_contacts`' own RLS, silently defeating ownership proof for any `manage_own` actor lacking a separate `crm.contacts.read` grant.
- **Why Phase 7 needed it**: discovered while writing this phase's own RLS test (`093_...sql`) — the test initially failed for a genuine reason, not a test-authoring mistake, which is what surfaced this.
- **Security/business behavior affected**: **Yes — the other of the two security-relevant migrations, and the more significant one.** See `review-context.md` §D for the full writeup and the reviewer questions in §L / "Questions for external reviewer" that specifically probe this function's safety.

---

## pgTAP / DB test

### `apps/web/supabase/tests/093_repair_orders_header_ownership_rls_test.sql`

- **Status**: NEW
- **Category**: pgTAP/DB test
- **What changed**: 12 pgTAP assertions exercising `repair_orders` INSERT/UPDATE RLS as the genuinely-RLS-enforced `authenticated` role (real JWT claim simulation, not `postgres`/service-role) — self-insert, reject-insert-as-other, null-advisor-insert, header edit on own order, blocked advisor reassignment away from self, blocked self-archive, legal open→closed, silent no-op editing another advisor's order, explicit negative `warehouse.inventory.operate` check, and three `manage_all` positive cases (reassign/edit-any/archive).
- **Why Phase 7 needed it**: this phase's own stated DB/RLS testing requirement (ownership boundary, negative inventory-permission test, archive-permission boundary test).
- **Security/business behavior affected**: this test is what surfaced the bug fixed by the second migration above — see `review-context.md` §H/§I for live execution results (12/12 passing, zero residual data).

---

## Service

### `apps/web/src/server/services/repair-orders.service.ts`

- **Status**: MODIFIED (+425/-? — see diff for exact hunks; net addition, no existing Phase 3/5/6 method signatures removed except `getByIdForWorkshop`'s return type widened)
- **Category**: service
- **What changed**: adds `createRepairOrder`, `updateHeader`, `assignAdvisor`, `changeStatus`, `listAdvisorCandidates`, `getOwnAdvisorContactId`; widens `getByIdForWorkshop`'s return type from `RepairOrderListRow` to the new superset `RepairOrderHeader` (non-breaking — same fields plus `vehicleBrand`/`clientName`/`dealerName`/`createdBy`); adds `RepairOrderHeader`/`RepairOrderAdvisorCandidate` types and the shared `HEADER_COLUMNS` select-column constant.
- **Why Phase 7 needed it**: the service layer implementing every Phase 7 mutation and the advisor-picker/self-lookup reads.
- **Security/business behavior affected**: `createRepairOrder` never accepts `organization_id`/`branch_id` from the caller (always the server-trusted params); `identity_status` is always derived, never client-writable; `changeStatus` is race-safe via a conditional `UPDATE ... WHERE status = fromStatus`; `23505` (duplicate `zl_number`) is mapped to a friendly, non-leaking error message in both `createRepairOrder` and `updateHeader`.

### `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`

- **Status**: MODIFIED (adds 15 new tests; also widens the existing `makeChainableQueryMock` test helper to support `insert`/`update`/`not`/`single` chain methods, needed by the new tests — no existing test assertions changed)
- **Category**: unit/component test (service-level)
- **What changed**: new `describe` blocks for `createRepairOrder`, `updateHeader`, `assignAdvisor`, `changeStatus`, `listAdvisorCandidates`, `getOwnAdvisorContactId`.
- **Why Phase 7 needed it**: this phase's own stated unit/service testing requirement.

---

## Action

### `apps/web/src/app/actions/workshop/repair-orders.ts`

- **Status**: NEW
- **Category**: action
- **What changed**: 5 new server actions — `createRepairOrderAction`, `updateRepairOrderHeaderAction`, `assignRepairOrderAdvisorAction`, `changeRepairOrderStatusAction`, `listAdvisorCandidatesAction`.
- **Why Phase 7 needed it**: no `workshop`-domain action module existed before Phase 7 (Phase 6's list/detail reads called the service directly from server components, by design — no mutations existed yet).
- **Security/business behavior affected**: every action re-derives org/branch from `loadDashboardContextV2()` server-side (never trusts client input); `createRepairOrderAction` pre-validates a `manage_own`-only caller's `advisor_contact_id` selection against their own linked contact _before_ calling the service (defense in depth ahead of the RLS `WITH CHECK`); `assignRepairOrderAdvisorAction` pre-checks `manage_all` explicitly (a clear "Unauthorized" instead of a confusing RLS-driven silent no-op); `changeRepairOrderStatusAction` pre-checks the transition via the existing `canTransitionRepairOrderStatus` domain helper before ever reaching the DB, and separately checks for a missing active branch on create (rejects clearly rather than attempting a doomed insert against `branch_id NOT NULL`).

### `apps/web/src/app/actions/workshop/__tests__/repair-orders.test.ts`

- **Status**: NEW
- **Category**: unit/component test (action-level)
- **What changed**: 21 tests covering authorization pre-checks, trusted-context enforcement, the advisor-self-restriction at creation, and illegal-transition rejection (including `archived → open`, proving `archived` stays terminal even for `manage_all`).
- **Why Phase 7 needed it**: this phase's own stated action-layer testing requirement (authorization, trusted org/branch context, validation, client-error sanitization).

---

## Hook/query

### `apps/web/src/hooks/queries/workshop/index.ts`

- **Status**: NEW
- **Category**: hook/query
- **What changed**: React Query wrappers for the 5 new actions (`useCreateRepairOrderMutation`, `useUpdateRepairOrderHeaderMutation`, `useAssignRepairOrderAdvisorMutation`, `useChangeRepairOrderStatusMutation`, `useAdvisorCandidatesQuery`) plus a query-key factory.
- **Why Phase 7 needed it**: Phase 6 deliberately had no `workshop` query-hook module (server-component reads only, no mutations existed). Phase 7 introduces real client-triggered mutations, so hooks now match the repo's established per-module convention (`src/hooks/queries/[module]/index.ts`).

---

## UI / page / component

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/page.tsx`

- **Status**: MODIFIED
- **Category**: UI/page/component
- **What changed**: upgraded from Phase 6's minimal identifier-only detail shell to the real Phase 7 header view — fetches the full `RepairOrderHeader`, the advisor candidate list (if `manage_all`), and the caller's own linked contact id (if `manage_own` only); renders `RepairOrderHeaderEditor`.
- **Why Phase 7 needed it**: this is the actual detail/edit page this phase's plan calls for.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-header-editor.tsx`

- **Status**: NEW
- **Category**: UI/page/component
- **What changed**: client component — header field edit toggle, advisor display/reassignment section, lifecycle action buttons (Close/Reopen/Archive).
- **Security/business behavior affected**: edit/lifecycle controls are gated in the UI to match what RLS actually allows (a `manage_own` owner cannot see an Edit control once the order is `archived`, since `repair_orders_update`'s `WITH CHECK` rejects _any_ write to an archived row for `manage_own` — this was a bug caught by this same phase's own component tests mid-build, fixed before the bundle was cut); the Archive button only ever renders for `manage_all` and is behind a confirmation dialog; UI gating is UX only — every control's real enforcement is the server action + RLS, not this component.

### `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-header-editor.test.tsx`

- **Status**: NEW
- **Category**: unit/component test
- **What changed**: 8 tests — edit/lifecycle visibility by ownership and status, the archived/`manage_own` read-only regression, advisor-picker visibility by permission, save-flow wiring.

### `apps/web/src/app/[locale]/dashboard/workshop/new/page.tsx`

- **Status**: NEW
- **Category**: UI/page/component
- **What changed**: server component for the new `/dashboard/workshop/new` route — permission gate (`manage_own` OR `manage_all`), redirects clearly if there is no active branch, loads advisor candidates/own-contact-id, renders `NewRepairOrderForm`.

### `apps/web/src/app/[locale]/dashboard/workshop/new/_components/new-repair-order-form.tsx`

- **Status**: NEW
- **Category**: UI/page/component
- **What changed**: client creation form — all business fields optional; advisor control adapts to permission (`manage_all`: full picker; `manage_own` with a linked contact: a single "assign this order to me" checkbox, since self-claiming any other way is impossible under the RLS/ownership model); navigates to the new order's detail page on success.

### `apps/web/src/app/[locale]/dashboard/workshop/new/_components/__tests__/new-repair-order-form.test.tsx`

- **Status**: NEW
- **Category**: unit/component test
- **What changed**: 5 tests — empty-field-to-null submission, typed-value submission, `manage_own` self-assign checkbox wiring, `manage_all` picker visibility, post-create navigation.

### `apps/web/src/app/[locale]/dashboard/workshop/page.tsx`

- **Status**: MODIFIED
- **Category**: UI/page/component
- **What changed**: adds a permission-gated "New repair order" CTA linking to `/dashboard/workshop/new`.

---

## Validation / type

### `apps/web/src/lib/validations/repair-orders.ts`

- **Status**: NEW
- **Category**: validation/type
- **What changed**: zod schemas — `createRepairOrderSchema`, `updateRepairOrderHeaderSchema`, `assignRepairOrderAdvisorSchema`, `changeRepairOrderStatusSchema` — and their inferred input types.
- **Security/business behavior affected**: this is the schema boundary between raw action input and the service layer; `organization_id`/`branch_id`/`identity_status` are deliberately absent from every schema (never accepted as client input by design, not merely omitted from a form).

### `apps/web/src/lib/types/repair-orders.ts`

- **Status**: MODIFIED (small change — see diff; +6/-3 lines)
- **Category**: validation/type
- **What changed**: exports the previously-private `REPAIR_ORDER_STATUSES` constant (needed by the new zod schema's `z.enum(...)`) — no change to the existing `canTransitionRepairOrderStatus` domain rule or any other Phase 1/2 logic.

---

## Event / audit

### `apps/web/src/server/audit/event-registry.ts`

- **Status**: MODIFIED (append-only — 4 new entries added after the existing Zone 3 entries; no existing entries changed)
- **Category**: event/audit
- **What changed**: registers `workshop.repair_orders.created`, `.header_updated`, `.advisor_assigned`, `.status_changed` (all `STATE` category, `baseline` tier, branch-scoped, Mode A — matching the existing Zone 3 event conventions from Phases 3-5).

---

## i18n

### `apps/web/messages/en.json`

- **Status**: MODIFIED
- **Category**: i18n
- **What changed**: new strings under `modules.workshop.repairOrders.detail.*` (edit/save/cancel/advisor/lifecycle/archive-confirm labels) and a new `newOrder.*` block (creation-form copy); minor rewording of `subtitle`/`emptyState.subtitle`/`detail.futurePhasesNote` to reflect that manual creation and lifecycle actions now exist.

### `apps/web/messages/pl.json`

- **Status**: MODIFIED
- **Category**: i18n
- **What changed**: Polish equivalents of the above.

---

## i18n routing

### `apps/web/src/i18n/routing.ts`

- **Status**: MODIFIED (+4 lines)
- **Category**: i18n (routing)
- **What changed**: registers the new `/dashboard/workshop/new` route (`/dashboard/warsztat/nowe` in Polish), inserted before the existing `/dashboard/workshop/[id]` entry.

---

## Documentation / tracker

### `docs/mvp/zones/03-repair-orders-implementation-plan.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **What changed**: Phase 7 section — status header, corrective-review note (the two migrations above), full implementation-task checklist (0/10 → 10/10), testing requirements, acceptance-criteria evaluation.

### `docs/mvp/zones/03-repair-orders-progress.md`

- **Status**: MODIFIED
- **Category**: documentation/tracker
- **What changed**: top-of-file runtime status/current-phase/pitch-readiness; overall execution counts (66/165 → 76/165); Phase 7 phase-tracker table row (⬜ NOT STARTED → ✅ DONE, 0/10 → 10/10); a full new "Phase 7 — Detailed tasks" section; two DEMO-READY-gate line updates; two new `DISCOVERY-005`/`DISCOVERY-006` entries (the RLS bug and the advisor-picker product-decision gap); a new change-log entry.

---

## Bundle validation

- **Files in `zone3-phase7.diff`**: 23 (verified: `git diff --cached --name-status` output has exactly 23 lines, all 23 appear as `diff --git` headers in the `.diff` file).
- **Files in this manifest**: 23 — one-to-one match, verified by direct comparison of both file lists (see `review-context.md` §"Bundle validation" for the exact comparison command/output).
- **Diff line count**: 3,609 lines.
- **Diff byte size**: 193,128 bytes (~189 KB).
- **Net change**: 3,156 insertions, 86 deletions across 23 files.
