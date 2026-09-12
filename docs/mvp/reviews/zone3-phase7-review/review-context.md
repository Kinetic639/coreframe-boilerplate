# Zone 3 Phase 7 — Review Context

**Purpose of this document**: everything an external reviewer needs to review Phase 7 correctly
without having participated in the implementation conversation. Read this alongside
`zone3-phase7.diff` (the code) and `changed-files.md` (the per-file manifest).

**Zone**: 3 — Repair Orders. **Phase**: 7 — Header, advisor ownership, lifecycle, and manual
RepairOrder creation. **Status at bundle time**: implementation complete, automated-test-verified
(including live pgTAP against the real Supabase RLS layer); **manual/browser UAT not yet
performed** (see §J).

---

## A. Phase 7 objective

Phase 7 built the RepairOrder header/detail experience on top of the schema, materialization
pipeline, and list/search UI Phases 1-6 already delivered. Concretely, it added:

- A real RepairOrder **header view** replacing Phase 6's minimal identifier-only detail shell.
- **Editable header fields** (`zl_number`, `order_number`, `vin`, `vehicle_brand`, `client_name`,
  `dealer_name`).
- A **CRM-contact-based advisor** model (`repair_orders.advisor_contact_id → crm_contacts.id`).
- **Advisor ownership semantics**: `manage_own` may act only on RepairOrders where their own
  linked user is the assigned advisor; `manage_all` may act on any RepairOrder in branch scope.
- **`manage_own` / `manage_all`** enforcement, both server-side (actions) and at the RLS layer
  (the authoritative gate).
- **Lifecycle**: `open ↔ closed`, `{open, closed} → archived` (terminal, `manage_all`-only).
- **Manual RepairOrder header creation** — a DEMO READY gate requirement: RepairOrders must not
  depend exclusively on Matcher import.
- **Unresolved identity support**: a manually-created order with no `zl_number` starts
  `identity_status = 'unresolved'`, derived automatically, never client-set.
- **Audit events** for all four new mutation types.
- **Permission-sensitive UI**: edit/reassign/lifecycle controls only render where the RLS layer
  would actually allow the corresponding write.

**Phase 8 and everything after it is explicitly out of scope for this bundle and was not
started.** See §L for the full list of what Phase 7 deliberately did not build.

---

## B. Accepted product decisions (context, not re-litigated by Phase 7)

These were decided before Phase 7 began (architecture doc / earlier phases) and Phase 7
implements against them, not around them:

- RepairOrder is a **warehouse/logistics context** for a repair order, not a full DMS object.
- Business identity: `organization_id + branch_id + zl_number` when resolved. `order_number` is
  descriptive/reference only, never identity.
- **VIN is optional and never unique** — multiple RepairOrders may legitimately share a VIN over
  time (e.g. re-visits of the same vehicle).
- Status model is exactly `open` / `closed` / `archived` — no `in_progress`/`cancelled`/`completed`.
- Advisor is CRM-contact-based (`repair_orders.advisor_contact_id → crm_contacts.id`,
  `crm_contacts.linked_user_id → users.id`).
- `manage_own`: may modify only RepairOrders for which their linked user is the assigned advisor.
- `manage_all`: may manage any RepairOrder in permitted branch scope.
- Manual header creation is **required for pitch** (DEMO READY gate item).
- Manual **line** creation is explicitly **not** Phase 7 — remains PILOT scope (Phase 14).
- A RepairOrder with no `zl_number` gets `identity_status = 'unresolved'`; it is never
  fabricated to satisfy uniqueness.

---

## C. Header field contract

**Editable general header fields** (via `updateHeader`/`updateRepairOrderHeaderAction`):

- `zl_number`
- `order_number`
- `vin`
- `vehicle_brand`
- `client_name`
- `dealer_name`

**Separate, more-restricted write paths** (never touched by `updateHeader`):

- `advisor_contact_id` — via `assignAdvisor`/`assignRepairOrderAdvisorAction` only.
- `status` — via `changeStatus`/`changeRepairOrderStatusAction` only.

**System / non-client-writable** (never accepted as input anywhere in the Phase 7 schema layer):

- `id`, `organization_id`, `branch_id`, `identity_status`, `created_by`, `created_at`,
  `updated_at`, `deleted_at`.

`identity_status` is a special case worth calling out explicitly: it is **derived**, not stored
as a raw editable field. Whenever a header-update payload includes `zl_number` (even setting it
back to `null`), the service re-derives `identity_status` (`'resolved'` if the new value is
non-null, `'unresolved'` otherwise) — it is never accepted directly from any action/schema.

---

## D. Security model

### Permission slugs (unchanged from Phase 2 — Phase 7 reused, did not invent new ones)

- `workshop.repair_orders.read`
- `workshop.repair_orders.manage_own`
- `workshop.repair_orders.manage_all`

### `manage_own` semantics (enforced by `repair_orders_update`'s RLS, not merely by application code)

- May UPDATE a RepairOrder only while `advisor_contact_id` currently resolves to their own
  linked `crm_contacts` row (the `USING` clause).
- May **not** change `advisor_contact_id` to anything other than their own linked contact — the
  `WITH CHECK` clause requires the _new_ row's `advisor_contact_id` to still resolve to the
  caller, so any attempted reassignment away from themselves is rejected outright.
- May **not** write `status = 'archived'` under any circumstance — `WITH CHECK` includes
  `status <> 'archived'` unconditionally for the `manage_own` branch. Because `WITH CHECK`
  evaluates the _entire new row_, this also means: **once a row is already archived, a
  `manage_own` actor cannot write to it at all**, not just the status field — any UPDATE attempt
  (even an unrelated field like `vin`) fails, because the resulting row's `status` remains
  `'archived'`. The application UI mirrors this exactly (§ next section) after a bug caught it.

### `manage_all` semantics

- Unrestricted within branch scope: may edit any RepairOrder's header, reassign advisor to
  anyone, and archive.

### Branch scoping

- `repair_orders` is Tier 1 (FORCE RLS, direct `organization_id`/`branch_id` columns,
  `has_branch_permission`) — unchanged from Phase 2, not touched by Phase 7.

### Trusted org/branch context on manual creation

- `createRepairOrderAction` never accepts `organization_id`/`branch_id` from the client — both
  always come from `loadDashboardContextV2()`'s server-resolved active org/branch. If there is no
  active branch, the action returns a clear error rather than attempting an insert against the
  `branch_id NOT NULL` constraint.

### The discovered pre-existing RLS bug (CONFIRMED, fixed this phase — not introduced by it)

**What was wrong**: `repair_orders_update`'s ownership check was written as a plain correlated
subquery:

```sql
advisor_contact_id IN (SELECT id FROM crm_contacts WHERE linked_user_id = auth.uid())
```

This subquery runs under the _querying role's own privileges_ — unlike `has_branch_permission`
(which is `SECURITY DEFINER` and reads `user_effective_permissions` directly, bypassing that
table's RLS), this subquery is itself subject to `crm_contacts`' own `crm_contacts_select` RLS
policy, which additionally requires the caller to hold `crm.contacts.read`.

**Consequence**: a `workshop.repair_orders.manage_own` actor who does not _also_ separately hold
`crm.contacts.read` — a realistic role split, since Workshop and CRM are different modules — had
this subquery silently return zero rows regardless of genuine ownership. Their own, real
ownership check always evaluated `false`. This was a hard self-lockout on the exact ownership
model this table's RLS exists to enforce, live since Phase 2's original migration
(`20260910061711_repair_orders_core_schema.sql`). It was not caught by Phase 2's own pgTAP suite
because that suite tests policy **wording** (static definition-verification), not full
authenticated-session **behavior** — explicitly documented as a scope limitation in that suite's
own file header.

**How it was found**: live-reproduced this session while writing `093_repair_orders_header_
ownership_rls_test.sql` — the test initially failed with a genuine RLS violation for a real
self-linked contact, prompting investigation rather than being assumed to be a test-authoring
mistake. See §H for the exact live reproduction method.

**The fix**: `is_own_advisor_contact(p_contact_id uuid) RETURNS boolean SECURITY DEFINER` —

```sql
create or replace function public.is_own_advisor_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_contact_id is not null and exists (
    select 1
    from crm_contacts
    where crm_contacts.id = p_contact_id
      and crm_contacts.linked_user_id = (select auth.uid())
      and crm_contacts.deleted_at is null
  );
$$;
```

This mirrors `has_branch_permission`'s own already-established, already-accepted pattern:
bypass the underlying table's RLS for this one specific, narrow, auth.uid()-scoped lookup,
inside a `SECURITY DEFINER` function with a fixed `search_path` (preventing search-path
hijacking) and no caller-supplied SQL or dynamic execution. `repair_orders_update` and
`repair_orders_insert` were rewritten to call this function instead of the raw subquery.

**Why this is architecture-consistent, not a workaround**: the alternative — widening
`crm_contacts`' own RLS so any `workshop.repair_orders.*` holder can read it — would broaden a
_different_ table's visibility surface for a _different_ module's convenience, a much larger and
more invasive change with its own review burden. The `SECURITY DEFINER`-function approach keeps
`crm_contacts`' own RLS completely untouched and narrows the bypass to exactly one boolean
question ("is this specific contact linked to me"), the same shape `has_branch_permission`
already uses for the permission-cache case.

### INSERT-time hardening (the other migration)

Before Phase 7, `repair_orders_insert`'s `WITH CHECK` only required `manage_own` OR `manage_all`
— it placed no restriction on what `advisor_contact_id` a `manage_own` actor could name at
creation time. This was not by itself a privilege escalation (the row still required correct
org/branch and a real permission grant), but it was inconsistent with the UPDATE policy's
self-consistent design, and meant a `manage_own` actor who didn't set themselves as advisor at
creation would immediately create an order they could never again edit via `manage_own`.

Phase 7 hardens `repair_orders_insert`: a `manage_own`-only actor may now only INSERT with
`advisor_contact_id IS NULL` or their own linked contact. `manage_all` is unaffected.

---

## E. Lifecycle contract

Transitions, using the existing (unmodified) `canTransitionRepairOrderStatus` domain helper:

- `open → closed`
- `closed → open`
- `open → archived` (requires `manage_all`)
- `closed → archived` (requires `manage_all`)
- `archived` is **terminal** — no transition out of it for anyone, including `manage_all`. This
  matches the live RLS exactly (`manage_own` can never write to an archived row at all; nothing
  in the domain helper or the RLS allows un-archiving).

**Concurrency**: `changeStatus` uses a conditional `UPDATE repair_orders SET status = :toStatus
WHERE id = :id AND status = :fromStatus AND ...`. If a concurrent caller already changed the
status, this UPDATE matches zero rows and the service returns a specific conflict error
("RepairOrder was not in the expected status...") rather than reporting a false success or a
generic failure. `canTransitionRepairOrderStatus` is also checked in the action layer _before_
this UPDATE is attempted, so an illegal transition (e.g. `manage_own` requesting `archived`) is
rejected with a clear message before any DB round-trip.

---

## F. Manual creation contract

- `organization_id` always comes from the caller's server-resolved active org
  (`loadDashboardContextV2()`) — never from client input, never a schema field.
- `branch_id` always comes from the caller's server-resolved active branch — never from client
  input. If there is no active branch, `createRepairOrderAction` returns a clear error and never
  attempts the insert (the DB column is `NOT NULL`, so this is caught before the DB layer, not
  surfaced as a raw constraint violation).
- `zl_number` is optional. No fabricated value is ever generated to satisfy the uniqueness
  constraint.
- `vin` is optional (per the accepted product decision — never unique).
- `identity_status` is derived server-side: `'resolved'` if `zl_number` is present at creation,
  `'unresolved'` otherwise.
- Initial `status` is always `'open'` (the table's own `DEFAULT`, not overridden).
- **Duplicate identity handling**: the live partial unique index
  `repair_orders_identity_unique` (`(organization_id, branch_id, zl_number) WHERE zl_number IS
NOT NULL AND deleted_at IS NULL`) is the authoritative uniqueness enforcement. `createRepairOrder`
  catches Postgres error code `23505` and maps it to "A RepairOrder with this ZL number already
  exists in this branch" — never a raw Postgres constraint-violation string.

---

## G. Audit/event behavior

Four new `platform_events` registry entries (all `STATE` category, `baseline` tier, branch-scoped,
Mode A — application-side, best-effort, emitted after the DB write commits, matching every other
Zone 3 event so far):

| Action key                                | Emitted by                              | Intent   |
| ----------------------------------------- | --------------------------------------- | -------- |
| `workshop.repair_orders.created`          | `RepairOrdersService.createRepairOrder` | `CREATE` |
| `workshop.repair_orders.header_updated`   | `RepairOrdersService.updateHeader`      | `UPDATE` |
| `workshop.repair_orders.advisor_assigned` | `RepairOrdersService.assignAdvisor`     | `ASSIGN` |
| `workshop.repair_orders.status_changed`   | `RepairOrdersService.changeStatus`      | `UPDATE` |

Each emission uses `organizationId`/`branchId` sourced from the operation's own trusted
parameters (never re-derived from a potentially-stale caller context after the fact) and
`entityType: "repair_order"` / `entityId: <the row's id>`. A failed emission is logged and does
not roll back or fail the already-committed domain write (the same Mode A trade-off every other
Zone 3 event caller accepts).

---

## H. Live Supabase verification

- **Authoritative project**: `supabase-target` (unchanged from every prior Zone 3 phase).
- **Live objects inspected before writing any code**: `repair_orders` columns/constraints/indexes/
  RLS policies; `crm_contacts`/`crm_party_roles`/`crm_parties`/`crm_party_contacts`
  columns/constraints/RLS; `has_branch_permission`'s live function definition (to confirm the
  `SECURITY DEFINER` pattern to mirror).
- **Bug reproduction method**: a real self-linked `crm_contacts` row was inserted (as `postgres`,
  bypassing RLS for setup only), then queried under `SET LOCAL ROLE authenticated` with a real
  JWT claim (`request.jwt.claims` set to the target user's `sub`) holding only
  `workshop.repair_orders.manage_own`/`.read` — the ownership subquery returned zero rows despite
  the contact genuinely being linked to that user, confirming the bug live before writing the fix.
- **Both migrations applied through MCP** (`apply_migration`), not hand-edited into the live
  database out-of-band.
- **Local/live migration parity**: verified both at the time of authoring (each local filename
  renamed to match the exact live-reported version from `list_migrations`, per this project's
  established convention) and **re-verified while preparing this bundle** — `list_migrations`
  shows `20260911172022` and `20260911172434` live, matching the local filenames exactly, with no
  drift.
- **pgTAP execution context**: `093_repair_orders_header_ownership_rls_test.sql` was executed
  live via `mcp__supabase-target__execute_sql`, wrapped in `BEGIN;...ROLLBACK;`, as the genuinely
  RLS-enforced `authenticated` role (not `postgres`, which has `rolbypassrls=true` and would
  silently pass every assertion for the wrong reason).
- **Result**: 12/12 assertions passing. Zero residual data confirmed after the run (`SELECT
count(*) FROM repair_orders WHERE order_number LIKE '093-TEST-%'` returned `0` post-rollback).

---

## I. Tests

| Suite                | File                                                             | Count                        |
| -------------------- | ---------------------------------------------------------------- | ---------------------------- |
| Service              | `repair-orders.service.test.ts` (Phase 7 additions)              | 15 new (41/41 total in file) |
| Action               | `app/actions/workshop/__tests__/repair-orders.test.ts`           | 21/21                        |
| Component            | `[id]/_components/__tests__/repair-order-header-editor.test.tsx` | 8/8                          |
| Component            | `new/_components/__tests__/new-repair-order-form.test.tsx`       | 5/5                          |
| DB/RLS (pgTAP, live) | `093_repair_orders_header_ownership_rls_test.sql`                | 12/12                        |

**Full Zone 3 automated suite run together** (Phases 1-7, ten test files): **127/127 passing.**

- `pnpm type-check`: clean (exit 0), no errors.
- `pnpm lint` (ESLint) on every new/changed file: clean, zero warnings/errors.

---

## J. Manual/browser gap — explicitly outstanding

**Browser/manual UAT of Phase 7 has NOT been performed.** This bundle does **not** claim
browser E2E passed, automated or manual, for this phase. This is the same class of gap Phases
4-6 carried before their own product-owner manual UAT pass (which did happen for those phases
and is recorded in the progress tracker's change log) — Phase 7's equivalent pass has not
happened yet.

**Expected manual flow, not yet run:**

1. Manually create a RepairOrder (with and without a `zl_number`).
2. Open its detail page.
3. Edit header fields, save, confirm persistence.
4. As `manage_all`: assign/reassign the advisor.
5. Close the order.
6. Reopen it.
7. Archive it.
8. Verify archived immutability (no edit control renders; a direct attempt would be rejected by
   RLS regardless of UI state).
9. Verify `manage_own`-only behavior: create as `manage_own`, confirm the owner can edit/close/
   reopen but never sees an Archive control or an advisor-reassignment control, and cannot touch
   another advisor's order.

---

## K. Known unresolved product decision — advisor-picker scoping

The architecture doc's own prose for advisor-picker scoping states: "a `crm_contacts` row
representing an internal advisor gets a `crm_party_roles` row with `role='employee'`."

**This is not implementable against the live schema as literally described.**
`crm_party_roles.role` is a **party-level** tag — `crm_party_roles.party_id → crm_parties.id`,
with no `contact_id` column at all. A CONTACT only relates to a PARTY via the separate
`crm_party_contacts` junction table. To tag a _specific person_ as "employee" via this
mechanism would require creating a synthetic "staff" `crm_parties` row with `role='employee'`,
then linking each advisor's `crm_contacts` row to it via `crm_party_contacts` — an entirely new,
undecided, unprecedented pattern. A repo-wide search for `employee` found no existing usage of
this scheme anywhere (only an unrelated auth-role label in an organization-users component).

**What was implemented instead, as an interim measure**: `RepairOrdersService
.listAdvisorCandidates` scopes the picker to `crm_contacts` rows already linked to a real
platform user (`linked_user_id IS NOT NULL` and not soft-deleted). The reasoning: those are the
_only_ contacts that can ever function as an "owner" under the `manage_own` RLS model in the
first place (an advisor with no linked user could still be assigned by `manage_all`, but could
never satisfy `manage_own`'s ownership check regardless of any role tag). This is a UI-scoping
convenience only — it is **not** a security boundary; RLS enforces real ownership independent of
how the picker is populated.

**The reviewer should specifically assess:**

- Whether this interim scoping is acceptable for the pitch demo as-is.
- Whether it creates any security or business-correctness problem (the implementer's own
  assessment: no — RLS is the actual gate either way, this only affects dropdown contents).
- Whether a richer employee-role model should be explicitly designed for pilot, and if so,
  whether the synthetic-party-per-employee shape sketched above is the right direction or
  whether an alternative (e.g. a new `crm_contacts.is_employee` boolean) would be simpler and
  should be preferred instead.

**This decision was deliberately not resolved by the implementer** — it is recorded here for the
product owner / reviewer to decide, not silently closed.

---

## L. Explicit non-goals — confirmed NOT implemented in Phase 7

- RepairOrder **lines** (parts) — Phase 8.
- Source-document provenance UI — Phase 9.
- Reservations — Phase 10A.
- Allocations — Phase 10B.
- Containers — Phase 10C.
- Container QR workflow — Phase 10D.
- WU 201 / issue from container — Phase 10F.
- Legacy Stock 105/PZ-I — out of scope entirely for pitch (remains PILOT).
- Comments — not built (generic infra exists elsewhere in the repo, not wired to RepairOrder).
- Attachments — Phase 12.
- Advanced AutoStacja import hardening beyond what already existed from Phase 3 — not touched.
- Notifications — not built.

---

## Questions for external reviewer

1. Is the `manage_own` ownership model enforced at every relevant boundary (RLS **and**
   server action), or does any path rely on the UI alone?
2. Is `is_own_advisor_contact()` (`SECURITY DEFINER`) safe: fixed `search_path`, actor identity
   based on `auth.uid()` only (no caller-supplied identity parameter), no path to caller-
   controlled privilege escalation?
3. Does the `repair_orders` UPDATE RLS correctly protect: ownership, archived-record immutability,
   advisor reassignment (manage_own can never succeed), and general header editing?
4. Is INSERT safe for `manage_own` — can it still be tricked into creating a row owned by someone
   else, or into skipping the org/branch trust boundary?
5. Can `organization_id` or `branch_id` be spoofed from manual-create input anywhere in the
   action → service → DB path?
6. Can `manage_own` assign (or reassign) a RepairOrder to a _different_ advisor by any path,
   direct action call included (not just through the UI)?
7. Can `manage_own` archive a RepairOrder by any path?
8. Can an already-archived RepairOrder be mutated through some other application path not
   reviewed here (e.g. a generic/shared update utility)?
9. Are lifecycle transitions genuinely race-safe under concurrent callers, or only "safe in
   sequential testing"?
10. Is duplicate-`zl_number` handling correct, and does the error message avoid leaking raw
    constraint/schema details?
11. Is `identity_status` always derived server-side, with no path — action, service, or
    otherwise — where a client could set it directly?
12. Are the advisor/contact lookup semantics (`getOwnAdvisorContactId`,
    `listAdvisorCandidates`) safe against cross-org/cross-branch leakage?
13. Is the `linked_user_id`-only advisor picker (§K) acceptable for pitch, or does it need to be
    resolved before demo?
14. Are the four new audit events correctly scoped to the _target_ RepairOrder's org/branch,
    never the caller's possibly-different active context?
15. Are raw Supabase/Postgres errors sanitized appropriately everywhere a new mutation can fail
    (not just the `23505` case)?
16. Are the new server actions actually authoritative, or does any direct Supabase Data API path
    (e.g. a client-side `.from("repair_orders")` call elsewhere in the app) bypass the intended
    business rules that the actions layer adds on top of RLS?
17. Are any generic CRM permissions (`crm.contacts.*`) now accidentally _required_ for basic
    RepairOrder ownership after the new `SECURITY DEFINER` helper, where they previously
    shouldn't have been?
18. Did Phase 7 accidentally expand scope into Phase 8+ anywhere (lines, provenance, warehouse,
    containers)? (Implementer's own answer: no — see §L; reviewer should independently confirm
    against the diff.)
19. Are the tests genuinely testing authorization _outcomes_ (specific expected success/failure,
    specific expected row state) rather than merely accepting "any exception was thrown" as proof
    of correctness?
20. Is there any remaining pitch-blocking issue in this diff that should be fixed before the
    manual UAT pass in §J is attempted?
