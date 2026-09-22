# PRE-IC8 P0 — Security Evidence

## The exploit

**Finding**: `inventory_guard_balance_write()`/`inventory_guard_settings_
write()` — the trigger functions meant to be the last line of defense
on `inventory_balances`/`inventory_settings` — trusted the caller-
settable session GUC `ambra.inventory_movement_engine = 'on'` as
SUFFICIENT authorization, with no validation of what actually changed
or who was making the change. This was discovered during the
architecture compression review (prior phase), verified against live
`pg_get_functiondef` output (not assumed from docs), and escalated to
the user immediately before this correction pass began.

### Pre-fix live body (`inventory_guard_balance_write`)

```sql
CREATE OR REPLACE FUNCTION public.inventory_guard_balance_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'inventory_balances can only be changed by the movement engine';
  END IF;
  RETURN NEW;
END;
$function$;
```

### Pre-fix live body (`inventory_guard_settings_write`)

```sql
CREATE OR REPLACE FUNCTION public.inventory_guard_settings_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') <> 'on'
     AND NOT public.has_permission(NEW.organization_id, 'warehouse.settings.manage') THEN
    RAISE EXCEPTION 'inventory_settings can only be updated by settings managers or inventory engines';
  END IF;
  RETURN NEW;
END;
$function$;
```

Live-queried RLS on both tables confirmed no column/value restriction
beyond holding `warehouse.inventory.operate`/`.adjust`/`.reverse`
(balances) or one of 5 broad permissions (settings) — the trigger was
the _only_ layer standing between an ordinary session and an arbitrary
write, and that layer trusted a value the same session could set
itself.

## Live reproduction (this pass, before any fix — not relied on source inspection alone)

Postgres DDL is transactional, so the exact pre-fix trigger bodies were
temporarily restored (`CREATE OR REPLACE FUNCTION`) inside a disposable
`BEGIN...ROLLBACK` transaction — proving the exploit by actually
executing the vulnerable code, then rolling back so nothing persisted
and no already-applied migration was ever edited.

### Balance exploit, reproduced

1. Established a real balance row, `on_hand_quantity = 10`.
2. As `e2e_user` (real, `warehouse.inventory.operate`-holding, no
   special access), with **zero** prior GUC contact in the sub-scope:
   `SELECT set_config('ambra.inventory_movement_engine', 'on', true);`
   then `UPDATE inventory_balances SET on_hand_quantity = 999999 WHERE id = ...;`
3. **Result: succeeded.** `on_hand_quantity` became `999999.000000`.
4. Checked for any trace: **zero** new movement headers, **zero** new
   ledger entries, **zero** new audit log entries in the same window.

Silent, complete, untraceable corruption of the physical stock truth.

### Settings exploit, reproduced

Using a real org member (`e2e_user`) with `warehouse.settings.manage`
temporarily stripped for the test (their own real permission set was
restored immediately after, inside the same rolled-back transaction),
keeping `warehouse.inventory.operate`:

1. **Control**: raw `UPDATE inventory_settings SET allow_negative_stock
= NOT allow_negative_stock` with the GUC untouched → correctly
   denied, `P0001`. Confirms the ordinary path was never broken.
2. **Exploit**: same UPDATE, GUC deliberately set to `'on'` → **1 row
   affected, value flipped from `false` to `true`.** An ordinary
   operate-permissioned, non-settings-manager user edited an
   organization-wide, user-managed inventory setting.

### A genuine false-positive self-caught during this reproduction

An earlier probe using a totally fabricated, non-member user id
appeared to also show the settings exploit succeeding even with the
GUC untouched — investigated before trusting it, and traced to the
exact "no exception raised, mistaken for success" class of false
positive this project has repeatedly self-caught: the raw UPDATE
silently affected 0 rows (RLS correctly filtered a non-member out),
which is not an error in Postgres and was misread as success by not
checking `ROW_COUNT`. Re-tested with `GET DIAGNOSTICS v_rc = ROW_COUNT`
— confirmed 0 rows, 0 change. Not a real finding; the real settings
exploit is the one described above, using a genuine, permissioned org
member.

## Final design

### Layer 1 — structural (the real security boundary)

`authenticated`/`anon` no longer hold `INSERT`/`UPDATE`/`DELETE` table
privileges on `inventory_balances` at all. Postgres checks base table
grants **before** RLS and **before** any trigger fires, so this closes
the exploit regardless of GUC state, and regardless of any future bug
in the trigger's own logic. Every legitimate writer is a `SECURITY
DEFINER` function owned by `postgres` (confirmed live for
`inventory_finalize_posting_internal`, `inventory_create_reservation`,
`inventory_release_reservation`, `inventory_create_allocation`,
`inventory_release_allocation`, `inventory_send_branch_transfer`,
`inventory_create_draft`) or same-owner-nested from one (`inventory_
get_or_create_balance_for_update`, itself `SECURITY INVOKER` but always
called from inside an already-elevated context) — none are affected by
the REVOKE.

`inventory_settings` initially received the identical blanket REVOKE,
but this was corrected forward (below) once live testing showed it
also blocked a genuinely intended, if not-yet-built, direct-write path
for real settings managers.

### Layer 2 — substance validation (defense-in-depth)

Protects against a hypothetical future bug in already-trusted
`SECURITY DEFINER` code, which does still reach these triggers
(running as `postgres`). Neither trigger trusts the GUC alone anymore.

**Balance guard** — validates the delta shape against the exhaustive
set of legitimate transitions, live-derived from every function that
writes `inventory_balances` (not assumed):

- `DELETE`: always denied, unconditionally — no legitimate business
  reason found in any live function body.
- `INSERT`: only a zero-quantity row (`on_hand_quantity = reserved_
quantity = allocated_quantity = 0`) — matches `inventory_get_or_
create_balance_for_update`'s own exact shape.
- `UPDATE`, physical shape: `on_hand_quantity` changes alone (with
  `last_movement_id`/`last_movement_at`/`updated_at`/the generated
  `available_quantity` column, which the check correctly excludes) —
  `reserved_quantity`/`allocated_quantity` must NOT change in the same
  statement.
- `UPDATE`, commitment shape: `reserved_quantity` and/or `allocated_
quantity` change — `on_hand_quantity` must NOT change in the same
  statement. Covers reservation create/release (reserved alone),
  allocation release (allocated alone), and allocation create's
  reservation-backed path (both together, the exact additive move
  invariant #6 describes).
- No other column may ever change via `UPDATE`.

**Settings guard** — distinguishes real settings-manager writes from
engine-only writes by column ownership, live-derived from an exhaustive
`prosrc` search across every function that `UPDATE`s `inventory_
settings`:

- A caller holding `warehouse.settings.manage` may change any column
  (unchanged from before — this pass does not make settings more
  restrictive for a real manager).
- A caller without that permission may ONLY change the 6 numbering-
  counter columns (`reservation_number_next`, `allocation_number_next`,
  `purchase_order_number_next`, `branch_transfer_number_next`, `draft_
number_next`, `sku_next`) plus `updated_by`/`updated_at` — and only
  if the GUC is also set (necessary, still never sufficient on its
  own — the column-ownership check is what actually closes the
  exploit).
- `DELETE`: always denied.

## Self-caught bugs during live testing of the fix (all fixed forward, all disclosed)

1. **`available_quantity` generated-column omission.** The balance
   guard's first live test (a genuine, legitimate receipt) failed with
   "touches a column the movement engine never changes." Root cause:
   `available_quantity` is a Postgres `GENERATED ALWAYS AS (on_hand_
quantity - reserved_quantity - allocated_quantity) STORED` column —
   it automatically changes whenever any of those 3 base columns
   change, but was not in the guard's own "no other column changes"
   exclusion list. Fixed forward (`..._fix_balance_guard_exclude_
generated_column.sql`); no other logic changed.
2. **Settings blanket-REVOKE broke the intended settings-manager
   pathway.** Live-confirmed via this pass's own required "real
   settings manager can still edit an allowed setting" test: a genuine
   settings manager's direct `UPDATE` failed with a bare `permission
denied for table inventory_settings` — the grant layer, never even
   reaching the trigger's own correct permission check. Root cause:
   `inventory_settings`, unlike `inventory_balances`, has a genuinely
   DESIGNED (if not-yet-built) two-writer model — a real settings
   manager may write directly, gated by RLS + the trigger's own
   permission check, not exclusively through an RPC. The blanket
   REVOKE closed that intended path along with the exploit. Fixed
   forward (`..._restore_settings_update_grant_keep_trigger_as_
boundary.sql`) — restored `UPDATE` for `authenticated` on `inventory_
settings` only (not `INSERT`/`DELETE`, and not `anon`); the
   trigger's own substance-validated logic remains the real boundary
   for this table. `inventory_balances` keeps its full REVOKE
   unchanged — it has no legitimate direct-writer model at all.
3. **Test-design bug, not a code bug** (same class already documented
   in this project's own history — 110's own Scenario C): the new
   pgTAP file's reversal scenario initially tried to reverse the same
   50-unit receipt other scenarios had already partially consumed,
   correctly tripping IC-1's own P0003 strand check. Fixed by adding a
   dedicated, isolated 20-unit receipt for the reversal scenario alone.
4. **Balance guard rejected genuine no-op UPDATEs** (found by the full
   097-112 regression run, not a hand-authored probe). Files 098, 099,
   100, 102 failed outright: their own established 3-statement
   fixture-reset pattern (introduced earlier this same pass, to fix the
   original shape-violation problem) includes a `SET reserved_quantity
= 0, allocated_quantity = 0` step that becomes a genuine no-op
   whenever the row's reserved/allocated already sit at 0 — the
   common/default case, including immediately after a fresh
   zero-quantity INSERT (102 proved this happens even on a brand-new
   row). The guard's own final "changes no recognized column" check
   incorrectly rejected this harmless no-op as an unrecognized
   transition. Fixed forward (`..._fix_balance_guard_allow_genuine_
noop_update.sql`): a true no-op (nothing among on_hand/reserved/
   allocated actually changed value) is now explicitly allowed through
   before the transition-shape checks run. Required zero further
   changes to the 4 affected test files — the fix makes their existing
   fixture pattern work as originally intended.
5. **Two `SECURITY INVOKER` functions' own inline settings warm-up
   broke for ALL legitimate callers, not just adversarial ones** (found
   by the full 097-112 regression run). `111_...`'s own I1
   (`inventory_create_product_with_default_variant`), I2 (`inventory_
create_enhanced_product`, which calls I1's function internally), and
   J1 (`inventory_create_purchase_order`) scenarios all failed with
   `42501: permission denied for table inventory_settings`. Root cause,
   confirmed via a live `prosecdef`/warm-up cross-query: both functions
   are `SECURITY INVOKER` (not `DEFINER`) and each performs its own
   inline `inventory_settings` warm-up INSERT, which therefore runs as
   the CALLING role (`authenticated`) — broken once `INSERT` was
   revoked from `authenticated` on that table (migration 1; migration 6
   restored only `UPDATE`). Cross-checked and confirmed the 3 OTHER
   functions doing the identical warm-up (`inventory_create_
allocation`/`inventory_create_branch_transfer`/`inventory_create_
reservation`) are all already `SECURITY DEFINER`, so none of them
   were affected. Fixed forward (`..._fix_settings_warmup_via_internal_
helper.sql`) by extracting the warm-up into one new, narrow
   `SECURITY DEFINER` internal helper (`inventory_ensure_settings_row_
internal`, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`)
   and having both broken functions call it instead of inlining the raw
   INSERT. Deliberately did NOT convert either function to `SECURITY
DEFINER` outright — that would also have elevated their OTHER writes
   (`inventory_products`/`inventory_variants`/`inventory_purchase_
orders`/`inventory_purchase_order_lines`) and changed their entire
   RLS-interaction model, explicitly out of this pass's own narrow
   scope ("do NOT redesign Inventory Core"). Required zero further
   changes to any test file — this fixed a genuine RPC-body bug, not a
   fixture-pattern issue.
6. **Migration 8's own fix over-revoked** (found by a SECOND full
   097-112 regression run, after migration 8 had already been applied
   — the previous run's clean result for 111 had been misattributed;
   111's I1/I2/J1 in fact still failed). `..._fix_settings_warmup_via_
internal_helper.sql` created `inventory_ensure_settings_row_
internal` correctly but then ran `REVOKE ALL ... FROM authenticated`
   on it alongside `anon`/`PUBLIC` — one role too many. Because
   `inventory_create_product_with_default_variant`/`inventory_create_
purchase_order` are `SECURITY INVOKER`, their nested call to the new
   helper executes as the CURRENT role (`authenticated`), not as the
   helper's own definer — so revoking `authenticated`'s EXECUTE broke
   the exact fix migration 8 was trying to make. Live-reproduced:
   `42501: permission denied for function inventory_ensure_settings_
row_internal` for a fully legitimate caller. Fixed forward
   (`..._fix_settings_warmup_helper_grant_authenticated.sql`):
   restored `EXECUTE` on the helper for `authenticated` only —
   `anon`/`PUBLIC` remain revoked. Live-verified end-to-end (not just
   via grant inspection): a real `authenticated` call to `inventory_
create_product_with_default_variant` now succeeds, in a disposable
   rolled-back transaction.

## Explicit product decision (asked and confirmed before implementing)

`apps/public-web/src/app/actions/warehouse/ambra-location-inventory.ts`
(a separate app pointing at the SAME live Supabase project, confirmed
via matching `NEXT_PUBLIC_SUPABASE_URL`) still contains a live,
non-RPC feature — `addItemsToContainerAction`/`removeItemFromContainer
Action`/`relocateContainerAction` — writing `inventory_balances.
allocated_quantity` directly via `.from("inventory_balances").update(...)`,
gated only by a TypeScript permission check, never through the
canonical engine. These are the exact same function names IC-6 already
confirmed dead and removed from `apps/web`'s own copy of this file —
apparently never cleaned up in the `apps/public-web` fork.

**Asked the user directly**: close it fully (apps/public-web breaks
until migrated to a canonical RPC, matching how apps/web's own copy was
already treated by IC-6), or carve out `allocated_quantity` as an
exception. **User confirmed: close it fully.** Not fixed in this pass
(migrating that feature to a canonical RPC is separate, future,
out-of-scope work) — disclosed here, not silently worked around.

## Post-fix live verification

All of the following were live-verified via the new pgTAP file
(`112_...`, 20/20) plus targeted live probes during development:

- `anon`/`authenticated` structurally cannot INSERT/UPDATE/DELETE
  `inventory_balances` at all (grant-level `42501`, before any trigger
  runs).
- Self-set GUC no longer suffices for any of: raw `on_hand_quantity`
  change, raw `reserved_quantity` change, raw `allocated_quantity`
  change, combined multi-quantity change, fabricated non-zero INSERT,
  or DELETE.
- Self-set GUC no longer suffices for a non-settings-manager to edit a
  user-managed setting.
- A real settings manager can still edit a user-managed setting through
  the intended direct-write path.
- Every legitimate canonical writer still works end-to-end: generic
  receipt, generic issue, relocation, reservation create/release,
  allocation create/release, branch-transfer send, opening-stock-style
  401, reversal.
- IC-1's own commitment invariant remains fully enforced: a raw attempt
  to strand committed stock is denied at the grant layer (before IC-1's
  own P0003 check is ever reached), and the canonical engine itself
  still raises the identical `P0003` for a legitimate posting that
  would strand commitments — unchanged by this pass.
