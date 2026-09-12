# Zone 3 Phase 7 Correction Pass — Review Context

**Purpose of this document**: the reviewer has already reviewed the original Phase 7
implementation (via `docs/mvp/reviews/zone3-phase7-review/`). This document explains **only**
what changed in the subsequent correction pass, structured by the six findings that pass
addressed. Read alongside `zone3-phase7-corrections.diff` (the code) and `changed-files.md`
(the per-file manifest).

---

## Baseline reconstruction method

Phase 7 (and this correction pass) were both implemented as uncommitted working-tree changes
on top of `HEAD` (`00221132`, "docs update" — the Phase 4-6 state). There is no git commit
boundary between "Phase 7 as originally reviewed" and "Phase 7 + this correction pass" — both
exist only as one continuous set of uncommitted changes.

To isolate the correction pass alone, the exact "Phase 7, before this correction pass" state
was reconstructed as follows, without touching the active implementation worktree:

1. Created an isolated temporary git worktree (`git worktree add --detach`) at `HEAD`.
2. Applied the ORIGINAL Phase 7 review bundle's diff (`docs/mvp/reviews/zone3-phase7-review/
zone3-phase7.diff` — captured at the end of Phase 7, before this correction pass began) to
   that worktree via `git apply` — applied cleanly, no conflicts, no manual edits.
3. Committed that resulting tree in the temporary worktree (`--no-verify`, to avoid triggering
   this repo's `pnpm install`/husky hooks inside a throwaway worktree) as a reconstruction
   commit, `3b06a230` — this commit is, by construction, byte-for-byte "Phase 7 as originally
   reviewed."
4. Diffed the CURRENT (main worktree) state against that reconstruction commit, scoped to the
   file areas the six findings could plausibly touch.
5. Cross-checked: an UNSCOPED diff against the same reconstruction commit returns exactly the
   14 scoped files above PLUS the four files of the original `zone3-phase7-review/` bundle
   directory itself (which predates this correction pass — it is packaging output ABOUT Phase 7,
   not a correction, and is correctly excluded here, matching this pass's own exclusion list).
   This confirms the 14-file scoped diff is a complete, exact isolation of the correction pass
   — nothing from the correction pass falls outside it, and nothing unrelated leaked in.
6. Removed the temporary worktree after extracting the diff (see "Confirmation implementation
   was not modified" at the end of this document).

**Isolation is exact — nothing was left unaccounted for.**

---

## A — Own advisor lookup

**Original bug**: `RepairOrdersService.getOwnAdvisorContactId` ran a plain, authenticated
`SELECT id FROM crm_contacts WHERE organization_id = :org AND linked_user_id = :user`. This
query is itself subject to `crm_contacts_select`'s own RLS policy, which additionally requires
the caller to hold `crm.contacts.read` — a separate CRM-module permission a Workshop-only
`manage_own` advisor would not typically hold.

**Exact live reproduction** (unchanged from the correction pass itself, reproduced here for the
reviewer's benefit): a real `crm_contacts` row was inserted, linked to the Zone 3 E2E test
user, in their real organization. Acting as that user under `SET LOCAL ROLE authenticated` with
a real JWT claim, holding only `workshop.repair_orders.manage_own` + `.read` (NOT
`crm.contacts.read`):

- `is_own_advisor_contact(<that contact's id>)` correctly returned `true`.
- The exact query shape `getOwnAdvisorContactId` used returned **zero rows** for the same
  actor/contact.

**Why the plain SELECT failed but `is_own_advisor_contact()` succeeded**: `is_own_advisor_
contact()` is `SECURITY DEFINER` — it runs with the function OWNER's privileges, bypassing
`crm_contacts`' RLS entirely for this one narrow lookup. A plain application-code SELECT always
runs under the CALLING role's own privileges (RLS fully applies).

**The new `get_own_advisor_contact_id` RPC**:

```sql
create or replace function public.get_own_advisor_contact_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from crm_contacts
  where organization_id = p_organization_id
    and linked_user_id = (select auth.uid())
    and deleted_at is null
  limit 1;
$$;
```

- **`SECURITY DEFINER`**: bypasses `crm_contacts`' RLS for this lookup only, mirroring `is_own_
advisor_contact`/`has_branch_permission`'s own already-accepted pattern — no new privilege
  model invented.
- **Organization scoping**: `p_organization_id` is a required parameter; the WHERE clause
  filters on it directly. Live-verified: calling with the caller's own org returns their
  contact; calling with a different (random) org id returns `NULL`.
- **`auth.uid()` identity derivation**: the function takes NO user-id parameter at all — it can
  only ever resolve to the CALLING user's own linked contact, never anyone else's. There is no
  way for a caller to pass another user's id and get their contact back.
- **Minimal exposure**: returns a single `uuid`, not the contact's name/email/other fields.

**Application call sites changed**: `RepairOrdersService.getOwnAdvisorContactId` (now calls the
RPC, dropped its unused `userId` parameter); its three callers (`createRepairOrderAction`,
`/dashboard/workshop/[id]/page.tsx`, `/dashboard/workshop/new/page.tsx`) updated to the new
2-argument call shape — no logic change at the call sites themselves, purely mechanical.

**Tests**: `094_repair_orders_correction_pass_rls_test.sql` T1 (resolves correctly without
`crm.contacts.read`) / T2 (organization-scoped, wrong org → `NULL`); service-level tests
rewritten to mock `.rpc()`.

**Is `crm.contacts.read` still required for `manage_own` ownership UX? No — that is the whole
point of the fix.** A `manage_own` advisor with ZERO CRM-module permissions can now: be
correctly recognized as the owner of their own RepairOrder (edit/lifecycle controls render
correctly), and self-assign during manual creation. `crm.contacts.read` remains required only
for the unrelated advisor-PICKER list (`listAdvisorCandidates`, `manage_all`-only UI, which
lists OTHER people's contacts and is correctly still gated by that table's own RLS — the picker
degrading to an empty list without it is an accepted, unrelated, pre-existing design, not
touched by this fix).

---

## B — Archived terminality

**Original RLS gap**: `repair_orders_update`'s policy restricted `status='archived'` writes
only inside the `manage_own` branch (`WITH CHECK ... AND status <> 'archived'`). The
`manage_all` branch (`has_branch_permission(..., 'manage_all')`) had NO status restriction at
all in either `USING` or `WITH CHECK`.

**Exact direct-UPDATE exploit path** (live-reproduced before the fix): as `manage_all`,
`UPDATE repair_orders SET status = 'archived' WHERE id = :id` succeeded (expected — this is the
legitimate archiving action). A SECOND raw `UPDATE repair_orders SET status = 'open' WHERE id =
:id` (no other change) against that now-archived row ALSO succeeded — un-archiving. A THIRD raw
`UPDATE repair_orders SET vin = '...' WHERE id = :id` against a genuinely still-archived row
ALSO succeeded — mutating an unrelated field on an archived record.

**Final `repair_orders_update` policy**:

```sql
create policy repair_orders_update
  on public.repair_orders
  for update
  using (
    status <> 'archived'
    and (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
      or (
        has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
        and is_own_advisor_contact(advisor_contact_id)
      )
    )
  )
  with check (
    has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    or (
      has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      and is_own_advisor_contact(advisor_contact_id)
      and status <> 'archived'
    )
  );
```

**Why `open`/`closed` → `archived` still works**: `USING` is evaluated against the row's
CURRENT (pre-update) values. When archiving a genuinely `open` or `closed` order, `OLD.status`
is never `'archived'`, so `status <> 'archived'` in `USING` is `true`, and the row remains
reachable for the UPDATE that sets it to `'archived'`.

**Why `archived` → anything now fails**: once a row's CURRENT status is `'archived'`, `status <>
'archived'` in `USING` evaluates `false` — the row is excluded from the UPDATE's candidate set
entirely, for EVERY caller (both branches of the `OR` sit inside the same top-level `AND` with
this new clause), regardless of which permission they hold or what they're trying to change.

**Do archived field edits also fail? Yes — proven, not merely inferred.** Because the
restriction lives in `USING` (row visibility for the update), not only in `WITH CHECK` (new-row
validation), it blocks ANY UPDATE attempt against an archived row — including one that never
touches `status` at all (e.g. a plain `vin` edit). This was the third live-reproduction case
above (T5 in the new test), and it is what makes archived genuinely, unconditionally immutable
rather than merely "status-change-proof."

**Resulting behavior class**: an UPDATE against an already-archived row is now a **silent 0-row
no-op** (USING excludes it — the same class of behavior already proven for the "wrong advisor"
case in the original Phase 7 RLS test), not a hard RLS error, for every caller.

**Tests**: `094_...` T3 (archive succeeds) / T4 (un-archive attempt is a no-op) / T5 (unrelated
field edit attempt is a no-op); `093_...` re-run unchanged — 12/12 still passing, confirming no
regression to any already-tested legitimate path (including `manage_all`'s own archive action,
T12 in that file, whose sequence never attempts a SECOND write to the row it archives).

---

## C — Field invariants

**The trigger**:

```sql
create or replace function public.repair_orders_enforce_invariants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.identity_status := case when new.zl_number is not null then 'resolved' else 'unresolved' end;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.organization_id := old.organization_id;
    new.branch_id := old.branch_id;
  end if;

  return new;
end;
$$;

create trigger repair_orders_enforce_invariants_trigger
  before insert or update on public.repair_orders
  for each row
  execute function public.repair_orders_enforce_invariants();
```

**`identity_status` handling — exactly the expected invariant, unconditionally recomputed on
every INSERT and UPDATE**: `zl_number IS NULL → 'unresolved'`; `zl_number IS NOT NULL →
'resolved'`. This is not a validation/rejection — it is an authoritative RECOMPUTATION. Whatever
value a client attempts to write to `identity_status` directly is silently discarded and
replaced with the value derived from that same statement's own `zl_number`. Live-proven both
directions: attempting `identity_status='unresolved'` while `zl_number` remains non-null is
overridden back to `'resolved'`; genuinely clearing `zl_number` correctly re-derives
`'unresolved'` (the trigger recomputes correctly for the legitimate case too, it does not simply
freeze the column).

**Immutability rules**:

- `created_by`: on UPDATE, always reset to `OLD.created_by` — a direct attempt to rewrite it is
  silently discarded. On INSERT, unaffected (the inserting statement's own `created_by` value is
  used as given — this is the one and only legitimate write path, matching every service
  method's existing convention of stamping the actor's own id at creation time).
- `organization_id` / `branch_id`: same UPDATE-only freeze-to-`OLD` treatment. Added as a
  cheap, purely defensive measure — the live-reproduced org-move attempt was already blocked by
  RLS in the realistic case (the acting caller lacked a `manage_all` grant in the target org);
  the only remaining theoretical gap (a caller holding `manage_all` in BOTH the source and
  target org simultaneously) is a legitimate multi-org-admin authorization state, not a
  confirmed bypass, and this trigger closes even that edge for free since it already runs on
  every UPDATE for the other two fields.

**`updated_at` is NOT handled by this trigger** — it is unaffected by this migration and
continues to be managed however it already was before this pass (this trigger does not read or
write it).

**Why it does not break the five call sites, with evidence for each**:

- **Manual creation** (`createRepairOrder`): INSERTs with `identity_status` already computed
  app-side from `zl_number`'s presence — the trigger recomputes the identical value on the same
  INSERT statement. No behavior change.
- **Matcher materialization** (`materialize_repair_orders_from_session`): confirmed via
  `pg_get_functiondef` BEFORE writing this migration (not assumed) — this RPC only ever INSERTs
  `repair_orders` rows with `identity_status = 'resolved'` paired with a real, non-null
  `zl_number` (every materialized block is filtered `WHERE b.metadata->>'zl_number' IS NOT
NULL` upstream) — the trigger's recomputation is a no-op match. The RPC's reuse path
  (`already_materialized: true` case) never UPDATEs `repair_orders` at all — it only UPDATEs
  `repair_order_lines.ordered_quantity` — so the trigger's `created_by`/`organization_id`/
  `branch_id` freeze never engages there either.
- **Header edit** (`updateHeader`): its own `identity_status` re-derivation (when `zl_number` is
  in the patch) already agreed with the trigger's computation before this pass — now redundant
  but harmless; the trigger is the authoritative source either way. `updateHeader` never touches
  `created_by`/`organization_id`/`branch_id`, so the freeze never engages.
- **Advisor assignment** (`assignAdvisor`): only ever UPDATEs `advisor_contact_id` — untouched
  by this trigger.
- **Lifecycle change** (`changeStatus`): only ever UPDATEs `status` — `zl_number` is unchanged
  (Postgres UPDATE preserves unspecified columns' existing values), so `identity_status`
  recomputes to the SAME value it already had; `created_by`/`organization_id`/`branch_id` are
  likewise unaffected since they're not part of the patch.

**Tests**: `094_...` T6 (derivation when `zl_number` present) / T7 (a direct desync attempt is
overridden) / T8 (legitimate clearing still works correctly) / T9 (`created_by` immutability).

---

## D — Cross-organization advisor integrity

**Original bug**: `repair_orders.advisor_contact_id` was a simple FK to `crm_contacts(id)` —
`id` alone, with no organization column in the FK at all. No RLS branch (including `manage_all`)
checked the referenced contact's own `organization_id` against the RepairOrder's.

**Live-reproduced**: a synthetic second organization with its own `crm_contacts` row was
created; acting as `manage_all` in the REAL organization, a raw `UPDATE ... SET
advisor_contact_id = <the other org's contact id>` on a real-org RepairOrder succeeded — a
genuine cross-tenant data-integrity violation.

**New `crm_contacts` uniqueness**:

```sql
alter table public.crm_contacts
  add constraint crm_contacts_org_id_unique unique (organization_id, id);
```

`id` alone is already the table's primary key (globally unique), so `(organization_id, id)` is
trivially, automatically unique too — this constraint can never conflict with existing data by
construction, and live-verification before adding it (a direct query joining `repair_orders` to
`crm_contacts` looking for any existing cross-org `advisor_contact_id`) confirmed zero
pre-existing violations regardless.

**New composite FK**:

```sql
alter table public.repair_orders
  drop constraint repair_orders_advisor_contact_id_fkey;

alter table public.repair_orders
  add constraint repair_orders_advisor_contact_id_fkey
  foreign key (organization_id, advisor_contact_id)
  references public.crm_contacts (organization_id, id)
  on delete set null (advisor_contact_id);
```

**Exact FK behavior**: Postgres's default composite-FK match mode is `MATCH SIMPLE` — the
constraint is checked ONLY when ALL of its own columns are non-null. `organization_id` on
`repair_orders` is itself `NOT NULL`, so the only way for the constraint to be "not checked" is
when `advisor_contact_id IS NULL`.

**Null-advisor behavior**: an unassigned order (`advisor_contact_id IS NULL`) is completely
unaffected — the FK is not evaluated at all in that case (`MATCH SIMPLE`, confirmed by live test
T13: clearing to `NULL` still always succeeds).

**When `advisor_contact_id` IS NOT NULL**: BOTH `(organization_id, advisor_contact_id)` must
exist together as a row in `crm_contacts(organization_id, id)` — i.e. the referenced contact
MUST belong to the exact same organization as the RepairOrder. This is enforced at the storage
layer, independent of RLS, role, or permission — it cannot be worked around by any caller,
including a hypothetical service-role/RLS-bypassing path, because it is a table constraint, not
a policy.

**`ON DELETE`/`ON UPDATE` semantics**: `ON DELETE SET NULL (advisor_contact_id)` uses
PostgreSQL 15+'s column-list `SET NULL` syntax (confirmed supported on the live server,
PostgreSQL 17.6) — if the referenced `crm_contacts` row is ever hard-deleted, ONLY
`advisor_contact_id` is set to `NULL`; `organization_id` (which is `NOT NULL` on
`repair_orders`) is correctly left untouched, rather than a tuple-wide `SET NULL` attempting (and
failing) to null a `NOT NULL` column. No explicit `ON UPDATE` clause was added (defaults to `NO
ACTION`) — `crm_contacts.id`/`organization_id` are never updated in place anywhere in this
codebase (both are effectively immutable identity columns), so this was not a live concern.

**Existing-data validation result**: zero existing `repair_orders` rows violated the new
composite FK before it was added (live-verified with a direct query prior to the migration) —
the constraint was added WITHOUT `NOT VALID`, i.e. it was fully validated against live data at
creation time, not merely applied going forward.

**Cross-org tests**: `094_...` T10 (cross-org assignment now rejected with the SPECIFIC expected
SQLSTATE 23503, not just "some error") / T11 (the row's `advisor_contact_id` genuinely never
changed — no partial effect from the rejected attempt) / T12 (a legitimate same-org assignment
still succeeds — the fix is not overly restrictive) / T13 (clearing to `NULL` still always
works).

**The reviewer should be able to verify the FK cannot create a tenant-integrity hole**: because
this is a storage-layer constraint evaluated by Postgres itself on every INSERT/UPDATE
regardless of caller, role, or RLS state, there is no application-level or RLS-level code path
that can bypass it — the only way to defeat it would be to directly disable/drop the constraint
at the schema level, which is a schema-migration action, not a runtime data-access path.

---

## E — Error normalization

**Previous raw error exposure**: `createRepairOrder`, `updateHeader`, `assignAdvisor`,
`changeStatus`, and `listAdvisorCandidates` each returned `error.message` directly (with only
`createRepairOrder`/`updateHeader` special-casing `23505` — the other three had no special
handling at all) for any Supabase/PostgREST error, unlike the curated, allowlist-based
normalization (`normalizeMaterializationRpcError`) already established for the Phase 3
materialization RPC path.

**New normalization strategy**: a single shared helper, applied to all six methods (the five
above plus `getOwnAdvisorContactId`'s own new RPC-error path):

```ts
function normalizeRepairOrderCrudError(
  methodName: string,
  error: { code?: string; message: string }
): string {
  if (error.code === "23505" && error.message.includes("repair_orders_identity_unique")) {
    return "A RepairOrder with this ZL number already exists in this branch";
  }
  if (error.code === "23503" && error.message.includes("advisor_contact_id")) {
    return "The selected advisor is not valid for this organization";
  }
  console.error(`[RepairOrdersService.${methodName}] Unexpected DB error:`, error);
  return "An unexpected error occurred. Please try again or contact support.";
}
```

**Which expected errors are exposed, specifically**: exactly two, both matched by a SPECIFIC
constraint/column signature, not by errcode alone —

1. `23505` on `repair_orders_identity_unique` (duplicate `zl_number` within org+branch) →
   "A RepairOrder with this ZL number already exists in this branch".
2. `23503` referencing `advisor_contact_id` (the new Finding-D composite FK, or any other
   FK-violation involving that column) → "The selected advisor is not valid for this
   organization".

**Generic fallback behavior**: literally everything else — RLS `WITH CHECK` violations,
connection errors, unexpected constraint violations, malformed input the schema layer didn't
catch — becomes exactly one message: "An unexpected error occurred. Please try again or contact
support."

**Server-side logging**: every fallback path logs the FULL, raw, original error object via
`console.error`, tagged with the specific method name that failed (e.g.
`[RepairOrdersService.createRepairOrder] Unexpected DB error: ...`), so nothing is lost for
server-side diagnosis — only the CLIENT-facing string is generic.

**Duplicate-zl_number constraint-specific mapping, and why it cannot be mislabeled**: matched by
the exact constraint name string (`repair_orders_identity_unique`), not by errcode `23505`
alone. `repair_orders` has exactly one other unique-producing constraint (`repair_orders_pkey`,
on `id`), and no client-reachable input path in either `createRepairOrder` or `updateHeader` can
ever supply an `id` value (it is always DB-generated), so a `repair_orders_pkey` collision is not
currently reachable through these methods at all — but the constraint-name match means that even
if it somehow were, or if a future unrelated unique constraint were ever added to this table, it
would correctly fall through to the generic message rather than being mislabeled as a
duplicate-zl_number error. Proven directly by test (a `23505` error citing `repair_orders_pkey`
instead of `repair_orders_identity_unique` correctly does NOT produce the "ZL number" message).

**Tests proving unknown raw DB messages do not reach the client**: 7 new tests in the `error
normalization (Finding E)` describe block, including explicit assertions like `expect(error).
not.toContain("row-level security")`, `.not.toContain("repair_orders")`, `.not.toContain
("constraint")`, `.not.toContain("foreign key")`, and `.not.toBe("connection terminated
unexpectedly")` (the exact raw string never surviving into the returned error) for the
generic-fallback cases.

---

## F — manage_own unassigned create

**Current behavior, verified (not assumed)**: a `manage_own` actor CAN successfully create a
RepairOrder with `advisor_contact_id = NULL` — `repair_orders_insert`'s `WITH CHECK` for the
`manage_own` branch explicitly allows `advisor_contact_id IS NULL OR is_own_advisor_contact
(advisor_contact_id)`, and the manual-creation form's "assign this order to me" checkbox is
opt-in, unchecked by default. Once created this way, that SAME actor cannot subsequently edit
that order via `manage_own` — `repair_orders_update`'s ownership check
(`is_own_advisor_contact(advisor_contact_id)`) can never match a `NULL` `advisor_contact_id`
(the function returns `false` immediately when its argument is `null`).

**This is a genuine product/UX question, not a security bug** — no unauthorized access is
possible either way; the question is purely "should a `manage_own` actor's own creation default
to being editable by them."

**Product options, presented without a silent decision**:

- **(A)** Keep current behavior (unassigned by default) — simplest, no code change, but produces
  orders that sit unmanageable until a `manage_all` admin explicitly assigns an advisor.
- **(B)** Auto-self-assign: default the checkbox to CHECKED (or remove it and always self-assign
  for `manage_own`, with an explicit opt-OUT instead) — the created order is immediately
  editable by its own creator.
- **(C)** Require explicit self-assignment: block submission for `manage_own` until they
  either check "assign to me" or the action rejects the unassigned-creation attempt outright.
- **(D)** Some other design not yet identified.

**OPEN PRODUCT DECISION — not resolved by this pass.** No implementation, test, or migration
exists for Finding F; only this documentation and the matching entries in the Zone 3 tracker
record it.

---

## Questions for external reviewer

1. Is `get_own_advisor_contact_id` safe as `SECURITY DEFINER`?
2. Can the caller influence identity or organization outside the intended scope (of `get_own_
advisor_contact_id`, `is_own_advisor_contact`, or any other function touched by this pass)?
3. Is `archived` now genuinely immutable through the raw Data API, for every caller?
4. Can a legal `open`/`closed` → `archived` transition still succeed for both `manage_own` and
   `manage_all`?
5. Can `identity_status` ever become inconsistent with `zl_number`'s presence, through any path?
6. Can `created_by` be rewritten, through any path?
7. Can `organization_id` or `branch_id` be moved after creation, through any path?
8. Does the invariant trigger interfere with Matcher materialization in any scenario not covered
   by this document's evidence?
9. Can an advisor from another organization still be assigned through ANY path (direct SQL,
   service-role, a future application code path)?
10. Is the composite FK correctly nullable for unassigned orders?
11. Could the new `crm_contacts_org_id_unique` constraint introduce any unintended semantics
    elsewhere in the CRM module (it is additive and derived from an already-unique column, but
    worth an independent check)?
12. Are unexpected database errors still exposed anywhere in the new Phase 7 mutation paths,
    including any path this document did not explicitly enumerate?
13. Does the `23505` mapping correctly distinguish a `zl_number` conflict from an unrelated
    constraint violation on the same table?
14. Does `manage_own` now work fully without `crm.contacts.read`, end to end (not just at the
    RPC level in isolation)?
15. Do the pgTAP tests exercise direct raw UPDATE paths, not only server actions?
16. Are the tests asserting exact resulting row state (or exact SQLSTATE) rather than accepting
    an arbitrary exception as proof of correctness?
17. Is there any remaining technical blocker before Phase 7 manual UAT, given this pass's fixes?
18. Is Finding F correctly left as a product decision rather than treated as a security bug?
19. Did this correction pass accidentally expand scope into Phase 8+ anywhere?
20. Is any other Phase 7 direct-Data-API bypass still visible after this pass, beyond the six
    findings addressed here?

---

## Test evidence

- `094_repair_orders_correction_pass_rls_test.sql` (new, live, as `authenticated`): **13/13
  passing**, zero residual data after `ROLLBACK`.
- `093_repair_orders_header_ownership_rls_test.sql` (pre-existing, re-run unchanged after the
  `repair_orders_update` policy rewrite): **12/12 still passing** — no regression.
- Full Zone 3 automated suite (ten Vitest test files run together): **136/136 passing**.
- CRM sibling service tests (`crm-contacts.service.test.ts`, `crm-parties.service.test.ts` — not
  changed by this pass, re-run as a regression check against the new `crm_contacts_org_id_
unique` constraint and composite FK): **10/10 passing**.
- `pnpm type-check`: clean (exit 0).
- `pnpm lint` (ESLint): clean on every new/changed file.

**Test files touched by this pass** (exact list):

- `apps/web/src/server/services/__tests__/repair-orders.service.test.ts` (modified)
- `apps/web/src/app/[locale]/dashboard/workshop/[id]/_components/__tests__/repair-order-header-editor.test.tsx` (modified)
- `apps/web/supabase/tests/094_repair_orders_correction_pass_rls_test.sql` (new)

**`apps/web/supabase/tests/093_repair_orders_header_ownership_rls_test.sql` was re-run as a
regression check but NOT modified** — it is unchanged from the original Phase 7 bundle and is
therefore not part of this correction-pass diff.

**Browser E2E was not run, and is not claimed to have passed.** Manual UAT of Phase 7's UI
(create, edit header, assign/reassign advisor, close/reopen/archive) remains outstanding,
unchanged by this pass — this document does not represent it as done.
