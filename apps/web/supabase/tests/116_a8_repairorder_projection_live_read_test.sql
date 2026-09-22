-- ============================================================================
-- TEST: A8 -- RepairOrder Projection Simplification: architecture-transition
-- assertions.
-- ============================================================================
-- Rewritten 107 (IC-5) covers the business-scenario correctness of the new
-- live-read architecture (receipt attribution, same-SKU independence,
-- multi-location independence, full/partial putaway, reversal, split
-- attribution, unattributed remainder, atomic rollback, cross-org
-- isolation, no-over-attribution). This file covers the architecture-
-- TRANSITION-specific assertions the task's own spec calls out separately:
-- the old mechanisms are structurally gone (trigger, trigger function,
-- both rebuild RPCs, both projection tables), the new mechanism has the
-- correct grant/security shape and exactly one overload, and a generic
-- movement no longer executes any hidden RepairOrder projection logic at
-- all (not even a no-op) -- the entire incremental subsystem is gone, not
-- merely disabled.
--
-- Executed live against supabase-target via psql.

BEGIN;

SELECT plan(17);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ============================================================================
-- A/B: incremental projection trigger and its function no longer exist.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'repair_order_line_locations_ledger_sync'),
  0::bigint, 'A1: the repair_order_line_locations_ledger_sync trigger no longer exists'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'repair_order_location_attribution_sync'),
  0::bigint, 'A2: the repair_order_location_attribution_sync trigger function no longer exists'
);

-- Generic ledger/audit triggers on the SAME table are untouched -- only
-- the RepairOrder domain projection trigger was in scope for removal.
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'inventory_stock_ledger_entries' AND NOT t.tgisinternal) > 0,
  'A3: inventory_stock_ledger_entries still has its own generic (non-RepairOrder) triggers intact -- only the domain projection trigger was removed'
);

-- ============================================================================
-- C/D: both rebuild RPCs (the public wrapper and its internal bucket
-- helper) no longer exist -- their entire purpose was maintaining the now-
-- removed persisted tables.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'rebuild_repair_order_location_projection'),
  0::bigint, 'C1: the public rebuild_repair_order_location_projection RPC no longer exists'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'rebuild_repair_order_projection_bucket_internal'),
  0::bigint, 'C2: the internal rebuild_repair_order_projection_bucket_internal helper no longer exists'
);

-- ============================================================================
-- E/F: both persisted projection tables are dropped (immediate removal,
-- not staged -- see the A8 review bundle's disposition-decision writeup).
-- repair_order_line_movement_links (canonical attribution, kept) still
-- exists, unaffected.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_class WHERE relname = 'repair_order_line_locations' AND relnamespace = 'public'::regnamespace),
  0::bigint, 'E1: the repair_order_line_locations table no longer exists'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_class WHERE relname = 'repair_order_location_attribution_uncertain' AND relnamespace = 'public'::regnamespace),
  0::bigint, 'E2: the repair_order_location_attribution_uncertain table no longer exists'
);
INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) FROM pg_class WHERE relname = 'repair_order_line_movement_links' AND relnamespace = 'public'::regnamespace) = 1,
  'F1: repair_order_line_movement_links (the sole persisted attribution source) is untouched -- still exists'
);

-- ============================================================================
-- G/H: the new live-read primitive exists with the correct shape -- one
-- overload, SECURITY INVOKER (no actor/permission check needed, RLS
-- already scopes every underlying table), correct grants.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'get_repair_order_line_physical_state'),
  1::bigint, 'G1: get_repair_order_line_physical_state exists with exactly one overload -- no stale duplicate'
);
INSERT INTO test_log(line) SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE proname = 'get_repair_order_line_physical_state'),
  'G2: get_repair_order_line_physical_state is SECURITY INVOKER, not DEFINER -- it relies entirely on the caller''s own RLS-scoped visibility, matching this read-only method''s pre-A8 design'
);
INSERT INTO test_log(line) SELECT ok(
  has_function_privilege('authenticated', 'public.get_repair_order_line_physical_state(uuid,uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_repair_order_line_physical_state(uuid,uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_repair_order_line_physical_state(uuid,uuid,uuid)', 'EXECUTE'),
  'H1: grants are authenticated=true, anon=false, service_role=true'
);

-- ============================================================================
-- I: a generic, non-RepairOrder-aware movement no longer executes ANY
-- hidden RepairOrder projection logic on a ledger insert -- not a no-op
-- trigger, no trigger AT ALL. Proven functionally: perform a generic
-- decrease at a bucket that ALREADY carries RepairOrder attribution
-- history (the exact scenario that used to invoke ~80 lines of heuristic
-- logic) and confirm zero NEW repair_order_line_movement_links rows were
-- created as a side effect (the only possible artifact the old trigger
-- could have left behind), while the call itself succeeds with no error
-- (proving nothing exceptional/blocking fires either).
-- ============================================================================

SET LOCAL ambra.inventory_movement_engine = 'on';

CREATE TEMP TABLE ifx (
  org uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid,
  branch uuid, ro uuid, rol_i uuid, recv_loc uuid
);
INSERT INTO ifx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da', '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d',
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT ON ifx TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, 'a8-transition-i-branch', 818 FROM ifx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT recv_loc, org, branch, 'a8-transition-i-recv', 'A8TI', true, 'receiving' FROM ifx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, 'a8-transition-i-RO', 'open' FROM ifx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_i, ro, variant_1, 'A8T-SKU', 'a8 transition line I', 10, 'pcs' FROM ifx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM ifx)::text, 'role','authenticated')::text, true);

CREATE TEMP TABLE recv_i AS
SELECT inventory_create_and_finalize(org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 10, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user) AS result FROM ifx;
CREATE TEMP TABLE ml_i AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_i);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM ifx), (SELECT rol_i FROM ifx), (SELECT movement_line_id FROM ml_i), 10, 'receipt');

CREATE TEMP TABLE links_before AS SELECT count(*) AS n FROM repair_order_line_movement_links;

-- A GENERIC (non-RepairOrder-aware) decrease at the SAME attributed bucket
-- -- pre-A8, this exact case invoked the trigger's own heuristic branch.
SELECT inventory_create_and_finalize(org, branch, '402',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 4, 'source_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user) FROM ifx;

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM repair_order_line_movement_links) - (SELECT n FROM links_before),
  0::bigint, 'I1: a generic movement at an attributed bucket creates ZERO new repair_order_line_movement_links rows -- no hidden RepairOrder logic runs on generic ledger writes at all'
);

-- And the live read now correctly reports the reduced state -- proving
-- the generic decrease was NOT silently absorbed into line I's own
-- attribution (it simply isn't a canonical link, so the live formula
-- doesn't count it as this line's own loss -- physical truth alone
-- reflects it).
INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id=(SELECT org FROM ifx) AND branch_id=(SELECT branch FROM ifx) AND location_id=(SELECT recv_loc FROM ifx) AND variant_id=(SELECT variant_1 FROM ifx)),
  6::numeric, 'I2: physical truth correctly reflects the generic decrease (10 - 4 = 6)'
);

-- This is precisely the P0008 scenario (live read of line I now finds
-- 10 known vs. 6 physical) -- confirms the read-time contract fires
-- exactly where expected, re-proving the reproduction from this pass's
-- own pre-implementation live gap analysis.
DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM get_repair_order_line_physical_state((SELECT org FROM ifx), (SELECT branch FROM ifx), (SELECT rol_i FROM ifx));
    INSERT INTO test_log(line) SELECT fail('I3: expected P0008 (generic decrease created a real, unrepresented history gap), succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0008', 'I3: the live read explicitly reports the resulting inconsistency (P0008) -- consistent with the original pre-implementation gap reproduction, not silently absorbed');
  END;
END;
$$;

-- ============================================================================
-- J: receive/putaway create canonical attribution but no persisted
-- projection write (there is no table left to write to -- the ONLY
-- persisted effect of a receipt/putaway is now the canonical link).
-- ============================================================================

-- Deliberately a FRESH branch/receiving-location, isolated from
-- Scenario I's own deliberately-corrupted bucket above (same variant
-- would otherwise collide with I's own bucket-level inconsistency).
CREATE TEMP TABLE jfx AS SELECT gen_random_uuid() AS j_branch, gen_random_uuid() AS j_recv, gen_random_uuid() AS rol_j, gen_random_uuid() AS shelf_j;
GRANT SELECT ON jfx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT j_branch, (SELECT org FROM ifx), 'a8-transition-j-branch', 819 FROM jfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT j_recv, (SELECT org FROM ifx), j_branch, 'a8-transition-j-recv', 'A8TJR', true, 'receiving' FROM jfx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM ifx), j_branch, 'a8-transition-j-RO', 'open' FROM jfx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_j, (SELECT id FROM repair_orders WHERE branch_id = (SELECT j_branch FROM jfx)), (SELECT variant_1 FROM ifx), 'A8T-SKU', 'a8 transition line J', 5, 'pcs' FROM jfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT shelf_j, (SELECT org FROM ifx), j_branch, 'a8-transition-j-shelf', 'A8TJ', true FROM jfx;

CREATE TEMP TABLE recv_j AS
SELECT inventory_create_and_finalize((SELECT org FROM ifx), (SELECT j_branch FROM jfx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM ifx), 'unit_id', (SELECT unit_1 FROM ifx), 'quantity', 5, 'destination_location_id', (SELECT j_recv FROM jfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM ifx)) AS result;
CREATE TEMP TABLE ml_j AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_j);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM ifx), (SELECT rol_j FROM jfx), (SELECT movement_line_id FROM ml_j), 5, 'receipt');

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_j FROM jfx) AND relation_type = 'receipt') = 1,
  'J1: receive_repair_order_stock''s own effect is exactly one canonical receipt link -- no other persisted RepairOrder-domain write exists to check (the old table is gone)'
);

CREATE TEMP TABLE putaway_j AS
SELECT putaway_repair_order_stock((SELECT e2e_user FROM ifx), (SELECT org FROM ifx), (SELECT j_branch FROM jfx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_j FROM jfx), 'variant_id', (SELECT variant_1 FROM ifx), 'unit_id', (SELECT unit_1 FROM ifx), 'quantity', 5)),
  (SELECT shelf_j FROM jfx), NULL) AS result;

INSERT INTO test_log(line) SELECT ok(
  (SELECT count(*) FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_j FROM jfx) AND relation_type = 'relocation') = 1,
  'J2: putaway_repair_order_stock''s own effect is exactly one canonical relocation link'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM jfx, jsonb_array_elements(get_repair_order_line_physical_state((SELECT org FROM ifx), j_branch, rol_j)->'locations') loc WHERE loc->>'location_id' = shelf_j::text),
  5::numeric, 'J3: the live read correctly reflects the putaway using only the canonical link -- no persisted projection was needed'
);

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
