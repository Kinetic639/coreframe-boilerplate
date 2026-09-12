-- ============================================================================
-- TEST: Zone 5 Phase 6 -- putaway_repair_order_stock RPC (batch behavior,
-- UNKNOWN-marker non-clearing)
-- ============================================================================
-- Verifies:
--   apps/web/supabase-target/supabase/migrations/
--   20260912094000_zone5_putaway_repair_order_stock_rpc.sql
--
-- NOT EXECUTED this session -- Supabase MCP / live DB access was unavailable.
-- Same inventory_create_and_finalize live-dependency caveat as test 096.

BEGIN;

SELECT plan(7);

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

-- 5. UNKNOWN-marker non-clearing: mark (loc_recv, variant_x) UNKNOWN
--    (simulating an earlier ambiguous generic movement there), then putaway
--    the remaining known 2 units of rol1 -- the marker must remain, since
--    this RPC only proves ONE line, not the whole bucket.
INSERT INTO repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
SELECT org, branch, loc_recv, variant_x FROM fx;

PERFORM putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol1 FROM fx), 'variant_id', (SELECT variant_x FROM fx), 'unit_id', (SELECT unit_ea FROM fx), 'quantity', 2)),
  (SELECT loc_final FROM fx), gen_random_uuid()::text
);

SELECT ok(
  EXISTS (SELECT 1 FROM repair_order_location_attribution_uncertain WHERE organization_id = (SELECT org FROM fx) AND location_id = (SELECT loc_recv FROM fx) AND variant_id = (SELECT variant_x FROM fx)),
  '5. a single RepairOrder-aware putaway call does NOT clear a pre-existing bucket-wide UNKNOWN marker -- it only proves the one line it moved'
);

-- 6. No repair_order_line_movement_links row was written by any putaway
--    call above -- putaway is not a business-quantity event.
SELECT is(
  (SELECT count(*)::int FROM repair_order_line_movement_links WHERE relation_type = 'putaway'),
  0,
  '6. no repair_order_line_movement_links row with relation_type=''putaway'' exists -- that value is never written, by design'
);

SELECT * FROM finish();
ROLLBACK;
