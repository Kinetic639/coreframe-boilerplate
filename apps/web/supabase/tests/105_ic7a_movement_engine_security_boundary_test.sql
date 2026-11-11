-- ============================================================================
-- TEST: IC-7A -- Emergency Movement Engine Security Boundary
-- ============================================================================
-- Proves the P0 (a fully unauthenticated `anon` caller could post arbitrary
-- physical inventory movements through inventory_create_draft/inventory_
-- finalize_posting/inventory_create_and_finalize) is genuinely closed, that
-- every real, legitimate production entry point still works, and that the
-- new checks cannot be bypassed by actor impersonation, NULL-actor tricks,
-- or manual creation of the system-only 900 movement type.
--
-- Does NOT re-prove IC-1/IC-2/IC-3's own business logic in full -- that is
-- 097-104's own job, re-run unmodified as part of this pass's own full
-- regression. This file is specifically about the NEW actor/permission
-- boundary added to the three engine functions in this pass.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(29);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

-- ============================================================================
-- SCENARIO K: anon negatives (A-H) -- EXECUTE itself must be denied.
-- ============================================================================
-- No real fixtures needed: anon lacks the EXECUTE grant entirely on every
-- one of these, so the denial happens before any argument is even
-- evaluated meaningfully. Dummy UUIDs are sufficient.

SET LOCAL ROLE anon;

DO $$ BEGIN BEGIN
  PERFORM inventory_create_draft(gen_random_uuid(), gen_random_uuid(), '101', '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-A: expected EXECUTE denial on inventory_create_draft as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-A: anon has no EXECUTE on inventory_create_draft (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_finalize_posting(gen_random_uuid(), NULL);
  INSERT INTO test_log(line) SELECT fail('K-B: expected EXECUTE denial on inventory_finalize_posting as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-B: anon has no EXECUTE on inventory_finalize_posting (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_create_and_finalize(gen_random_uuid(), gen_random_uuid(), '101', '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-C: expected EXECUTE denial on inventory_create_and_finalize as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-C: anon has no EXECUTE on inventory_create_and_finalize (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock(NULL, gen_random_uuid(), gen_random_uuid(), '[]'::jsonb, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-D: expected EXECUTE denial on inventory_receive_stock as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-D: anon has no EXECUTE on inventory_receive_stock (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock(NULL, gen_random_uuid(), gen_random_uuid(), '[]'::jsonb, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-E: expected EXECUTE denial on receive_repair_order_stock as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-E: anon has no EXECUTE on receive_repair_order_stock (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order(gen_random_uuid(), '[]'::jsonb, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-F: expected EXECUTE denial on inventory_receive_purchase_order as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-F: anon has no EXECUTE on inventory_receive_purchase_order (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_reverse_movement(gen_random_uuid(), NULL, 'anon attempt');
  INSERT INTO test_log(line) SELECT fail('K-G: expected EXECUTE denial on inventory_reverse_movement as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-G: anon has no EXECUTE on inventory_reverse_movement (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_finalize_posting_internal(gen_random_uuid(), NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('K-H: expected EXECUTE denial on inventory_finalize_posting_internal as anon, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'K-H: anon has no EXECUTE on inventory_finalize_posting_internal (42501)');
END; END $$;

RESET ROLE;

-- ============================================================================
-- SCENARIO Q: exploit replay -- the EXACT pre-fix P0 attack, as anon,
-- inside this permanent regression file. Zero physical mutation.
-- ============================================================================

CREATE TEMP TABLE fxq (org uuid, branch uuid, variant_1 uuid, unit_1 uuid, loc_a uuid);
GRANT SELECT ON fxq TO anon;
INSERT INTO fxq SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '105-ic7a-exploit-replay', 937 FROM fxq;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '105-exploit-replay-loc', true FROM fxq;

SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fxq), (SELECT branch FROM fxq), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxq), 'unit_id', (SELECT unit_1 FROM fxq), 'quantity', 777, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxq))),
    NULL, NULL, NULL, NULL, NULL, NULL, NULL
  );
  INSERT INTO test_log(line) SELECT fail('Q1: expected the exact pre-fix P0 exploit to be rejected, it SUCCEEDED -- STILL VULNERABLE');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'Q1: the exact pre-fix P0 exploit (unauthenticated anon, arbitrary org/branch, 777 units) is now rejected (42501)');
END; END $$;
RESET ROLE;

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fxq) AND branch_id = (SELECT branch FROM fxq)),
  0::bigint, 'Q2: zero movement headers exist -- the replayed exploit left no trace'
);

-- ============================================================================
-- SCENARIO L: authenticated actor lacking inventory permission -- rejected
-- by the NEW checks (not grant-level, since authenticated keeps EXECUTE).
-- ============================================================================

CREATE TEMP TABLE fxl (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid, no_perm_user uuid);
GRANT SELECT ON fxl TO authenticated;
INSERT INTO fxl SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid(),
  gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '105-ic7a-scenario-l', 938 FROM fxl;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '105-l-loc', true FROM fxl;

-- A real draft to attempt finalizing without permission (so the permission
-- check, not a not-found error, is what's actually being proven).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxl)::text, 'role', 'authenticated')::text, true);
CREATE TEMP TABLE dl AS SELECT inventory_create_draft(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 5, 'destination_location_id', (SELECT loc_a FROM fxl))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
RESET ROLE;

-- Now impersonate a real, valid but permission-less user (no_perm_user has
-- no user_effective_permissions rows at all in this org -- never granted).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT no_perm_user FROM fxl)::text, 'role', 'authenticated')::text, true);

DO $$ BEGIN BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxl))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT no_perm_user FROM fxl)
  );
  INSERT INTO test_log(line) SELECT fail('L1: expected no-permission rejection on inventory_create_draft, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'L1: authenticated actor with zero inventory permission is rejected by inventory_create_draft (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_finalize_posting(((SELECT result FROM dl)->>'movement_id')::uuid, (SELECT no_perm_user FROM fxl));
  INSERT INTO test_log(line) SELECT fail('L2: expected no-permission rejection on inventory_finalize_posting, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'L2: authenticated actor with zero inventory permission is rejected by inventory_finalize_posting on a REAL existing draft (42501)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxl))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT no_perm_user FROM fxl)
  );
  INSERT INTO test_log(line) SELECT fail('L3: expected no-permission rejection on inventory_create_and_finalize, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'L3: authenticated actor with zero inventory permission is rejected by inventory_create_and_finalize (42501)');
END; END $$;

RESET ROLE;

-- Confirm the draft dl created above was never posted by any of these
-- rejected attempts. Runs as the connecting role (RLS-bypassing) --
-- checking this as no_perm_user itself would incorrectly return NULL,
-- since no_perm_user also lacks warehouse.inventory.read and the SELECT
-- RLS policy would filter the row, not a security finding.
INSERT INTO test_log(line) SELECT is(
  (SELECT status FROM inventory_movement_headers WHERE id = ((SELECT result FROM dl)->>'movement_id')::uuid),
  'draft', 'L4: the real draft remains status=draft -- the no-permission finalize attempt left no trace'
);

-- ============================================================================
-- SCENARIO O: actor impersonation -- a real, valid, permissioned actor's
-- OWN UUID cannot be borrowed by a DIFFERENT authenticated caller.
-- ============================================================================

SET LOCAL ROLE authenticated;
-- Session actually authenticated as no_perm_user, but supplies e2e_user's
-- own (privileged) UUID as p_actor_user_id.
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT no_perm_user FROM fxl)::text, 'role', 'authenticated')::text, true);

DO $$ BEGIN BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxl))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
  );
  INSERT INTO test_log(line) SELECT fail('O1: expected actor-impersonation rejection on inventory_create_draft, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'O1: supplying a DIFFERENT (privileged) user''s UUID as p_actor_user_id is rejected (28000) -- no impersonation via borrowed UUID');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_finalize_posting(((SELECT result FROM dl)->>'movement_id')::uuid, (SELECT e2e_user FROM fxl));
  INSERT INTO test_log(line) SELECT fail('O2: expected actor-impersonation rejection on inventory_finalize_posting, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'O2: same impersonation attempt against inventory_finalize_posting is rejected (28000)');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxl))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
  );
  INSERT INTO test_log(line) SELECT fail('O3: expected actor-impersonation rejection on inventory_create_and_finalize, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'O3: same impersonation attempt against inventory_create_and_finalize is rejected (28000)');
END; END $$;

RESET ROLE;

-- ============================================================================
-- SCENARIO P: NULL actor -- omitting p_actor_user_id is not a bypass.
-- ============================================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxl)::text, 'role', 'authenticated')::text, true);

DO $$ BEGIN BEGIN
  PERFORM inventory_create_draft(
    (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxl))),
    NULL, NULL, NULL, NULL, NULL, NULL, NULL
  );
  INSERT INTO test_log(line) SELECT fail('P1: expected NULL-actor rejection on inventory_create_draft, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'P1: p_actor_user_id=NULL is rejected (28000), even from a genuinely authenticated session');
END; END $$;

DO $$ BEGIN BEGIN
  PERFORM inventory_finalize_posting(((SELECT result FROM dl)->>'movement_id')::uuid, NULL);
  INSERT INTO test_log(line) SELECT fail('P2: expected NULL-actor rejection on inventory_finalize_posting, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'P2: p_actor_user_id=NULL is rejected (28000) on inventory_finalize_posting too');
END; END $$;

RESET ROLE;

-- ============================================================================
-- SCENARIO R: system-only movement type 900 cannot be manually created,
-- while every REAL manually-created type (101/401/402/801) still can.
-- ============================================================================

DO $$ BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxl)::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM inventory_create_draft(
      (SELECT org FROM fxl), (SELECT branch FROM fxl), '900',
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1)),
      NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
    );
    INSERT INTO test_log(line) SELECT fail('R1: expected system-type-900 manual-creation rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'R1: manually creating a system-only 900 (reversal) draft is rejected (42501)');
  END;
END $$;
RESET ROLE;

-- ============================================================================
-- SCENARIO M: every real, legitimate authenticated flow still works.
-- ============================================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxl)::text, 'role', 'authenticated')::text, true);

-- M1: generic 101 receipt via inventory_create_and_finalize, properly permissioned.
CREATE TEMP TABLE m1 AS SELECT inventory_create_and_finalize(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxl))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M1: generic 101 receipt via inventory_create_and_finalize still succeeds for a properly-permissioned actor') FROM m1;

-- M2: IC-3 canonical primitive still works.
CREATE TEMP TABLE m2loc AS SELECT gen_random_uuid() AS id;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT id, (SELECT org FROM fxl), (SELECT branch FROM fxl), '105-m2-loc', true FROM m2loc;
CREATE TEMP TABLE m2 AS SELECT inventory_receive_stock(
  (SELECT e2e_user FROM fxl), (SELECT org FROM fxl), (SELECT branch FROM fxl),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 8, 'destination_location_id', (SELECT id FROM m2loc))),
  NULL, NULL, NULL, NULL, NULL
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M2: IC-3 canonical inventory_receive_stock (nested nested call through the newly-hardened engine) still succeeds') FROM m2;

-- M3: two-step draft+finalize (matching quickReceiptAction's own real pattern) still works.
CREATE TEMP TABLE m3draft AS SELECT inventory_create_draft(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 3, 'destination_location_id', (SELECT loc_a FROM fxl))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
CREATE TEMP TABLE m3 AS SELECT inventory_finalize_posting(((SELECT result FROM m3draft)->>'movement_id')::uuid, (SELECT e2e_user FROM fxl)) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M3: two-step create_draft + finalize_posting (the real quickReceiptAction pattern) still succeeds') FROM m3;

-- M4: 401 adjustment increase still works (direct two-step, matching inventory_approve_count_session's own pattern).
CREATE TEMP TABLE m4draft AS SELECT inventory_create_draft(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '401',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 2, 'destination_location_id', (SELECT loc_a FROM fxl))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
CREATE TEMP TABLE m4 AS SELECT inventory_finalize_posting(((SELECT result FROM m4draft)->>'movement_id')::uuid, (SELECT e2e_user FROM fxl)) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M4: 401 adjustment increase (create_draft + finalize_posting) still succeeds') FROM m4;

-- M5: 402 adjustment decrease still works (stock now available from M1/M3/M4 at loc_a).
CREATE TEMP TABLE m5draft AS SELECT inventory_create_draft(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '402',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 2, 'source_location_id', (SELECT loc_a FROM fxl))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
CREATE TEMP TABLE m5 AS SELECT inventory_finalize_posting(((SELECT result FROM m5draft)->>'movement_id')::uuid, (SELECT e2e_user FROM fxl)) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M5: 402 adjustment decrease (where stock permits) still succeeds') FROM m5;

-- M6: 801 relocation still works.
CREATE TEMP TABLE m6loc AS SELECT gen_random_uuid() AS id;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT id, (SELECT org FROM fxl), (SELECT branch FROM fxl), '105-m6-loc', true FROM m6loc;
CREATE TEMP TABLE m6 AS SELECT inventory_create_and_finalize(
  (SELECT org FROM fxl), (SELECT branch FROM fxl), '801',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxl), 'unit_id', (SELECT unit_1 FROM fxl), 'quantity', 1, 'source_location_id', (SELECT loc_a FROM fxl), 'destination_location_id', (SELECT id FROM m6loc))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxl)
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M6: 801 relocation via inventory_create_and_finalize still succeeds') FROM m6;

-- M7: reversal still works (reverses M1's own receipt).
CREATE TEMP TABLE m7 AS SELECT inventory_reverse_movement(((SELECT result FROM m1)->>'movement_id')::uuid, (SELECT e2e_user FROM fxl), '105 security-pass reversal regression') AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M7: inventory_reverse_movement (nested call through the newly-hardened inventory_finalize_posting_internal) still succeeds') FROM m7;

RESET ROLE;

-- M8: RepairOrder receipt still works (unattributed line, matching the
-- simplest real path -- full provenance re-proven by the 104 regression).
CREATE TEMP TABLE fxm8 (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, receiving_loc uuid);
GRANT SELECT ON fxm8 TO authenticated;
INSERT INTO fxm8 SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '105-ic7a-m8', 939 FROM fxm8;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose) SELECT receiving_loc, org, branch, '105-m8-receiving', true, 'receiving' FROM fxm8;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxm8)::text, 'role', 'authenticated')::text, true);
CREATE TEMP TABLE m8 AS SELECT receive_repair_order_stock(
  (SELECT e2e_user FROM fxm8), (SELECT org FROM fxm8), (SELECT branch FROM fxm8),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxm8), 'unit_id', (SELECT unit_1 FROM fxm8), 'quantity', 4))
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'M8: RepairOrder receipt via receive_repair_order_stock still succeeds') FROM m8;
RESET ROLE;

-- M9: PO receipt still works.
CREATE TEMP TABLE fxm9 (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, product_1 uuid, unit_1 uuid, loc_delivery uuid, supplier_1 uuid, po_1 uuid, poline_1 uuid);
GRANT SELECT ON fxm9 TO authenticated;
INSERT INTO fxm9 SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '72501d89-2de6-46bf-af3a-e4d063d3757c'::uuid, '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '105-ic7a-m9', 941 FROM fxm9;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_delivery, org, branch, '105-m9-delivery', true FROM fxm9;
INSERT INTO inventory_suppliers (id, organization_id, name) SELECT supplier_1, org, '105-M9-Supplier' FROM fxm9;
INSERT INTO inventory_purchase_orders (id, organization_id, branch_id, po_number, supplier_id, status, delivery_location_id) SELECT po_1, org, branch, '105-PO-M9', supplier_1, 'ordered', loc_delivery FROM fxm9;
INSERT INTO inventory_purchase_order_lines (id, organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id, unit_id, ordered_quantity, unit_cost) SELECT poline_1, org, branch, po_1, 1, product_1, variant_1, unit_1, 10, 5.50 FROM fxm9;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxm9)::text, 'role', 'authenticated')::text, true);
CREATE TEMP TABLE m9 AS SELECT inventory_receive_purchase_order(
  (SELECT po_1 FROM fxm9),
  jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxm9), 'quantity', 6)),
  (SELECT e2e_user FROM fxm9), '105-m9-idem'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_received', 'M9: PO receipt via inventory_receive_purchase_order still succeeds') FROM m9;
RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
