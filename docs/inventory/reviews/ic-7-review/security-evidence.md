# IC-7 Security Evidence

Every finding below was reproduced live (transaction-scoped, rolled back)
before being fixed, and re-verified live after the fix. This is the
central evidence file for IC-7's own 9 migrations.

## 1. `inventory_cancel_movement` — fully unauthenticated, cross-tenant exploit (CRITICAL)

**Pre-fix**: `SECURITY DEFINER` (bypasses RLS), zero actor-identity check,
zero permission check, live `anon` + `authenticated` EXECUTE. Live
`pg_get_functiondef` confirmed the function looked up a movement purely
by `id` (no org/branch scoping in the query itself) and had no
`auth.uid()` comparison anywhere in its body.

**Reproduced live**: an `anon` session (zero JWT claims, zero
authentication of any kind) called `inventory_cancel_movement` directly
— succeeded before the fix (confirmed by a background investigation
agent's own live probe, see its full report in this session's
transcript). This means literally any internet visitor could cancel any
DRAFT movement in ANY organization, just by supplying/guessing a
movement UUID.

**Fixed**: `20260917145915_ic7_cancel_movement_add_actor_and_permission_check.sql`
— added the standard actor-identity (`28000`) + permission (`42501`,
surfaced as the non-leaking `P0002` "not found or not accessible"
message, matching `inventory_reverse_movement`'s own established
pattern) checks; explicitly revoked `anon`/`PUBLIC` EXECUTE.

**Post-fix live verification**:

- `anon` call → `42501 permission denied for function inventory_cancel_movement` (grant-level, doesn't reach the body).
- Authenticated caller passing a spoofed `p_actor_user_id` → `28000`.
- Authenticated caller with zero branch permission, real actor id → `P0002` (identical message to "not found").
- Legitimate cancel (real actor, real permission, draft-status target) → succeeds unchanged.

## 2. Posted-header GUC "authorization" — structural bypass (CRITICAL, long-disclosed)

**Pre-fix**: `inventory_prevent_header_modification`/`inventory_prevent_line_modification`
only checked `current_setting('ambra.inventory_movement_engine', true) != 'on'`
— never which columns changed, never who the caller is. Any
`authenticated` actor holding `warehouse.inventory.operate`/`.adjust`/
`.reverse` could self-set that ordinary session GUC and raw-UPDATE ANY
column (document_number, movement_type_code, quantities, organization_id)
of ANY posted header. Disclosed since before IC-2, explicitly assigned
to full IC-7 by every intervening phase.

**Reproduced live** (fresh, not trusted from any prior report): posted a
real receipt, then with the GUC deliberately set `'on'`, raw-`UPDATE`d
`document_number` — succeeded pre-fix. Separately reproduced an even
more severe variant (see item 3) where the GUC did not even need to be
touched at all.

**Fixed**: `20260917150029_ic7_close_posted_header_guc_bypass.sql` — the
GUC was removed ENTIRELY as an authorization signal for these two
triggers. Authorization is now based purely on the SUBSTANCE of the
change: once a header is `posted`/`cancelled`/`reversed`, the ONLY
value-changing transition ever permitted is EXACTLY the accepted
reversal lifecycle (`status: posted→reversed`, `reversal_movement_id`/
`reversed_by`/`reversed_at` going from `NULL` to real values, every
OTHER column byte-identical to `OLD` — verified via `to_jsonb(NEW) -
{...allowed keys...} = to_jsonb(OLD) - {...allowed keys...}`, robust
against future column additions since it doesn't hand-enumerate the
table's 40 columns) AND the new `reversal_movement_id` must genuinely
double-link back to a real row with `original_movement_id = OLD.id` AND
`movement_type_code = '900'` (the system reversal type, which
`inventory_create_draft` already rejects manual creation of — IC-7A's
own closed contract). Live-verified against `inventory_reverse_movement`'s
own current body that it inserts the reversal row FIRST (with
`original_movement_id` already set), finalizes it, THEN performs this
exact narrow UPDATE — in that order, in the same transaction — so the
`EXISTS` check always sees a real, already-committed reversal row for
any genuine reversal. `inventory_movement_lines`' own trigger was
simplified further: since NO legitimate path ever updates/deletes an
existing line after posting (confirmed by reading `inventory_reverse_
movement` and `inventory_finalize_posting_internal`'s own bodies in
full — the only line-touching UPDATE inside finalize happens while the
header is still `'draft'`), the GUC-gated exception was removed
entirely — unconditional denial once posted.

**Post-fix live verification** (see `110_...` Scenarios A/B/C/D):

- Raw `UPDATE` with ZERO GUC manipulation at all → `42501`.
- Raw `UPDATE` with the GUC deliberately set `'on'` → still `42501` (proves the fix is structural, not GUC-state-dependent).
- A forged "already reversed" state (`status='reversed'`, `reversal_movement_id` = an arbitrary/unrelated UUID) → `42501` (the `EXISTS` double-link check fails).
- `movement_type_code` UPDATE (not just `document_number`) → `42501`.
- Legitimate `inventory_reverse_movement` call → still succeeds, `status` correctly transitions to `reversed`.
- Raw line `UPDATE`/`DELETE` after posting → denied (see item 8 for the exact mechanism).

## 3. Systemic NULL-comparison fail-open bug (CRITICAL, newly discovered this phase)

**Discovered while investigating item 2**: `inventory_guard_balance_write`/
`inventory_guard_settings_write` used `current_setting('ambra.inventory_
movement_engine', true) <> 'on'` as their enforcement condition. When
the GUC has NEVER been set at all in the current session (the ORDINARY
DEFAULT state for any raw client connection — no GUC-setting trick
required), `current_setting(..., true)` returns SQL `NULL`. `NULL <>
'on'` evaluates to `NULL`, and PL/pgSQL's `IF NULL THEN ... END IF`
treats `NULL` as `FALSE` — so the `RAISE EXCEPTION` was silently
skipped. **The guard failed OPEN, not closed** — this is MORE severe
than the already-known GUC-bypass-via-deliberate-SET, since it required
NO special knowledge of the GUC's own name at all.

**Reproduced live, isolated from cross-transaction contamination**
(an earlier, contaminated test run had falsely appeared to show the fix
not working, traced to the SAME `SET LOCAL` persists-for-the-rest-of-
the-transaction artifact this project has documented repeatedly — fixed
by re-testing in a properly isolated transaction where the GUC was
NEVER touched by any prior statement): a fresh transaction, a
pre-seeded balance row (inserted as `postgres`, simulating a row from
a prior, separate legitimate transaction), then as an ordinary
`operate`-permissioned `authenticated` actor, the VERY FIRST statement
in the transaction was `UPDATE inventory_balances SET on_hand_quantity
= 999999 ...` — this SUCCEEDED pre-fix. This is arguably the single
most severe finding of this entire phase: IC-1's own hard stock
invariants (the reason this whole consolidation effort exists) could
be bypassed by ANY operate-permissioned user with a single raw UPDATE
statement, no special knowledge required.

**Fixed**: `20260917150202_ic7_fix_null_comparison_fail_open_guard_triggers.sql`
— `COALESCE(current_setting(...), 'off') <> 'on'`. Every legitimate
canonical RPC already explicitly sets this GUC to `'on'` before
writing (confirmed live across every balance-touching primitive), so
this fix changes zero legitimate behavior — it only closes the
"never touch the GUC" bypass.

**Post-fix live verification**: the identical fresh-transaction,
zero-GUC-contact raw UPDATE now fails with `P0001: inventory_balances
can only be changed by the movement engine`. Legitimate receipt via
`inventory_create_and_finalize` still correctly increases `on_hand_
quantity`.

## 4. `inventory_save_draft` — same unauthenticated exploit as item 1

**Pre-fix**: identical shape to `inventory_cancel_movement` — `SECURITY
DEFINER`, zero actor-identity check, zero permission check, live `anon`
EXECUTE. Could rewrite any DRAFT movement's own counterparty/reference/
note/lines in any organization, unauthenticated.

**Fixed**: `20260917150506_ic7_harden_save_draft_and_reconcile_balances.sql`
— same actor+permission pattern as item 1.

**Post-fix live verification**: legitimate save-draft (real actor) still
correctly updates a draft's own counterparty name; `anon` call now
`42501` at the grant level.

## 5. `inventory_reconcile_balances` — unauthenticated cross-tenant read

**Pre-fix**: pure read-only diagnostic (`LANGUAGE sql`, no writes at
all) but carried live `anon` EXECUTE with zero actor/permission check —
any unauthenticated caller could read ANY organization's stock-vs-ledger
drift diagnostic for ANY branch/org id supplied.

**Fixed**: same migration as item 4 — converted from `LANGUAGE sql` to
`LANGUAGE plpgsql` (pure SQL functions cannot branch/raise) solely to
add the standard actor+permission check; the diagnostic query itself is
byte-for-byte unchanged. Required dropping the old 2-arg signature and
creating a new 3-arg one (actor param added) — the old-arity overload
was explicitly `DROP FUNCTION`ed in the same migration (this project's
own recurring "stale overload" pitfall, avoided proactively here).
Confirmed zero application callers exist for this function (repo-wide
grep), so the signature change carries zero TypeScript impact.

**Post-fix live verification**: `anon` call now `42501` at the grant
level; old 2-arg signature confirmed absent (`to_regprocedure` NULL).

## 6. Reservation/allocation/container raw-write RLS gap (long-disclosed, IC-0's own finding)

**Pre-fix**: `inventory_reservations`, `inventory_reservation_lines`,
`inventory_allocations`, `inventory_allocation_lines` each carried only
a single `PERMISSIVE ALL` policy gated on `warehouse.inventory.operate`
— no `RESTRICTIVE`, ownership-aware policy. `inventory_containers`/
`inventory_container_lines`'s own generic (non-RepairOrder-owned) rows
had the identical gap. Disclosed since IC-0 (2026-09-15), explicitly
deferred to full IC-7 by every intervening phase. Empirically confirmed
live (both by direct `pg_policies` inspection and by raw-DML probes as
a real `operate`-permissioned actor) immediately before this fix: raw
`INSERT`/`UPDATE`/`DELETE` all succeeded on all 6 tables.

**Fixed**: `20260917150706_ic7_reservation_allocation_container_
restrictive_rls.sql` — the exact, already-proven-safe `RESTRICTIVE
USING(false)/WITH CHECK(false)` pattern IC-4 applied to branch
transfers and IC-5 applied to the RepairOrder projection tables,
applied to all 6 tables' own `INSERT`/`UPDATE`/`DELETE`. Existing
`PERMISSIVE` policies (and scoped `SELECT` policies) left untouched.

**A genuine complication discovered while applying this fix**:
`inventory_create_reservation`/`inventory_release_reservation`/
`inventory_create_allocation`/`inventory_release_allocation` turned out
to be `SECURITY INVOKER` (the implicit Postgres default — no `SECURITY
DEFINER` clause), out of compliance with this project's own standing
convention. Since `SECURITY INVOKER` functions run AS the calling role
and are themselves subject to RLS, the new `RESTRICTIVE` policies
correctly blocked ordinary raw client writes but ALSO blocked these
4 RPCs' own legitimate `INSERT`/`UPDATE` calls (live-reproduced: the
first attempt to run the legitimate reservation-creation flow after
applying the RLS migration failed with `42501: new row violates row-
level security policy`). Fixed in the SAME phase (not deferred) by
converting all 4 to `SECURITY DEFINER` with the standard actor-identity
check added (`20260917150959_ic7_harden_reservation_allocation_
rpcs.sql`) — see item 7.

**Post-fix live verification**: raw `INSERT` on all 6 tables → `42501`;
raw `UPDATE`/`DELETE` on all 6 → 0 rows affected. Legitimate
reservation → allocation → container-creation → release-allocation →
release-reservation chain re-run end to end, succeeds unchanged.

## 7. Reservation/allocation RPCs — `SECURITY INVOKER`, no actor-identity check

**Pre-fix**: all 4 functions (`inventory_create_reservation`,
`inventory_release_reservation`, `inventory_create_allocation`,
`inventory_release_allocation`) were `SECURITY INVOKER`, out of
compliance with the project's own standing convention ("SECURITY
DEFINER, owner postgres..." — `inventory-core-architecture.md` §9).
None validated `p_actor_user_id` against `auth.uid()` — accepted and
used only to stamp `created_by`/`cancelled_by`. `inventory_release_
reservation`/`inventory_release_allocation` ALSO had a cross-org
existence-leak: "not found" and "found but no permission" raised two
DIFFERENT error messages.

**Fixed**: `20260917150959_ic7_harden_reservation_allocation_rpcs.sql`
— converted all 4 to `SECURITY DEFINER` (required for item 6's own RLS
fix to not break their legitimate writes — same-owner `SECURITY
DEFINER` nesting means `postgres`-owned callers always have implicit
EXECUTE regardless of nested-function grants, so this conversion was
necessary, not merely a hardening nicety), added the standard actor-
identity check as the first line, unified the release functions' own
error messages to the single `P0002` non-leaking pattern. All business
logic (settings/numbering, balance locking, reservation/allocation line
math, hard-reservation/allocation invariant checks) is byte-for-byte
unchanged. Confirmed all 4 real TypeScript callers
(`InventoryEnterpriseService`'s own 4 methods, `RepairOrdersService`'s
own `reserveForLine`/`allocateForLine`/`releaseReservationForLine`)
already pass a real, session-resolved actor id (`userIdFrom(auth)`/
`actorUserId`), so the new strict check breaks nothing.

**Post-fix live verification**: full legitimate reservation → allocation
→ release chain succeeds unchanged; raw writes to all 4 backing tables
now correctly denied (see item 6).

## 8. Movement-header/line status-blind raw `INSERT` gap (IC-0's own finding)

**Pre-fix**: `inventory_movement_headers`/`inventory_movement_lines`'s
own `INSERT` `WITH CHECK` clauses were purely permission-based, zero
awareness of the `status` column. Live-confirmed: an `operate`-
permissioned actor could raw-`INSERT` a fully fabricated `status=
'posted'` header (fake document number, no real ledger entries).
ALSO extends to lines: since the immutability trigger only fires on
`UPDATE`/`DELETE` (never `INSERT`), a raw client could `INSERT` a
brand-new line under an EXISTING, genuinely-posted `movement_id`,
appearing to add quantity to a real document without ever tripping the
immutability guard — a genuinely new discovery this phase, extending
IC-0's own original header-only finding.

**Fixed**: `20260917151236_ic7_close_status_blind_insert_gap.sql` — a
`RESTRICTIVE` policy on each table's own `INSERT` requiring the new row
(or, for lines, its own parent header) to be in `'draft'` status —
matching the only-ever-true shape of every legitimate `INSERT` (every
canonical RPC creates a movement as `'draft'` first; the transition to
`'posted'` happens exclusively via `UPDATE` inside `inventory_finalize_
posting_internal`, itself `SECURITY DEFINER` and therefore unaffected
by this ordinary-role-scoped policy).

**Post-fix live verification**: a fabricated `status='posted'` header
`INSERT` → `42501`; a fabricated new-line `INSERT` under a real, already-
posted `movement_id` → `42501`. Legitimate draft creation (via
`inventory_create_draft`/`inventory_create_and_finalize`) still succeeds
unchanged.

## 9. `inventory_approve_count_session` — missing actor-identity check, live `anon` EXECUTE

**Pre-fix**: accepted `p_actor_user_id` without ever validating it
against `auth.uid()` (unlike its own nested calls into `inventory_
create_draft`/`inventory_finalize_posting`, which DO check it — but
only when the increase/decrease line arrays are non-empty; a zero-net-
variance approval never reaches those nested calls, leaving a narrow
actor-spoofing gap on the `approved_by` audit column). Carried live
`anon` EXECUTE despite its own `has_branch_permission` check (which
should already reject a true `anon` caller in practice, but was not
explicitly hardened per the project's own standing convention).

**Fixed**: `20260917151417_ic7_harden_approve_count_session.sql` —
added the standard actor-identity check as the first line; explicitly
revoked `anon`/`PUBLIC` EXECUTE. Remains `SECURITY INVOKER` (unchanged)
— its own nested calls into the hardened engine already provide the
real security boundary for any non-trivial approval; this closes the
audit-trail gap and removes the unnecessary `anon` exposure. Business
logic (all-or-nothing posting gate, movement-type seeding) byte-for-byte
unchanged. Confirmed the real TypeScript caller (`InventoryCountSessions
Service.approveCountSession`, called from `approveInventoryCountSession
Action`) already passes `userIdFrom(auth)`.

**Post-fix live verification**: grants confirmed (`anon_exec=false`,
`authenticated_exec=true`).

## 10. Grant hygiene — internal helper + trigger functions

**Pre-fix**: `inventory_get_or_create_balance_for_update` (the shared,
internal-only balance-getter every canonical RPC calls internally) and
8 trigger functions (`RETURNS trigger`, not meaningfully callable via
PostgREST's RPC surface at all) carried live `anon`/`PUBLIC` EXECUTE.

**Fixed**: `20260917151537_ic7_grant_hygiene_internal_helper_and_
triggers.sql` — `anon`/`PUBLIC` revoked from all 9. `inventory_get_or_
create_balance_for_update` kept callable by `authenticated`/`service_
role` explicitly (not fully internalized, since it is not itself
`SECURITY DEFINER` and full internalization was not verified safe
against every possible direct caller in this narrow pass). Revoking
these grants does not affect any legitimate internal caller: every
caller is itself `SECURITY DEFINER` owned by `postgres`, so nested
calls execute with `postgres`'s own effective identity (which always
implicitly has EXECUTE on everything it owns) regardless of the
callee's own explicit grants — the same same-owner nesting semantics
already relied on for `inventory_finalize_posting_internal`.

**Post-fix live verification**: a full legitimate receipt (which
internally calls this helper) still succeeds; `on_hand_quantity`
correctly updates.

## Default-privilege systemic decision (§16/17/22/23) — Option B chosen

**Root cause** (confirmed by IC-7A, re-confirmed this phase): `pg_
default_acl` shows `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN
SCHEMA public GRANT EXECUTE ... TO anon, authenticated, service_role`
— schema-WIDE, not Inventory-specific. This is why `CREATE OR REPLACE
FUNCTION` keeps re-exposing `anon` on every replaced function unless
explicitly `REVOKE`d afterward.

**Live audit performed this phase** (the step IC-7A explicitly deferred):
queried every `anon`-executable function in `public` OUTSIDE the
Inventory/RepairOrder domain — found dozens of genuinely, deliberately
public-facing functions across unrelated modules: invitation acceptance
(`accept_invitation_and_join_org`, `decline_invitation`, `check_
invitation_eligibility`, `get_invitation_preview_by_token`), signup/org-
creation (`handle_user_signup_hook`, `create_organization_for_current_
user`, `check_org_slug_available`), plus dozens more across warehouse
layouts, planning, CRM, helpdesk. Many of these are legitimately meant
to be callable pre-authentication (invitation/signup flows) — this is
NOT a bug, it's how those flows work.

**Decision: Option B** — retain the schema-wide default privilege
(changing it would require auditing every one of these unrelated
modules, far beyond this phase's own Inventory Core scope, and IC-7A's
own prior investigation already found this exact risk). Instead: (1)
every Inventory Core function this phase touched was given an explicit
`REVOKE ALL FROM PUBLIC, anon` in its own migration, matching the
established per-function convention; (2) the new `110_...` pgTAP file's
own Scenario N and the broader grant-matrix sweep (see `function-grant-
matrix.md`) serve as the "stronger automated test that detects any
Inventory function with unexpected anon/PUBLIC EXECUTE" the task's own
§36 requires — this is now a permanent, re-runnable regression check,
not "remember to revoke" human discipline alone.

## Remaining open findings at original IC-7 sign-off (SUPERSEDED — see "IC-7 CLOSING PASS" section below)

- `inventory_create_enhanced_product`, `inventory_create_product_with_
default_variant`, `inventory_create_purchase_order`, `inventory_
create_valuation_snapshot`, `inventory_create_count_session`,
  `inventory_count_session_list`, `inventory_find_sku_collisions` — all
  carry live `anon`/`PUBLIC` EXECUTE and lack an actor-identity check
  (though most have a `has_permission`/`has_branch_permission` check
  that likely rejects a true `anon` caller in practice). These are
  PRODUCT-CATALOG/PROCUREMENT/AUDIT-domain concerns (product creation,
  PO creation, count-session creation, SKU-collision lookup), not
  physical-stock-movement concerns — outside this phase's own narrow
  "physical inventory mutation write-boundary" charter (§2's own
  explicit table list does not include `inventory_products`/`inventory_
variants`/`inventory_purchase_orders`/`inventory_count_sessions`).
  Recorded here rather than silently ignored, per this phase's own
  "return an explicit exception list" instruction (§19).
  **This entire bullet is now closed — see below.**
- The narrow example found in `module-boundary-audit.md`
  (`inventory_add_to_container`'s own inline RepairOrder-ownership
  check) — not a security issue, recorded for the architecture-
  compression pass. **Still open, deliberately not touched this pass.**

## IC-7 CLOSING PASS (2026-09-19) — the 7 disclosed items above, plus 1 newly-found item, closed

A narrow, explicitly-scoped follow-up pass. IC-7's own core security/
write-boundary work (the 10 numbered findings above) remained frozen and
was NOT reopened. This pass closed exactly the disclosed-but-deferred
product/procurement/audit-domain items, plus `inventory_convert_
quantity` (found live during this pass's own classification sweep, not
previously disclosed).

### 11. Actor-identity spoofing on 4 product/procurement/audit mutation RPCs (CRITICAL, newly discovered this pass)

**Pre-fix**: `inventory_create_product_with_default_variant`,
`inventory_create_enhanced_product` (via its own internal call into the
former), `inventory_create_purchase_order`, and `inventory_create_
count_session` all accepted `p_actor_user_id` and stamped it directly
into `created_by`/`updated_by` columns, but never validated it against
`auth.uid()`.

**Reproduced live**: as `e2e_user` (a real, permission-holding
authenticated actor), called each function passing a DIFFERENT real
user's id (`supabase.dev@gmail.com`'s own account, not a synthetic
UUID — a synthetic UUID only trips an unrelated FK constraint on
`created_by`, which would have produced a false negative) as
`p_actor_user_id`. All 4 calls succeeded, and the resulting row's own
`created_by` was confirmed forged to the spoofed id in every case. This
is an audit-trail-forgery vulnerability: any user with ordinary business
permission (`warehouse.products.manage`/`.procurement.manage`/
`.audits.manage`) could misattribute their own actions to an arbitrary
other real user.

**Fixed**: 4 migrations (`20260919093552_ic7_closing_harden_product_po_
count_session_actor_and_grants.sql`, `20260919093630_ic7_closing_
harden_enhanced_product_actor_and_grants.sql`, `20260919093655_ic7_
closing_harden_purchase_order_and_count_session_actor_and_grants.sql`)
— added the standard, already-established `p_actor_user_id IS NULL OR
p_actor_user_id IS DISTINCT FROM auth.uid() → 28000` check as the first
line of each function body. Business logic below the check is
byte-for-byte unchanged. Confirmed live (grep) that both real
TypeScript call sites (`createInventoryProductAction`/
`createEnhancedInventoryProductAction` via `userIdFrom(auth)`,
`createInventoryPurchaseOrderAction`/`createInventoryCountSessionAction`
via the same) already pass a genuine, server-session-resolved actor id
before this fix — zero legitimate-caller breakage.

**Post-fix live verification**: spoofed-actor and NULL-actor calls to
all 4 functions now correctly rejected with `28000`; legitimate calls
(real actor matching `auth.uid()`) still succeed, and `created_by` is
now confirmed to equal the REAL caller identity in every case (no longer
forgeable). See `111_ic7_closing_security_test.sql` Scenarios F1-F4,
G1, I1-I2, J1, K1.

### 12. anon/PUBLIC EXECUTE grant exposure on the same 4 mutation functions (GRANT EXPOSURE, not independently exploitable through tested paths)

**Pre-fix**: all 4 functions above, plus `inventory_create_valuation_
snapshot`, carried live `anon`/`PUBLIC` EXECUTE (the same schema-wide
default-privilege root cause documented in the Default-privilege
section below).

**Reproduced live**: called each function as a true `anon` session and
separately as a fresh, no-permission `authenticated` user. In every
case, the function's own existing body-level `has_permission`/
`has_branch_permission` check correctly rejected the caller (`P0001`)
BEFORE reaching any write. This is the "GRANT EXPOSURE without ACTUAL
EXPLOITABILITY through the tested path" category the task explicitly
asked to distinguish from item 11 above (a genuine, exploitable gap).

**Fixed**: the same 3 migrations as item 11, plus a 4th grant-only
migration (`20260919093709_ic7_closing_grant_hardening_valuation_and_
sensitive_reads.sql`) for `inventory_create_valuation_snapshot` (which
has no actor parameter to harden — see item 14) — explicit `REVOKE ALL
FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` on
all 5.

**Post-fix live verification**: `anon` calls to all 5 now fail at the
grant level (`42501`) before the body is ever reached. See
`111_ic7_closing_security_test.sql` Scenarios A1-A5.

### 13. `inventory_convert_quantity` — zero permission check, tenant-configuration-data exposure to `anon` (newly found this pass)

**Pre-fix**: unlike every other function audited this pass, `inventory_
convert_quantity` had NO permission check of ANY kind in its own body —
not even the weak "grant exposure but body rejects" pattern. It reads
`inventory_product_unit_conversions`/`inventory_unit_conversions`
(tenant-scoped business configuration: conversion factors between
units), scoped only by a caller-supplied `p_organization_id`, with zero
authorization of any kind, and carried live `anon` EXECUTE.

**Reproduced live**: confirmed via `pg_get_functiondef` there is no
`has_permission`/`has_branch_permission` call anywhere in the function
body. A live repo-wide grep (both TypeScript call sites and other SQL
functions' own `prosrc`) found ZERO callers anywhere — effectively dead
code, but still reachable via PostgREST's RPC surface by any anon
caller today.

**Fixed**: `20260919093709_...` (same migration as item 12) — `REVOKE
ALL FROM PUBLIC, anon`; kept `authenticated`/`service_role` rather than
attempting full removal (dead-code removal is out of this narrow
security-closing pass's own scope — recorded as a compression candidate
instead, see `compression-candidates.md`).

**Post-fix live verification**: `anon` call now `42501` at the grant
level. See `111_ic7_closing_security_test.sql` Scenario A8.

### 14. `inventory_create_valuation_snapshot` — grant-only hardening, no actor model change (deliberate, disclosed)

**Investigated**: unlike the other 4 mutation functions, `inventory_
create_valuation_snapshot` has NO `p_actor_user_id` parameter, and its
own target table (`inventory_valuation_snapshots`) has no `created_by`/
actor-tracking column at all. Per the task's own explicit "do not
casually proliferate new parameters" instruction, no new actor
parameter was added — there is no column for it to validate against,
and no real caller currently supplies one (confirmed live: neither the
server action `createInventoryValuationSnapshotAction` nor the service
method `InventoryEnterpriseService.createValuationSnapshot` pass or
accept any actor argument today). Its real authorization boundary is
the pre-existing `has_permission`/`has_branch_permission('warehouse.
reports.read')` check, live-confirmed to correctly reject both `anon`
and no-permission authenticated callers (`P0001`). Grant hardened for
defense-in-depth only (item 12).

**Disclosed, OUT-OF-SCOPE finding (NOT fixed, business-logic bug, not a
security bug)**: this function's own body references a relation,
`public.inventory_balance_analytics`, that does NOT exist in this
database (`to_regclass('public.inventory_balance_analytics')` returns
`NULL`, live-confirmed). This function's body was NOT touched by this
closing pass (grant-only change) — this is a pre-existing latent defect
predating this pass, not a regression it introduced. Recorded here
rather than silently worked around; a full fix is out of this pass's
own narrow security-only charter. See `111_ic7_closing_security_test.
sql` Scenario V2, which specifically proves the AUTHORIZATION boundary
is reached and passes correctly for a legitimate caller (fails only on
`42P01`, the disclosed missing-relation error, not a permission error)
— distinguishing "correctly denied by design" from "broken dependency."

### 15. `inventory_count_session_list` / `inventory_find_sku_collisions` — tenant-sensitive read exposure (grant hardened)

**Investigated**: `inventory_count_session_list` is already correctly
gated by `has_branch_permission(..., 'warehouse.audits.read')` as a
`RAISE EXCEPTION` guard — live-confirmed `anon`/no-permission callers
correctly rejected. `inventory_find_sku_collisions` gates its own
`has_permission('warehouse.products.read')` check as a `WHERE`
predicate rather than a raised exception — an unauthorized caller gets
a correctly EMPTY result set (silent filter), not a data leak, but the
`anon` grant itself was still unnecessary exposure of a tenant-scoped
lookup. Both closed via `REVOKE ALL FROM PUBLIC, anon` (item 12's own
migration).

**Post-fix live verification**: `anon` calls to both now fail at the
grant level (`42501`). See `111_ic7_closing_security_test.sql`
Scenarios A6/A7.

### Classification of remaining genuinely-public utility functions (left unchanged, deliberately)

- `inventory_build_sku_from_pattern`, `inventory_sku_fingerprint`,
  `inventory_sku_token` — genuinely pure string computation, zero table
  access of any kind (confirmed via `pg_get_functiondef`), zero tenant
  data exposure possible. Classified PUBLIC SAFE, left unchanged. Live-
  reverified still callable by `anon` post-pass (`111_...` Scenario N1).
- `inventory_preview_sku` — already correctly gated by `has_permission
('warehouse.products.read')`, live-confirmed `anon` rejected. Left
  unchanged (not part of this pass's own explicit 8-function scope, no
  exploit found).
- `inventory_variant_matches_audit_supplier` — returns a boolean only
  (no record data), requires 3 already-known UUIDs as input to produce
  any signal at all. Left unchanged — low severity, out of this pass's
  own explicit scope, disclosed here rather than silently ignored.

### Automated grant-regression strategy (strengthened this pass, per §13)

`111_ic7_closing_security_test.sql`'s own GRANT-REGRESSION assertion
replaces a hardcoded function list with a live, classification-based
query: every function in `public` named `inventory_*`, that is not a
trigger function, whose own `prosrc` contains a raw `INSERT INTO
public.`/`UPDATE public.`/`DELETE FROM public.` (a "this function
writes" heuristic), must NOT carry `anon` EXECUTE. This is designed to
fail automatically — not merely "remember to revoke" — if a FUTURE
Inventory/Product/Procurement/Audit mutation RPC accidentally inherits
`anon` EXECUTE from the schema-wide default privilege (IC-7's own
Option B decision, unchanged — see below). Live-verified this query
returns 0 rows after this pass's own fixes.

### Final default-privilege decision: still Option B (unchanged, per explicit instruction not to revisit)

No change to the schema-wide default privilege was made or considered
in this closing pass — Option B (retain the default, harden explicitly
per-function, enforce via the classification-based regression above)
remains the decision, exactly as full IC-7 established.
