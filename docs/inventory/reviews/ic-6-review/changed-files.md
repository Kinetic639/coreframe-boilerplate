# IC-6 Changed Files

**Baseline**: `daeba1132b05295bb3a8221f6d218e77bfb36487` (commit `ic6` —
this label is pre-existing/inherited, not authored by this phase; the
commit itself contains only IC-4/IC-5(-correction) work, confirmed via
`git show --stat` — no actual IC-6 content existed in it).

**Total**: 10 files changed/added (6 modified, 4 new migrations) + 1 new
pgTAP test file + 3 doc files + this review bundle (7 files).

**Excluded from this diff**: `apps/web/supabase/types/target.types.ts`
is shown as modified (emptied, 10476 → 0 lines) in `git status`, but
this predates this phase entirely — it was already modified before any
IC-6 work began (visible in the very first `git status` snapshot of
this session) and is not imported anywhere in `src/` (confirmed via
repo-wide grep; the app's real Supabase types import is the separate,
tiny `types.ts`, per `CLAUDE.md`). Unrelated pre-existing branch state,
left untouched, excluded from `diff.patch`.

## New migrations (4, all applied live via MCP, mirrored locally under

their exact live timestamp)

1. `20260917062247_ic6_finalize_posting_remove_dead_negative_stock_policy_check.sql`
   — `CREATE OR REPLACE FUNCTION inventory_finalize_posting_internal`,
   removing only the 3-line dead `negative_stock_policy='block'`
   conditional; the `SELECT * INTO v_settings ... FOR UPDATE` row lock
   preserved byte-for-byte.
2. `20260917062301_ic6_drop_negative_stock_policy_column.sql` —
   `ALTER TABLE inventory_settings DROP COLUMN negative_stock_policy`
   (its own CHECK constraint dropped automatically).
3. `20260917062315_ic6_drop_stale_balance_helper_5arg_overload.sql` —
   `DROP FUNCTION inventory_get_or_create_balance_for_update(uuid,uuid,
uuid,uuid,uuid)` (the stale 5-arg overload only; the 7-arg canonical
   form is untouched).
4. `20260917062320_ic6_drop_dead_v1_balance_helper.sql` — `DROP
FUNCTION inventory_v1_get_or_create_balance(uuid,uuid,uuid,uuid)`.

All 4 are real, separately-applied forward migrations per this
project's never-edit-an-applied-migration discipline; none were edited
after being applied.

## New test file

- `apps/web/supabase/tests/108_ic6_legacy_cleanup_test.sql` — `plan(23)`,
  23/23. A dedicated cleanup-boundary test (dropped functions absent,
  stale overload absent, canonical helpers unchanged, internal
  functions non-executable, canonical receive/reverse/putaway/branch-
  transfer/RepairOrder-projection paths unchanged) — not a business-
  workflow retest.

## Modified test file

- `apps/web/supabase/tests/102_ic1_reserved_only_hard_invariant_test.sql`
  — Scenario C's own two-policy comparison (`'allow'`/`'block'`)
  collapsed into one unconditional pass, since `negative_stock_policy`
  no longer exists as a column to vary. `plan(14)` → `plan(11)`. This is
  a TEST FILE edit, not a migration — not subject to the immutable-
  migration rule. Fixes a genuine regression the full-suite rerun
  surfaced after the column drop (see `test-evidence.md`).

## Modified application file

- `apps/web/src/app/actions/warehouse/ambra-location-inventory.ts` —
  618 → 218 lines. Deleted 4 confirmed-dead write actions
  (`createLocationContainerAction`, `addItemsToContainerAction`,
  `removeItemFromContainerAction`, `relocateContainerAction`), their
  exclusively-owned zod schemas, and the now-unused
  `InventoryMovementsService` import. The file's remaining 3 exported
  functions (`deletePutawayRuleAction`, `findContainersByReferenceAction`,
  `createLocationPutawayRuleAction`) are also dead but deliberately
  retained — out of this phase's narrow scope (see
  `dead-path-matrix.md`).

## Documentation

- `docs/inventory/inventory-core-architecture.md` — new §9D ("IC-6 —
  Legacy Writer/Helper Removal"), 14 numbered findings.
- `docs/inventory/inventory-core-implementation-plan.md` — IC-6 section
  marked DONE with a summary.
- `docs/inventory/inventory-core-progress.md` — runtime-status header,
  "Current phase" line, "Overall execution" bullets, phase-tracker row,
  new change-log entry.

## Not touched this phase

- `inventory_reverse_movement`, `receive_repair_order_stock`,
  `putaway_repair_order_stock`'s own core business rules, `attach_
repair_order_line_movement`, `rebuild_repair_order_location_
projection`, all 5 branch-transfer RPCs — read/verified, confirmed
  unchanged.
- Both GUCs (`ambra.inventory_movement_engine`, `ambra.repair_order_
attribution_authoritative`) — retained, unchanged.
- The known posted-header GUC UPDATE bypass — explicitly left for full
  IC-7, not touched.
- `inventory_cancel_movement`'s own missing actor-check — disclosed,
  not fixed (full IC-7's job).
- `InventoryProductsService.createOpeningStockMovement`'s own broken
  RPC calls (`inventory_create_draft_movement`/`inventory_post_
movement`, neither exists live) — disclosed as an active bug, not
  fixed (a bug fix, not a legacy removal, is out of this phase's
  charter).
- `InventoryProductsService.createEnhancedProductLegacy` (confirmed
  dead, product-creation scope, not Inventory Core scope) — disclosed,
  not removed.
- `ambra-location-inventory.ts`'s remaining 3 functions (`inventory_
putaway_rules`-scoped, unrelated table) — disclosed, not removed.
