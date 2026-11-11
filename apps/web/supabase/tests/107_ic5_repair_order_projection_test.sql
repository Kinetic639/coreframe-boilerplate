-- ============================================================================
-- TEST: IC-5 -- RepairOrder Physical Projection (REWRITTEN for A8)
-- ============================================================================
-- A8 (2026-09-22) removed the incremental repair_order_line_locations/
-- repair_order_location_attribution_uncertain projection (trigger +
-- persisted tables) and replaced it with get_repair_order_line_physical_
-- state -- a live, read-only computation over canonical data
-- (repair_order_line_movement_links + inventory_stock_ledger_entries +
-- inventory_balances), reversal-aware via a read-time JOIN following
-- inventory_movement_headers.reversal_movement_id (NOT via a mirrored
-- link row -- no trigger writes 'reversal'-relation_type links anymore).
--
-- This file is REWRITTEN, not merely patched, per the task's own explicit
-- instruction. Scenarios preserved: known receipt attribution, same-SKU
-- independence, multi-location independence, full putaway, partial
-- putaway, reversal (single-line and split-attribution), full/partial
-- putaway reversal, unattributed remainder, atomic rollback, cross-org
-- isolation, no-over-attribution (P0008), live-computation correctness,
-- repeated-read idempotency. Removed: everything tied specifically to
-- persisted projection side effects, trigger rows, the old heuristic
-- UNKNOWN-marker scenarios (H/I -- there is no more incremental guessing
-- to be ambiguous about), rebuild-vs-incremental equality (K/L -- there
-- is no more separate rebuild; replaced by repeated-read idempotency),
-- and raw-write denial on the now-dropped projection tables (M).
--
-- Does NOT re-prove IC-0/1/2/3/4/7A's own business logic -- that is
-- 097-106's own job, re-run unmodified as part of this pass's own full
-- regression. Does NOT reopen the accepted receive/putaway contracts;
-- both are exercised here exactly as they already existed (physical
-- movement path unchanged by A8).
--
-- Executed live against supabase-target via psql.

BEGIN;

SELECT plan(31);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

SET LOCAL ambra.inventory_movement_engine = 'on';

CREATE TEMP TABLE fx (
  org uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid,
  branch uuid, ro uuid,
  rol_a uuid, rol_b uuid, rol_c uuid, rol_d uuid,
  recv_loc uuid, shelf_a uuid, shelf_b uuid
);
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4',
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da', '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d',
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
GRANT SELECT ON fx TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, 'ic5-a8-branch', 815 FROM fx;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT recv_loc, org, branch, 'ic5-a8-receiving', 'IC5A8R', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT shelf_a, org, branch, 'ic5-a8-shelf-a', 'IC5A8A', true FROM fx
UNION ALL SELECT shelf_b, org, branch, 'ic5-a8-shelf-b', 'IC5A8B', true FROM fx;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, 'ic5-a8-RO', 'open' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_a, ro, variant_1, 'ic5-SKU', 'ic5a8 line A', 6, 'pcs' FROM fx
UNION ALL SELECT rol_b, ro, variant_1, 'ic5-SKU', 'ic5a8 line B (same SKU as A)', 4, 'pcs' FROM fx
UNION ALL SELECT rol_c, ro, variant_1, 'ic5-SKU', 'ic5a8 line C', 5, 'pcs' FROM fx
UNION ALL SELECT rol_d, ro, variant_1, 'ic5-SKU', 'ic5a8 line D', 3, 'pcs' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

-- Small helper macro pattern used throughout this file: extract a specific
-- location's own quantity from get_repair_order_line_physical_state's own
-- jsonb result, or NULL if that location is absent (the RPC omits any
-- location whose own net contribution is exactly zero).
-- (SELECT (loc->>'quantity')::numeric
--    FROM jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_id)->'locations') loc
--   WHERE loc->>'location_id' = location_id::text)

-- ============================================================================
-- SCENARIO A/B: known receipt, split across two same-SKU lines (6+4=10).
-- ============================================================================

CREATE TEMP TABLE recv_ab AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 10, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;

CREATE TEMP TABLE ml_ab AS
SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT (result->>'movement_id')::uuid FROM recv_ab);

SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 6, 'receipt');
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_b FROM fx), (SELECT movement_line_id FROM ml_ab), 4, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_a)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  6::numeric, 'A1: line A live-read physical = 6, split correctly'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_b)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  4::numeric, 'B1: same-SKU line B independently = 4, never merged into A'
);

-- ============================================================================
-- SCENARIO C/D: one RepairOrderLine across multiple locations (putaway split).
-- ============================================================================

CREATE TEMP TABLE recv_c AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_c AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_c);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_c FROM fx), (SELECT movement_line_id FROM ml_c), 5, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_c)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  5::numeric, 'C0: line C live-read physical = 5 before putaway'
);

CREATE TEMP TABLE putaway_d AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_c FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  (SELECT shelf_a FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_c)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  NULL::numeric, 'D1: after FULL putaway, receiving-location no longer appears for line C at all (net zero, correctly omitted, not a stale zero row)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_c)->'locations') loc WHERE loc->>'location_id' = shelf_a::text),
  5::numeric, 'D2: shelf-a now holds line C''s own 5 units'
);

-- Multi-location independence + repeated-read idempotency, combined: read
-- BOTH line C's (shelf-a) and line A's (receiving) live state TWICE each --
-- a pure function of canonical data, so a second call must be byte-
-- identical to the first, and neither line's own result may be affected
-- by the other's own activity.
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_c)->'locations') loc WHERE loc->>'location_id' = shelf_a::text),
  5::numeric, 'C1: line C''s own shelf-a contribution (5), read a SECOND time, is byte-identical (idempotent live computation)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_a)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  6::numeric, 'C2: line A''s own receiving-location contribution (6) is untouched by line C''s own putaway activity (multi-location/multi-line independence)'
);

-- ============================================================================
-- SCENARIO E: genuine partial putaway.
-- ============================================================================

CREATE TEMP TABLE recv_e AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 3, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_e AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_e);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_d FROM fx), (SELECT movement_line_id FROM ml_e), 3, 'receipt');

CREATE TEMP TABLE putaway_e2 AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_d FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 1)),
  (SELECT shelf_b FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_d)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  2::numeric, 'E1: partial putaway -- receiving location retains the remaining 2 of line D''s own 3'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_d)->'locations') loc WHERE loc->>'location_id' = shelf_b::text),
  1::numeric, 'E2: partial putaway -- shelf-b receives exactly the moved 1'
);

-- ============================================================================
-- SCENARIO F: single-line receipt reversal -- live read nets to nothing.
-- ============================================================================

CREATE TEMP TABLE recv_f AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 7, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;

CREATE TEMP TABLE fline_f AS
SELECT gen_random_uuid() AS rol_f;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_f, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5a8 line F', 7, 'pcs' FROM fline_f;

CREATE TEMP TABLE ml_f AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_f);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_f FROM fline_f), (SELECT movement_line_id FROM ml_f), 7, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, fline_f, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_f)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  7::numeric, 'F1: line F live-read physical = 7 before reversal'
);

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM recv_f), (SELECT e2e_user FROM fx), 'A8 reversal test F');

INSERT INTO test_log(line) SELECT is(
  (SELECT jsonb_array_length(get_repair_order_line_physical_state(org, branch, rol_f)->'locations') FROM fx, fline_f),
  0, 'F2: after fully reversing its own only contribution, line F''s own live read has ZERO locations -- nets cleanly, no false P0008 (no mirrored link needed: read-time reversal JOIN, not a write-time mirror)'
);

-- ============================================================================
-- SCENARIO G: split-attribution reversal -- both lines' contributions
-- removed exactly, independently.
-- ============================================================================

CREATE TEMP TABLE recv_g AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 10, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE gline_g AS
SELECT gen_random_uuid() AS rol_g1, gen_random_uuid() AS rol_g2;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_g1, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5a8 line G1', 6, 'pcs' FROM gline_g
UNION ALL SELECT rol_g2, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5a8 line G2', 4, 'pcs' FROM gline_g;

CREATE TEMP TABLE ml_g AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_g);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_g1 FROM gline_g), (SELECT movement_line_id FROM ml_g), 6, 'receipt');
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_g2 FROM gline_g), (SELECT movement_line_id FROM ml_g), 4, 'receipt');

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM recv_g), (SELECT e2e_user FROM fx), 'A8 split reversal test G');

INSERT INTO test_log(line) SELECT is(
  (SELECT jsonb_array_length(get_repair_order_line_physical_state(org, branch, rol_g1)->'locations') FROM fx, gline_g),
  0, 'G1: line G1 (was 6) fully cleared by split-attribution reversal'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT jsonb_array_length(get_repair_order_line_physical_state(org, branch, rol_g2)->'locations') FROM fx, gline_g),
  0, 'G2: line G2 (was 4) fully cleared by split-attribution reversal, independently of G1 -- proportional per-line netting, not a shared pool'
);

-- ============================================================================
-- SCENARIO J: partial attribution / unattributed remainder is never
-- fabricated as belonging to the attributed line.
-- ============================================================================

CREATE TEMP TABLE jfx AS SELECT gen_random_uuid() AS j_branch, gen_random_uuid() AS j_loc, gen_random_uuid() AS j_rol;
GRANT SELECT ON jfx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT j_branch, (SELECT org FROM fx), 'ic5-a8-j-branch', 816 FROM jfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT j_loc, (SELECT org FROM fx), j_branch, 'ic5-a8-j-loc', 'IC5A8J', true, 'receiving' FROM jfx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), j_branch, 'ic5-a8-j-RO', 'open' FROM jfx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT j_rol, (SELECT id FROM repair_orders WHERE branch_id = j_branch), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5a8 line J', 6, 'pcs' FROM jfx;

SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT j_branch FROM jfx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 10, 'destination_location_id', (SELECT j_loc FROM jfx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
CREATE TEMP TABLE jml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT id FROM inventory_movement_headers WHERE branch_id=(SELECT j_branch FROM jfx) ORDER BY created_at DESC LIMIT 1);

-- Only 6 of the 10 physical units are attributed; the remaining 4 are
-- never claimed by any RepairOrderLine.
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT j_rol FROM jfx), (SELECT movement_line_id FROM jml), 6, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM jfx, jsonb_array_elements(get_repair_order_line_physical_state((SELECT org FROM fx), j_branch, j_rol)->'locations') loc WHERE loc->>'location_id' = j_loc::text),
  6::numeric, 'J1: line J''s own live read claims exactly its own attributed 6, never the whole 10 -- unattributed stock is never fabricated as belonging to it'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id=(SELECT org FROM fx) AND branch_id=(SELECT j_branch FROM jfx) AND location_id=(SELECT j_loc FROM jfx) AND variant_id=(SELECT variant_1 FROM fx)),
  10::numeric, 'J2: physical truth (inventory_balances) still correctly shows the full 10 -- the unattributed 4 is real physical stock, simply not claimed by any RepairOrderLine (no more UNKNOWN marker to represent this -- physical truth itself is the answer)'
);

-- ============================================================================
-- SCENARIO O: no negative/over-attribution -- the live read hard-errors
-- (P0008) rather than clamps or silently misreports, on a fabricated
-- history inconsistency (structurally impossible via any real RPC;
-- reachable here only by directly corrupting physical balance downward,
-- raw-superuser, test setup only).
-- ============================================================================

RESET ROLE;
CREATE TEMP TABLE ofx AS SELECT gen_random_uuid() AS o_branch, gen_random_uuid() AS o_loc, gen_random_uuid() AS o_rol;
GRANT SELECT ON ofx TO authenticated;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT o_branch, (SELECT org FROM fx), 'ic5-a8-o-branch', 817 FROM ofx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory, purpose)
SELECT o_loc, (SELECT org FROM fx), o_branch, 'ic5-a8-o-loc', 'IC5A8O', true, 'receiving' FROM ofx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT gen_random_uuid(), (SELECT org FROM fx), o_branch, 'ic5-a8-o-RO', 'open' FROM ofx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT o_rol, (SELECT id FROM repair_orders WHERE branch_id = o_branch), (SELECT variant_1 FROM fx), 'ic5-SKU', 'ic5a8 line O', 2, 'pcs' FROM ofx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);
SELECT inventory_create_and_finalize((SELECT org FROM fx), (SELECT o_branch FROM ofx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 2, 'destination_location_id', (SELECT o_loc FROM ofx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx));
CREATE TEMP TABLE oml AS SELECT id AS movement_line_id FROM inventory_movement_lines
WHERE movement_id = (SELECT id FROM inventory_movement_headers WHERE branch_id=(SELECT o_branch FROM ofx) ORDER BY created_at DESC LIMIT 1);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT o_rol FROM ofx), (SELECT movement_line_id FROM oml), 2, 'receipt');

RESET ROLE;
UPDATE inventory_balances SET on_hand_quantity = 0
WHERE organization_id=(SELECT org FROM fx) AND branch_id=(SELECT o_branch FROM ofx)
  AND location_id=(SELECT o_loc FROM ofx) AND variant_id=(SELECT variant_1 FROM fx);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role','authenticated')::text, true);

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM get_repair_order_line_physical_state((SELECT org FROM fx), (SELECT o_branch FROM ofx), (SELECT o_rol FROM ofx));
    INSERT INTO test_log(line) SELECT fail('O1: expected the live read to hard-error on an impossible history, it succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, 'P0008', 'O1: live read hard-errors (P0008) on known attribution exceeding physical on_hand -- never silently clamped or misreported');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO P: atomic rollback -- a rejected over-quantity putaway leaves
-- the canonical attribution (and therefore the live read) completely
-- untouched (single transaction).
-- ============================================================================

CREATE TEMP TABLE before_p AS
SELECT (loc->>'quantity')::numeric AS quantity
FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_d)->'locations') loc
WHERE loc->>'location_id' = (SELECT recv_loc FROM fx)::text;

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    -- line D only has 2 remaining at receiving (per Scenario E) -- request 999.
    PERFORM putaway_repair_order_stock(
      (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
      jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_d FROM fx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 999)),
      (SELECT shelf_a FROM fx), NULL
    );
    INSERT INTO test_log(line) SELECT fail('P1: expected the over-quantity putaway to be rejected, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'P1: an over-quantity putaway is rejected atomically (22023)');
  END;
END;
$$;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_d)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  (SELECT quantity FROM before_p), 'P2: line D''s own receiving-location live-read quantity is byte-identical after the rejected putaway -- no partial mutation'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_d)->'locations') loc WHERE loc->>'location_id' = shelf_a::text),
  NULL::numeric, 'P3: no contribution appears at shelf-a for line D from the rejected putaway attempt'
);

-- ============================================================================
-- SCENARIO Q: FULL putaway reversal -- both source AND destination buckets
-- must net correctly via the read-time reversal JOIN (the exact case this
-- architecture must get right: the relocation's own canonical link nets
-- against its own reversal at BOTH the receiving/source and shelf/
-- destination buckets).
-- ============================================================================

CREATE TEMP TABLE qfx AS SELECT gen_random_uuid() AS rol_q;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_q, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5a8-SKU', 'ic5a8 line Q (full putaway reversal)', 5, 'pcs' FROM qfx;

CREATE TEMP TABLE recv_q AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_q AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_q);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_q FROM qfx), (SELECT movement_line_id FROM ml_q), 5, 'receipt');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, qfx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_q)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  5::numeric, 'Q0a: line Q live-read = 5 at Receiving before putaway'
);

CREATE TEMP TABLE putaway_q AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_q FROM qfx), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5)),
  (SELECT shelf_a FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, qfx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_q)->'locations') loc WHERE loc->>'location_id' = shelf_a::text),
  5::numeric, 'Q0b: line Q now holds 5 at shelf-a after full putaway'
);

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM putaway_q), (SELECT e2e_user FROM fx), 'A8 full putaway reversal test Q');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, qfx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_q)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  5::numeric, 'Q1: after reversing the FULL putaway, live read shows Receiving restored to 5 -- BOTH source and destination buckets net correctly via the read-time reversal JOIN'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, qfx, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_q)->'locations') loc WHERE loc->>'location_id' = shelf_a::text),
  NULL::numeric, 'Q2: shelf-a''s own contribution for line Q is fully netted to nothing after the reversal'
);

-- ============================================================================
-- SCENARIO R: PARTIAL putaway reversal -- same bucket-derivation
-- correctness, proven with a genuine remainder still sitting at Receiving
-- before the putaway (2 of 5), not a full-clear case.
-- ============================================================================

CREATE TEMP TABLE rfx_r AS SELECT gen_random_uuid() AS rol_r;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT rol_r, (SELECT ro FROM fx), (SELECT variant_1 FROM fx), 'ic5a8-SKU', 'ic5a8 line R (partial putaway reversal)', 5, 'pcs' FROM rfx_r;

CREATE TEMP TABLE recv_r_case AS
SELECT inventory_create_and_finalize(
  org, branch, '101',
  jsonb_build_array(jsonb_build_object('variant_id', variant_1, 'unit_id', unit_1, 'quantity', 5, 'destination_location_id', recv_loc)),
  NULL, NULL, NULL, NULL, NULL, NULL, e2e_user
) AS result FROM fx;
CREATE TEMP TABLE ml_r_case AS SELECT id AS movement_line_id FROM inventory_movement_lines WHERE movement_id=(SELECT (result->>'movement_id')::uuid FROM recv_r_case);
SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_r FROM rfx_r), (SELECT movement_line_id FROM ml_r_case), 5, 'receipt');

CREATE TEMP TABLE putaway_r_case AS
SELECT putaway_repair_order_stock(
  (SELECT e2e_user FROM fx), (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('repair_order_line_id', (SELECT rol_r FROM rfx_r), 'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3)),
  (SELECT shelf_b FROM fx), NULL
) AS result;

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, rfx_r, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_r)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  2::numeric, 'R0a: before reversal, Receiving retains the remaining 2 of line R''s own 5'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, rfx_r, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_r)->'locations') loc WHERE loc->>'location_id' = shelf_b::text),
  3::numeric, 'R0b: before reversal, shelf-b holds the moved 3'
);

SELECT inventory_reverse_movement((SELECT (result->>'movement_id')::uuid FROM putaway_r_case), (SELECT e2e_user FROM fx), 'A8 partial putaway reversal test R');

INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, rfx_r, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_r)->'locations') loc WHERE loc->>'location_id' = recv_loc::text),
  5::numeric, 'R1: after reversing the PARTIAL putaway, Receiving is restored to the full 5 (2 remaining + 3 returned)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT (loc->>'quantity')::numeric FROM fx, rfx_r, jsonb_array_elements(get_repair_order_line_physical_state(org, branch, rol_r)->'locations') loc WHERE loc->>'location_id' = shelf_b::text),
  NULL::numeric, 'R2: shelf-b''s own contribution for line R is fully netted to nothing after the reversal'
);

-- ============================================================================
-- SCENARIO U: cross-org isolation on the new live-read RPC. Deliberate
-- behavior difference from the removed rebuild RPC (which raised P0002 for
-- a fabricated org): get_repair_order_line_physical_state is SECURITY
-- INVOKER with no actor/permission check of its own (RLS does the
-- scoping, matching this method's own pre-A8 design) -- feeding a
-- mismatched organization_id simply matches zero rows at the WHERE-clause
-- level, returning an EMPTY locations array, not an error. Documented
-- here explicitly rather than assumed.
-- ============================================================================

INSERT INTO test_log(line) SELECT is(
  (SELECT jsonb_array_length((get_repair_order_line_physical_state(gen_random_uuid(), branch, rol_a))->'locations') FROM fx),
  0, 'U1: a fabricated organization_id returns an empty locations array (length 0), no error, no existence leak -- matching this read-only method''s own established no-actor-check design'
);

-- ============================================================================
-- SCENARIO S: Finding B -- the public attach contract stays FROZEN.
-- An ordinary authenticated caller can never submit the system-owned
-- relation types ('relocation'/'reversal') through attach_repair_order_
-- line_movement -- unchanged check, re-proven after A8 (this contract is
-- entirely independent of the projection removal).
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'relocation');
    INSERT INTO test_log(line) SELECT fail('S1: expected relation_type=relocation to be rejected by public attach, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'S1: authenticated caller cannot submit relation_type=relocation via the public attach RPC (system-owned type)');
  END;
END;
$$;

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'reversal');
    INSERT INTO test_log(line) SELECT fail('S2: expected relation_type=reversal to be rejected by public attach, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '22023', 'S2: authenticated caller cannot submit relation_type=reversal via the public attach RPC (system-owned type)');
  END;
END;
$$;

-- ============================================================================
-- SCENARIO T: the shared internal writer itself is unreachable directly --
-- no new client RPC was exposed by A8.
-- ============================================================================

DO $$
DECLARE v_state text;
BEGIN
  BEGIN
    PERFORM write_repair_order_line_movement_link_internal((SELECT rol_a FROM fx), (SELECT movement_line_id FROM ml_ab), 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T1: expected the internal writer to be unreachable for authenticated, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    INSERT INTO test_log(line) SELECT is(v_state, '42501', 'T1: write_repair_order_line_movement_link_internal is not directly callable by authenticated (EXECUTE revoked, no new client RPC exposed)');
  END;
END;
$$;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
