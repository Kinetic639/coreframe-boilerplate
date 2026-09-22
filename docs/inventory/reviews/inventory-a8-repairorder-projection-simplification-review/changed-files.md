# Inventory Core — A8 RepairOrder Projection Simplification — Changed Files

Baseline: HEAD `ea615451` ("Inventory Core A7 follow-up correction"),
working tree clean before this pass.

## New migrations (7)

- `apps/web/supabase-target/supabase/migrations/20260922110637_a8_add_live_physical_state_read.sql`
  — adds `get_repair_order_line_physical_state`.
- `apps/web/supabase-target/supabase/migrations/20260922110652_a8_attach_remove_projection_rebuild_call.sql`
  — `attach_repair_order_line_movement`, removes dead rebuild call.
- `apps/web/supabase-target/supabase/migrations/20260922110707_a8_receive_remove_projection_write.sql`
  — `receive_repair_order_stock`, removes direct projection write.
- `apps/web/supabase-target/supabase/migrations/20260922110722_a8_putaway_live_attribution_check.sql`
  — `putaway_repair_order_stock`, replaces projection reads/writes with a
  live-computed, locked, pre-engine-call check.
- `apps/web/supabase-target/supabase/migrations/20260922110737_a8_drop_projection_trigger.sql`
  — drops the trigger + trigger function.
- `apps/web/supabase-target/supabase/migrations/20260922110752_a8_drop_rebuild_functions.sql`
  — drops both rebuild RPCs.
- `apps/web/supabase-target/supabase/migrations/20260922110807_a8_drop_projection_tables.sql`
  — drops both projection tables (immediate, not staged — see
  `migration-summary.md`'s own disposition reasoning).

## Application code (2 files)

- `apps/web/src/server/services/repair-orders.service.ts` —
  `getPhysicalStateForLine` rewritten to call the new
  `get_repair_order_line_physical_state` RPC instead of querying
  `repair_order_line_locations`/`repair_order_location_attribution_uncertain`
  directly. New consistency value `"inconsistent_history"` added (highest
  precedence) representing the RPC's own explicit P0008 failure mode,
  mapped from a caught `P0008` RPC error rather than the generic
  server-error path. `"unknown"` narrowed to mean ONLY the pre-existing
  Phase 10C internal container/allocation-location mismatch check (its
  own Zone-5-attribution-uncertain contribution removed, since that data
  source no longer exists). Doc comments updated throughout.
- `apps/web/src/server/services/__tests__/repair-orders.service.test.ts`
  — the `getPhysicalStateForLine` test block's mock builder extended with
  an `rpc` mock (the old builder was table-only); all 12 pre-existing
  test cases updated to supply the live-read RPC's own response shape
  instead of a `repair_order_line_locations` table response; the
  `repair_order_location_attribution_uncertain` table mock removed from
  every case; the cross-org/branch scope test (case 8) rewritten to
  assert on the RPC's own call arguments instead of table-query filter
  arguments; 2 new test cases added (P0008 → `"inconsistent_history"`
  mapping; a non-P0008 RPC error still returns the generic server-error
  failure, not silently swallowed); the final "unknown" test rewritten
  from the removed table-based scenario to a genuine Phase 10C
  container/allocation-location mismatch scenario. 161/161 passing.

## Modified pgTAP test files (5)

- `apps/web/supabase/tests/107_ic5_repair_order_projection_test.sql` —
  **REWRITTEN** (not patched) per the task's own explicit instruction.
  See `test-evidence.md` for the full before/after scenario mapping.
  `plan(31)`, live-verified 31/31.
- `apps/web/supabase/tests/101_zone3_zone5_movement_engine_reserved_blindspot_characterization_test.sql`
  — T2 changed from a direct `repair_order_line_locations` table read to
  the new live-read RPC (discovered mid-pass via a full blast-radius
  grep after the initial 4-file scope; see `architecture-evidence.md`).
  `plan(17)` unchanged. Live-verified 17/17.
- `apps/web/supabase/tests/104_ic3_receiving_consolidation_test.sql` —
  G6/G7 changed the same way. `plan` unchanged (assertion count
  preserved 1-for-1).
- `apps/web/supabase/tests/108_ic6_legacy_cleanup_test.sql` — D3 (was a
  privilege check on a now-nonexistent function, which would have
  errored rather than failed — changed to an existence check), E7/E9
  (table reads → live-read RPC), E10 (the old rebuild-vs-incremental
  equality check, replaced with a repeated-read idempotency check — no
  more separate rebuild to compare against), E11/E12 (table reads →
  live-read RPC). `plan(23)` unchanged.
- `apps/web/supabase/tests/110_ic7_security_write_boundary_test.sql` —
  N3 (same privilege-check-on-nonexistent-function fix as 108's D3).
  `plan` unchanged.

## New pgTAP test file (1)

- `apps/web/supabase/tests/116_a8_repairorder_projection_live_read_test.sql`
  — `plan(17)`. Architecture-transition-specific assertions: trigger and
  trigger function gone (with a check that OTHER generic triggers on the
  same table remain untouched); both rebuild RPCs gone; both projection
  tables gone (with `repair_order_line_movement_links` confirmed
  untouched); the new RPC's shape (1 overload, `SECURITY INVOKER`,
  correct grants); a generic movement at an attributed bucket creates
  ZERO new canonical links (proving no hidden logic runs at all, not
  merely a no-op) and correctly produces the exact P0008 scenario this
  pass's own pre-implementation gap analysis reproduced; receive/putaway
  each produce exactly one canonical link and no other persisted effect.
  Live-verified 17/17.

## Review bundle (this directory, new)

- `review-context.md`
- `changed-files.md` (this file)
- `migration-summary.md`
- `test-evidence.md`
- `architecture-evidence.md`
- `performance-evidence.md`
- `diff.patch`
