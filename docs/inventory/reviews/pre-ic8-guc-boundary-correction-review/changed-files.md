# PRE-IC8 P0 — Changed Files

**Baseline**: HEAD `fb22529567cf029ea2dc6e6109f1f3d34216d477` ("ic6a") —
unchanged this pass; IC-7 and its closing pass remain the same
uncommitted working-tree state as before (flagged again at the start of
this pass, per standing discipline).

**Total**: 9 new migrations + 1 new pgTAP test file + 6 pre-existing
pgTAP test files fixture-corrected + this review bundle. **Zero
TypeScript/application files changed** — this is a pure SQL/database
security-correction pass; no server action, service, or component was
touched.

## New migrations (9)

1. `20260919150859_pre_ic8_p0_revoke_authenticated_anon_raw_write_balances_settings.sql`
2. `20260919150916_pre_ic8_p0_redesign_balance_guard_substance_validation.sql`
3. `20260919150930_pre_ic8_p0_redesign_settings_guard_column_ownership.sql`
4. `20260919152457_pre_ic8_p0_simplify_balance_guard_drop_movement_reference_check.sql`
5. `20260919162500_pre_ic8_p0_fix_balance_guard_exclude_generated_column.sql`
6. `20260919162643_pre_ic8_p0_restore_settings_update_grant_keep_trigger_as_boundary.sql`
7. `20260919165733_pre_ic8_p0_fix_balance_guard_allow_genuine_noop_update.sql`
   — self-caught by the full 097-112 regression run (not a
   hand-authored probe); see `migration-summary.md`/`security-
evidence.md` self-caught-bug #4.
8. `20260919165805_pre_ic8_p0_fix_settings_warmup_via_internal_helper.sql`
   — self-caught by a full 097-112 regression run; see self-caught-bug
   #5. Adds one new internal helper function, `inventory_ensure_
settings_row_internal`. **Itself contained a bug**, fixed by
   migration 9.
9. `20260922053110_pre_ic8_p0_fix_settings_warmup_helper_grant_
authenticated.sql` — self-caught by a SECOND full 097-112
   regression run; see self-caught-bug #6. Migration 8's own `REVOKE
ALL ... FROM authenticated` on the new internal helper went one
   role too far (broke the SECURITY INVOKER callers it was meant to
   fix); restores `EXECUTE` for `authenticated` only.

See `migration-summary.md` for full per-migration detail.

## New test file

`apps/web/supabase/tests/112_pre_ic8_p0_balance_settings_guc_boundary_
test.sql` — `plan(20)`, 20/20 live. Covers the full required scope:
adversarial raw writes (on_hand/reserved/allocated/multi-quantity/
fabricated-INSERT/DELETE, all denied even with the GUC self-set),
settings (non-manager denied even with GUC set, real manager still
works), every legitimate canonical writer (receipt, issue, relocation,
reservation create/release, allocation create/release, branch-transfer
send, opening-stock-style 401, reversal), and IC-1's own commitment
invariant (raw stranding attempt denied, canonical engine's own P0003
unchanged).

## Pre-existing test files corrected (6, required by this exact change — not scope creep)

No real business RPC ever combines a physical (`on_hand_quantity`)
change with a commitment (`reserved_quantity`/`allocated_quantity`)
change in one statement — this was already true before this pass, the
new guard just now enforces it. Several established test-fixture
conventions (a single combined `INSERT ... ON CONFLICT DO UPDATE SET
on_hand_quantity=X, reserved_quantity=0, allocated_quantity=0`, used
purely to seed a deterministic starting balance) violated this shape
and needed correction — matching this project's own established
precedent (fixture files get updated when a legitimate, disclosed
change invalidates their old convention; business-logic assertions are
never touched).

- `098_repair_order_line_reservation_phase10a_test.sql` — split the
  combined reset into 3 shape-compliant statements (zero-quantity
  insert, commitment-shape reset, physical-shape reset). 17/17
  unchanged assertion count.
- `099_repair_order_line_allocation_phase10b_test.sql` — same split,
  applied at both of the file's own 2 raw seed points. The second seed
  also needed a `RESET ROLE`/`SET LOCAL ROLE authenticated` bracket
  added, since it ran under the `authenticated` role (which no longer
  holds table privileges on `inventory_balances` at all) rather than
  the connecting/superuser role every other fixture uses. 20/20.
- `100_repair_order_container_orchestration_phase10c_test.sql` — same
  split, applied to both of the file's own 2 balance seeds. 44/44.
- `102_ic1_reserved_only_hard_invariant_test.sql` — same split; also
  needed its `RESET ROLE` moved earlier (before both the `inventory_
settings` seed insert and the balance seed) since an earlier
  scenario's own `SET LOCAL ROLE authenticated` was never reset before
  this point in the file. 11/11.
- `106_ic4_branch_transfer_test.sql` — a single commitment-only
  (`allocated_quantity`) fixture UPDATE, already shape-compliant;
  added an explicit `SET LOCAL ambra.inventory_movement_engine = 'on'`
  for defense against transaction-scoped GUC-state ambiguity. 87/87.
- `107_ic5_repair_order_projection_test.sql` — one raw INSERT with a
  nonzero `on_hand_quantity` split into a zero-quantity insert + a
  physical-shape-only UPDATE; one pre-existing physical-shape-only
  UPDATE left unchanged (already compliant). 46/46.

No assertion's own expected VALUE or pass/fail outcome changed in any
of these 6 files — only the mechanical shape of each fixture's own raw
write statement.

## Review bundle

`docs/inventory/reviews/pre-ic8-guc-boundary-correction-review/` — this
bundle (`diff.patch`, `changed-files.md`, `review-context.md`,
`migration-summary.md`, `security-evidence.md`, `test-evidence.md`; no
`concurrency-evidence.md` — no lock acquisition order or row-lock scope
changed by this pass, see `test-evidence.md`).

## Not touched this pass

- Simplification items A1-A8 from the architecture compression review
  — not started.
- Any trigger removed, added, or rebound — only 2 existing trigger
  _functions'_ bodies were replaced (`CREATE OR REPLACE`), the trigger
  bindings themselves (`inventory_balances_engine_only`, `inventory_
settings_write_guard`) are unchanged.
- Reservation/allocation/transfer/reversal/opening-stock/count-session
  business semantics — unchanged, re-verified end-to-end in `112_...`.
- Any TypeScript file, server action, or React component.
- `apps/public-web`'s own container feature code — not migrated to a
  canonical RPC (that is separate, future, out-of-scope work); only its
  now-broken raw-write path is disclosed, per the user's own explicit
  decision.
