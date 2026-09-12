# Zone 3 Phase 7 Final Narrow Pass — Review Context

**Purpose of this document**: the reviewer has already approved the earlier Phase 7 correction
pass except for the final narrow findings covered here. This document explains **only** what
changed in this final narrow pass. Read alongside `zone3-phase7-final-corrections.diff` (the
code) and `changed-files.md` (the per-file manifest).

---

## Baseline reconstruction method

To isolate this final pass alone, the exact "Phase 7, after the first correction pass, before
this final narrow pass" state was reconstructed without touching the active implementation
worktree:

1. Created an isolated temporary git worktree (`git worktree add --detach`) at `HEAD`
   (`00221132`, "docs update").
2. Applied, in order: the ORIGINAL Phase 7 review bundle's diff
   (`docs/mvp/reviews/zone3-phase7-review/zone3-phase7.diff`), then the FIRST correction pass's
   diff (`docs/mvp/reviews/zone3-phase7-correction-review/zone3-phase7-corrections.diff`) — both
   applied cleanly via `git apply`, no conflicts, no manual edits.
3. Committed the resulting tree in the temporary worktree (`--no-verify`, to avoid this repo's
   `pnpm install`/husky hooks firing inside a throwaway worktree) as reconstruction commit
   `1b6d134c` — by construction, byte-for-byte "Phase 7 + first correction pass, exactly as
   previously bundled and approved."
4. Diffed the CURRENT (main worktree) state against that commit, scoped to the file areas this
   final pass could plausibly touch.
5. Removed the temporary worktree after extracting the diff.

**A genuine, disclosed isolation gap**: an UNRESTRICTED diff against the same baseline commit
additionally shows six files with PURE Prettier-formatting differences (line-wrapping only —
every hunk was read and confirmed to carry zero logic/semantic change): `repair-order-header-
editor.tsx`, `new-repair-order-form.tsx`, `lib/types/repair-orders.ts`, `lib/validations/repair-
orders.ts`, `repair-orders.service.ts`, `repair-orders.service.test.ts`. None of these files were
edited by this final narrow pass — no Edit or Write call this pass targeted any of them. This
formatting drift predates this pass (most likely an editor/IDE auto-format-on-save or an
out-of-band formatter run against the working tree at some point after the first correction pass
was bundled) and is unrelated to the security/correctness content of either correction pass.
Per this task's explicit instruction to include a file "ONLY if it was genuinely changed by this
final pass," these six files are **deliberately excluded** from `zone3-phase7-final-
corrections.diff`. The scoped diff below is therefore an exact, complete isolation of this final
pass's own work — 4 files, matching the expected "very small" scope exactly.

---

## A — `created_by` INSERT spoof

**Exact live reproduction**: as `authenticated`, holding `workshop.repair_orders.manage_all` +
`.read`, a raw `INSERT INTO repair_orders (..., created_by) VALUES (..., <a different real
organization member's user id>)` was executed and committed within a `BEGIN;...ROLLBACK;`
transaction.

**`manage_all` result**: the INSERT succeeded, and `created_by` persisted as the OTHER user's id
— not the actor's own id. The actor (a real user, distinct from the id they supplied) had
successfully authored a RepairOrder under someone else's name.

**`manage_own` result**: identical outcome — re-ran the same spoof attempt as `authenticated`
holding only `workshop.repair_orders.manage_own` + `.read` (with a valid self-assigned
`advisor_contact_id` so the INSERT's other `WITH CHECK` conditions were satisfied). The spoof
succeeded there too, proving the gap was not narrowed to either permission tier.

**Why RLS did not prevent it**: `repair_orders_insert`'s `WITH CHECK` (as it stood after the
first correction pass) validates permission grants and advisor-ownership consistency
(`advisor_contact_id IS NULL OR is_own_advisor_contact(advisor_contact_id)`, for the
`manage_own` branch) — it contains no clause referencing `created_by` at all. The field-
invariants trigger added in that same pass (`repair_orders_enforce_invariants`, migration
`20260911183709`) only reset `created_by` inside its `elsif tg_op = 'UPDATE'` branch; its INSERT
handling touched only `identity_status`. `NEW.created_by` therefore reached the actual row
write completely unexamined by either RLS or the trigger when the operation was an INSERT.

**Final DB invariant**: for any RepairOrder INSERTed through an authenticated session,
`created_by` must represent the authenticated actor (`auth.uid()`), never a value the client
supplied — enforced unconditionally, at the trigger layer, independent of which RLS branch
(`manage_own`/`manage_all`) admitted the row.

**Exact trigger semantics (the new INSERT branch, added to the existing function)**:

```sql
if tg_op = 'INSERT' then
  new.created_by := coalesce(auth.uid(), new.created_by);
elsif tg_op = 'UPDATE' then
  new.created_by := old.created_by;
  new.organization_id := old.organization_id;
  new.branch_id := old.branch_id;
end if;
```

**Why `COALESCE(auth.uid(), NEW.created_by)` means "authenticated insert → actor wins, no-auth/
service context → supplied value remains available"**: `COALESCE` evaluates its arguments left
to right and returns the first non-null one.

- When the INSERT happens inside an authenticated PostgREST/Supabase request, `auth.uid()`
  resolves to a real, non-null user id (read from the request's JWT-claim GUC) — `COALESCE`
  returns THAT value immediately, discarding whatever `NEW.created_by` the client attempted to
  supply. The actor's real identity always wins over any client-supplied value in this case,
  with no exception.
- When there is no authenticated session at all — a direct `service_role`/`postgres` connection
  with no `request.jwt.claims` GUC set, which is how a fully-trusted backend-only job would
  connect — `auth.uid()` itself returns `NULL`. `COALESCE` then falls through to its second
  argument, `NEW.created_by`, preserving exactly whatever that trusted caller explicitly
  supplied (including `NULL` itself, if that's what was supplied, since the column is nullable).

**Assumptions this relies on** (stated explicitly, not left implicit):

1. `auth.uid()` is a session-scoped GUC read, not affected by a function's own `SECURITY
DEFINER`/`SECURITY INVOKER` attribute — verified true for this codebase's existing pattern
   (`materialize_repair_orders_from_session`'s own `p_actor_user_id = auth.uid()` guard already
   depends on, and confirms, this same fact).
2. No current or planned legitimate code path performs an authenticated (PostgREST/session-
   backed) INSERT on behalf of a DIFFERENT user than the session's own identity — if such a path
   is ever intentionally needed (e.g. an admin explicitly creating a record "on behalf of"
   someone else), it does not exist today and would need its own deliberate design, not a bypass
   of this trigger.
3. `repair_orders.created_by`'s existing FK to `users(id)` and nullability are unchanged by this
   migration — the fix only changes WHICH value is written, never the column's shape or
   constraints.

---

## B — Advisor-contact cardinality verification

**No implementation change.**

**Exact existing constraint/index name**: `crm_contacts_org_linked_user_unique` — a partial
unique index, live since Phase 2's original CRM module migration (per that phase's own
architecture-doc "Correction 2" decision, predating both Phase 7 and both of its correction
passes by roughly two months in this project's synthetic migration timeline).

**What it guarantees**: `UNIQUE (organization_id, linked_user_id) WHERE linked_user_id IS NOT
NULL AND deleted_at IS NULL` — at most one ACTIVE (non-soft-deleted) `crm_contacts` row may be
linked to any given user within any given organization. A user may still have MULTIPLE
`crm_contacts` rows linked to them across DIFFERENT organizations (unrestricted), or have a
previously-linked, now soft-deleted row coexist with a new active one (also unrestricted, and
irrelevant here since every lookup this pass is concerned with already filters `deleted_at IS
NULL`) — only "two simultaneously ACTIVE contacts, same user, same org" is forbidden.

**Live duplicate data result**: a direct query grouping `crm_contacts` by `(organization_id,
linked_user_id)` where `linked_user_id IS NOT NULL AND deleted_at IS NULL`, filtered to groups
with `count(*) > 1`, returned zero rows — no existing duplicate active linkage anywhere in the
live database.

**Attempted duplicate insert result**: a direct, live attempt (in a rolled-back transaction) to
INSERT a second active `crm_contacts` row linked to the SAME user in the SAME organization as an
already-existing active linked contact failed immediately with:

```
ERROR: 23505: duplicate key value violates unique constraint "crm_contacts_org_linked_user_unique"
DETAIL: Key (organization_id, linked_user_id)=(...) already exists.
```

**Why `get_own_advisor_contact_id` remains safe/deterministic**: its `WHERE organization_id =
p_organization_id AND linked_user_id = (select auth.uid()) AND deleted_at IS NULL LIMIT 1` can,
by this constraint, match AT MOST ONE row — the `LIMIT 1` is never actually resolving an
"arbitrary pick among several" scenario, because there is never more than one candidate row to
begin with. The reviewer's hypothesized "contact A vs. contact B, same user, same org, one
referenced by a RepairOrder's `advisor_contact_id`, the other returned by the lookup" scenario is
therefore structurally impossible under the live schema, today. `is_own_advisor_contact(contact_
id)` and `get_own_advisor_contact_id(org)` cannot disagree about which contact is "the" caller's
own linked contact in a given organization, because there is only ever zero or one candidate for
either function to consider.

---

## C — Org/branch immutability tests

Two new pgTAP assertions were added to `094_repair_orders_correction_pass_rls_test.sql`,
committing what the prior correction pass had only spot-checked ad hoc:

- **T16**: as `manage_all`, `UPDATE repair_orders SET organization_id = <a different,
synthetic organization's id> WHERE id = <existing row>` is executed, then the row's
  `organization_id` is re-selected and asserted `= <the original organization>` (exact value
  equality, not merely "no exception was thrown"). The UPDATE statement itself does not raise —
  Postgres BEFORE-row triggers run before RLS's `WITH CHECK` is evaluated against the final row,
  so `repair_orders_enforce_invariants` resets `organization_id` back to `OLD.organization_id`
  before `WITH CHECK` ever sees the attempted new value; the statement is a real, successful
  0-effective-change UPDATE on this column, not a caught error.
- **T17**: identical proof for `branch_id`, using the synthetic org's own branch as the attempted
  (invalid) target, asserting the persisted `branch_id` equals the original branch exactly.

Both assertions read the actual persisted column value after the UPDATE and compare it via
pgTAP's `is()` (exact equality), not `throws_ok()`/`lives_ok()` — proving genuine row-state
immutability, not merely the absence or presence of an error.

---

## D — `SECURITY DEFINER` grants

**Actual grants on `get_own_advisor_contact_id`**: `EXECUTE` granted to `PUBLIC`, `anon`,
`authenticated`, `postgres`, and `service_role` — i.e., Postgres's default privilege set for a
newly created function, never explicitly `REVOKE`d from anyone.

**Peer-function convention**: queried the identical grant shape for `is_own_advisor_contact`
(this function's direct sibling from the first correction pass) and `repair_orders_enforce_
invariants` (the trigger function) — both show the exact same unrevoked-default grant pattern.
This repository's established convention for this class of narrow, identity-scoped `SECURITY
DEFINER` helper is to leave default privileges in place, not to `REVOKE ... FROM PUBLIC` and
re-`GRANT` more narrowly.

**`anon` behavior**: `auth.uid()` returns `NULL` for any caller with no authenticated JWT
session (which is what `anon` is, by definition). `linked_user_id = (select auth.uid())`
therefore evaluates `linked_user_id = NULL`, which is never `true` in SQL regardless of what
`linked_user_id` actually contains — the function returns `NULL` for `anon`, unconditionally,
regardless of the `p_organization_id` argument supplied. An `anon` caller learns nothing about
any organization's existence, structure, or contents by invoking this RPC.

**Authenticated-caller-without-relevant-Workshop-permission behavior**: such a caller CAN invoke
the RPC and CAN get back a non-null result — but only ever THEIR OWN linked contact id in the
organization they specify, never another user's. This is not a privilege escalation: it is
functionally equivalent to a user being able to know their own identity, which requires no
special permission grant in the first place. The RPC was never intended as a Workshop-permission-
gated operation (it is a generic "resolve my own CRM linkage" primitive), so its being reachable
without a Workshop permission is by design, not an oversight.

**Why no grant change was made**: the current grants match established repository convention
exactly (identical to the already-accepted `is_own_advisor_contact`), and the function is
provably harmless to every class of caller examined — `anon` gets nothing, and any authenticated
caller gets only information about themselves. Per the explicit instruction not to invent
stricter rules than peer RPCs without evidence, and given no such evidence was found, the grants
were left unchanged.

---

## E — Final test state

- `094_repair_orders_correction_pass_rls_test.sql`: **17/17** passing live (expanded from 13),
  zero residual data after `ROLLBACK`.
- `093_repair_orders_header_ownership_rls_test.sql`: re-run **unchanged** (not modified by this
  pass) — **12/12** still passing, confirming no regression from the `created_by` trigger fix.
- Full Zone 3 + CRM sibling Vitest suite (twelve test files run together — ten Zone 3 files plus
  `crm-contacts.service.test.ts` and `crm-parties.service.test.ts` as a regression check): **146/
  146** passing. No application/TypeScript file required a change for this pass's two fixes
  (both were pure DB-side); the 146 count is identical to the prior correction pass's own count,
  confirming nothing regressed and nothing new was needed at that layer.
- `pnpm type-check`: **clean**.
- `pnpm lint` (ESLint): **clean** on every file this pass actually touched.

---

## F — Remaining product decisions

Both of the following remain **PRODUCT decisions, not technical blockers** — neither was touched,
narrowed, or resolved by this pass or the one before it:

1. **`manage_own` creating an unassigned RepairOrder** (Finding F from the first correction
   pass): a `manage_own` actor can create a RepairOrder with `advisor_contact_id IS NULL` (the
   manual-creation form's self-assign checkbox is opt-in, unchecked by default), producing an
   order its own creator cannot subsequently edit via `manage_own`. Four options were recorded
   (keep as-is; auto-self-assign; require explicit self-assignment; another design) — none
   chosen.
2. **Advisor-picker "employee-role" scoping** (from the original Phase 7 implementation): the
   architecture doc's literal `crm_party_roles.role = 'employee'` scoping is not implementable
   against the live schema (`crm_party_roles` is party-level, not contact-level); an interim,
   reversible `linked_user_id IS NOT NULL` signal is used instead. Whether to build the full
   employee-role scheme, or accept the interim signal permanently, remains open.

Neither item represents unauthorized access, a data-integrity gap, or any other technical defect
— both are pure UX/product-design questions sitting on top of already-correct, already-verified
security enforcement.

---

## Questions for external reviewer

1. Does the INSERT trigger now fully prevent authenticated `created_by` spoofing?
2. Is `COALESCE(auth.uid(), NEW.created_by)` safe for expected system/service paths?
3. Could any authenticated `SECURITY DEFINER` path unintentionally overwrite a legitimate
   system-created author?
4. Is `crm_contacts_org_linked_user_unique` sufficient to justify the single-id own-advisor
   lookup design?
5. Is the uniqueness limited to active contacts in the intended way?
6. Do T16/T17 genuinely prove organization/branch immutability?
7. Are all earlier Phase 7 findings still covered after this migration?
8. Is there any remaining technical blocker before manual UAT?
9. Are the two remaining open items correctly classified as product decisions?
10. Was any Phase 8+ work accidentally included?
