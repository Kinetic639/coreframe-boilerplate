-- ============================================================================
-- TEST: Zone 5 Phase 6 -- putaway_repair_order_stock RPC (batch behavior,
-- UNKNOWN-source rejection, destination-UNKNOWN retention, lock order)
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912094000_zone5_putaway_repair_order_stock_rpc.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable.
-- Same inventory_create_and_finalize live-dependency caveat as test 096.
--
-- CORRECTION (external review, third pass): test 5 previously asserted the
-- WRONG semantic model -- it marked the receiving bucket UNKNOWN, then
-- asserted a subsequent putaway of the remaining "known-looking" quantity
-- SUCCEEDED and merely left the marker in place. That is backwards: the
-- architecture says existence of the marker means the bucket's attribution
-- is UNKNOWN, full stop -- repair_order_line_locations is then only
-- last-known/stale, never physical proof, and the caller naming an exact
-- repair_order_line_id is not proof either. Test 5 is replaced with the
-- correct expectation (HARD ERROR, nothing moved, nothing changed, marker
-- remains). New tests 6 and 7 cover destination-UNKNOWN retention and a
-- best-effort structural proof of the corrected lock order, per that
-- review's items 4-7. This also fixes a latent bug: the previous test 5's
-- own `PERFORM putaway_repair_order_stock(...)` was invalid top-level SQL
-- (PERFORM is PL/pgSQL-only) -- never caught because this file has never
-- been executed; replaced with the file's own established `throws_ok`/
-- `lives_ok` + `format($sql$ SELECT ... $sql$, ...)` pattern throughout.

BEGIN;

SELECT plan(15);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, e2e_user uuid,
  ro uuid, rol1 uuid, rol2 uuid, unit_ea uuid, variant_x uuid, variant_y uuid,
  loc_recv uuid, loc_final uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid();

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT loc_recv, org, branch, '097-test receiving', '097-RECV', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc_final, org, branch, '097-test final bin', '097-A-01', true FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, zl_number, order_number, status)
SELECT ro, org, branch, '097-TEST-ZL-1', '097-TEST-1', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
SELECT rol1, ro, variant_x, '097-test product 1', 5, 'pending' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
SELECT rol2, ro, variant_y, '097-test product 2', 3, 'pending' FROM fx;

-- Seed known-true attribution at the receiving location, as
-- receive_repair_order_stock would have done.
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro, rol1, variant_x, loc_recv, 5 FROM fx;
INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
SELECT org, branch, ro, rol2, variant_y, loc_recv, 3 FROM fx;

-- 1. Batch: one call, two lines (rol1 partial=3-of-5, rol2 full=3), one
--    destination -> one movement document.
SELECT lives_ok(
  format($sql$
    SELECT putaway_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(
        jsonb_build_object('repair_order_line_id', '%s', 'variant_id', '%s', 'unit_id', '%s', 'quantity', 3),
        jsonb_build_object('repair_order_line_id', '%s', 'variant_id', '%s', 'unit_id', '%s', 'quantity', 3)
      ),
      '%s'::uuid, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT rol1::text FROM fx), (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx),
         (SELECT rol2::text FROM fx), (SELECT variant_y::text FROM fx), (SELECT unit_ea::text FROM fx),
         (SELECT loc_final::text FROM fx)),
  '1. batch putaway: one call with two lines and one destination succeeds (one 801 document, two lines)'
);

-- 2. Partial quantity preserved: rol1 had 5 at receiving, moved 3 -> 2 remains at receiving.
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_recv FROM fx)),
  2::numeric,
  '2. partial-quantity putaway leaves the correct remainder (2 of 5) at the receiving location'
);

-- 3. Destination correctly credited for both lines.
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_final FROM fx)),
  3::numeric,
  '3. destination bin is credited with the exact moved quantity for rol1'
);
SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol2 FROM fx) AND location_id = (SELECT loc_final FROM fx)),
  3::numeric,
  '3b. destination bin is credited with the exact moved quantity for rol2 (all of it, since rol2 had no partial)'
);

-- 4. Requesting more than currently attributed at receiving is rejected, not
--    silently clamped.
SELECT throws_ok(
  format($sql$
    SELECT putaway_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('repair_order_line_id', '%s', 'variant_id', '%s', 'unit_id', '%s', 'quantity', 999)),
      '%s'::uuid, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT rol1::text FROM fx), (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx),
         (SELECT loc_final::text FROM fx)),
  '22023',
  NULL,
  '4. requesting more than currently attributed at the receiving location is rejected (not silently clamped)'
);

-- =====================================================================
-- 5a-5e. UNKNOWN-source rejection (external review, third pass, items 1-5):
--    mark (loc_recv, variant_x) UNKNOWN (simulating an earlier ambiguous
--    generic movement there -- e.g. Zone 6's own relocation UI), then
--    attempt to putaway the remaining 2 units of rol1. The caller naming
--    the exact repair_order_line_id is NOT physical proof once the bucket
--    itself has lost provenance -- the RPC must independently reject this,
--    never relying on the UI to have already filtered it out.
-- =====================================================================
INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
SELECT org, branch, loc_recv, variant_x FROM fx;

SELECT throws_ok(
  format($sql$
    SELECT putaway_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('repair_order_line_id', '%s', 'variant_id', '%s', 'unit_id', '%s', 'quantity', 2)),
      '%s'::uuid, '097-test-unknown-source-key'
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         (SELECT rol1::text FROM fx), (SELECT variant_x::text FROM fx), (SELECT unit_ea::text FROM fx),
         (SELECT loc_final::text FROM fx)),
  '55000',
  NULL,
  '5a. putaway from a receiving bucket flagged UNKNOWN is a HARD ERROR -- naming the exact repair_order_line_id does not override the bucket''s own lost provenance'
);

SELECT is(
  (SELECT count(*)::int FROM inventory_movement_headers WHERE idempotency_key = '097-test-unknown-source-key'),
  0,
  '5b. the rejected UNKNOWN-source putaway created NO 801 movement at all -- the whole operation is atomic, not partially posted'
);

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_recv FROM fx)),
  2::numeric,
  '5c. the rejected UNKNOWN-source putaway left the source (receiving) projection completely unchanged'
);

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol1 FROM fx) AND location_id = (SELECT loc_final FROM fx)),
  3::numeric,
  '5d. the rejected UNKNOWN-source putaway left the destination projection completely unchanged'
);

SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_recv FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '5e. the UNKNOWN marker at the receiving location remains -- a rejected putaway does not itself resolve or clear it'
);

-- =====================================================================
-- 6a-6c. Destination-UNKNOWN retention (external review, third pass, item
--    6): a destination bucket already marked UNKNOWN keeps that marker
--    even after gaining a real, KNOWN contribution -- putaway proves the
--    one line it moved, never the whole destination bucket. Uses a fresh,
--    isolated fixture (rol3/variant_z/loc_dest2) so this scenario cannot
--    be affected by test 5's still-UNKNOWN receiving-location marker.
-- =====================================================================
DO $$
DECLARE
  v_rol3 uuid := gen_random_uuid();
  v_variant_z uuid := gen_random_uuid();
  v_loc_dest2 uuid := gen_random_uuid();
BEGIN
  INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
  SELECT v_loc_dest2, org, branch, '097-test dest2', '097-A-02', true FROM fx;
  INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_name, ordered_quantity, status)
  SELECT v_rol3, ro, v_variant_z, '097-test product 3', 4, 'pending' FROM fx;
  INSERT INTO repair_order_line_locations (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
  SELECT org, branch, ro, v_rol3, v_variant_z, loc_recv, 4 FROM fx;
  INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
  SELECT org, branch, v_loc_dest2, v_variant_z FROM fx;

  PERFORM set_config('zone5_test.rol3', v_rol3::text, true);
  PERFORM set_config('zone5_test.variant_z', v_variant_z::text, true);
  PERFORM set_config('zone5_test.loc_dest2', v_loc_dest2::text, true);
END $$;

SELECT lives_ok(
  format($sql$
    SELECT putaway_repair_order_stock(
      '%s'::uuid, '%s'::uuid, '%s'::uuid,
      jsonb_build_array(jsonb_build_object('repair_order_line_id', '%s', 'variant_id', '%s', 'unit_id', '%s', 'quantity', 4)),
      '%s'::uuid, gen_random_uuid()::text
    )
  $sql$, (SELECT e2e_user::text FROM fx), (SELECT org::text FROM fx), (SELECT branch::text FROM fx),
         current_setting('zone5_test.rol3', true), current_setting('zone5_test.variant_z', true),
         (SELECT unit_ea::text FROM fx), current_setting('zone5_test.loc_dest2', true)),
  '6a. putaway of a KNOWN source line into a destination bucket already marked UNKNOWN succeeds -- the source''s own known attribution is unaffected by the destination''s pre-existing uncertainty'
);

SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = current_setting('zone5_test.rol3', true)::uuid AND location_id = current_setting('zone5_test.loc_dest2', true)::uuid),
  4::numeric,
  '6b. the destination bucket is genuinely credited with the real, known contribution'
);

SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = current_setting('zone5_test.loc_dest2', true)::uuid AND variant_id = current_setting('zone5_test.variant_z', true)::uuid),
  '6c. the destination bucket''s pre-existing UNKNOWN marker still remains -- gaining one known contribution does not reconcile or clear the whole bucket'
);

-- =====================================================================
-- 7. Lock-order structural proof (external review, third pass, item 7) --
--    best-effort and HONESTLY LIMITED: this proves the function's own
--    SOURCE TEXT never takes a FOR UPDATE lock on
--    repair_order_line_locations / repair_order_location_attribution_uncertain
--    before calling inventory_create_and_finalize (the previous revision's
--    lock-order inversion, now fixed -- see the migration's own header for
--    the full deadlock analysis). It does NOT and CANNOT prove the absence
--    of a deadlock under real concurrent load, nor confirm
--    inventory_finalize_posting's own actual locking behavior (that
--    requires the live two-session test documented in review-context.md).
-- =====================================================================
SELECT ok(
  position('FOR UPDATE' in pg_get_functiondef('public.putaway_repair_order_stock'::regproc))
    > position('inventory_create_and_finalize(' in pg_get_functiondef('public.putaway_repair_order_stock'::regproc)),
  '7. (structural only, not a concurrency proof) no FOR UPDATE clause appears before the engine call in putaway_repair_order_stock''s own source -- the previous lock-order inversion is fixed'
);

-- 8. No repair_order_line_movement_links row was written by any putaway
--    call above -- putaway is not a business-quantity event.
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_movement_links WHERE relation_type = 'putaway'),
  0,
  '8. no repair_order_line_movement_links row with relation_type=''putaway'' exists -- that value is never written, by design'
);

SELECT * FROM finish();
ROLLBACK;
