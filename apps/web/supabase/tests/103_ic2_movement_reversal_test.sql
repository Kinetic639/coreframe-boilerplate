-- ============================================================================
-- TEST: IC-2 -- Movement Reversal (inventory_reverse_movement)
-- ============================================================================
-- Proves the new canonical reversal RPC end-to-end: receipt reversal, 801
-- (two-leg) reversal, draft/already-reversed/reversal-of-reversal rejection,
-- reason validation, the IC-1 commitment invariant applying automatically
-- to reversals, permission gating, structural linkage, ledger correctness,
-- audit correctness, and distinct sequential document numbering.
--
-- SCENARIO E (added: IC-2 security-boundary correction pass, external
-- review P0): proves the explicit-effects capability IC-2 introduced on
-- `inventory_finalize_posting` cannot be reached or abused by any ordinary
-- caller after the fix -- the implementation was split into a PUBLIC,
-- catalog-only 2-arg `inventory_finalize_posting(uuid, uuid)` and a fully
-- locked-down `inventory_finalize_posting_internal(uuid, uuid, jsonb)`
-- (EXECUTE revoked from PUBLIC/anon/authenticated/service_role, reachable
-- only via a same-owner SECURITY DEFINER call from `inventory_reverse_
-- movement`). A live, transaction-scoped attack probe (documented in the
-- IC-2 review bundle) proved the vulnerability was real BEFORE this fix:
-- an ordinary `authenticated` caller doubled a drafted 10-unit receipt to
-- on_hand=20 via a crafted `p_explicit_effects` payload.
--
-- Each scenario uses its own fresh, isolated branch (mirroring the IC-1
-- correction pass's own established convention) to avoid colliding with
-- the shared test org/branch's own single "one receiving location per
-- branch" slot and any prior committed residue.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(35);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- SCENARIO A: Receipt (101) reversal -- exact balance restoration.
-- ===========================================================================
CREATE TEMP TABLE fxa (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid);
GRANT SELECT ON fxa TO authenticated;
INSERT INTO fxa SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '103-ic2-scenario-a', 970 FROM fxa;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '103-ic2-a-loc', true FROM fxa;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxa)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE r101a AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fxa), (SELECT branch FROM fxa), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxa), 'unit_id', (SELECT unit_1 FROM fxa), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxa))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxa)
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'T1: receipt of 10 posts successfully') FROM r101a;

CREATE TEMP TABLE reva AS
SELECT inventory_reverse_movement(((SELECT result FROM r101a)->>'movement_id')::uuid, (SELECT e2e_user FROM fxa), 'pgTAP receipt reversal') AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'T2: reversal itself posts successfully') FROM reva;
INSERT INTO test_log(line) SELECT isnt((result->>'reversal_document_number'), (SELECT (result->>'document_number') FROM r101a), 'T3: reversal document number is genuinely distinct from the original') FROM reva;
INSERT INTO test_log(line) SELECT ok((SELECT result FROM reva)->>'reversal_document_number' LIKE 'KOR/%', 'T4: reversal document number carries the KOR prefix (real sequential allocator, not a client-side suffix)') ;

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 0::numeric, 'T5: balance exactly restored to pre-receipt value (0) after reversal') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxa) AND branch_id=(SELECT branch FROM fxa) AND location_id=(SELECT loc_a FROM fxa) AND variant_id=(SELECT variant_1 FROM fxa);

INSERT INTO test_log(line) SELECT is(status, 'reversed', 'T6: original header transitions to status=reversed') FROM inventory_movement_headers WHERE id = ((SELECT result FROM r101a)->>'movement_id')::uuid;
INSERT INTO test_log(line) SELECT is(reversal_movement_id, ((SELECT result FROM reva)->>'reversal_movement_id')::uuid, 'T7: original.reversal_movement_id points to the new reversal') FROM inventory_movement_headers WHERE id = ((SELECT result FROM r101a)->>'movement_id')::uuid;
INSERT INTO test_log(line) SELECT is(original_movement_id, ((SELECT result FROM r101a)->>'movement_id')::uuid, 'T8: reversal.original_movement_id points back to the original -- bidirectional linkage agrees') FROM inventory_movement_headers WHERE id = ((SELECT result FROM reva)->>'reversal_movement_id')::uuid;
INSERT INTO test_log(line) SELECT is(status, 'posted', 'T9: the reversal movement itself is posted, not reversed') FROM inventory_movement_headers WHERE id = ((SELECT result FROM reva)->>'reversal_movement_id')::uuid;

INSERT INTO test_log(line) SELECT is(reason_text, 'pgTAP receipt reversal', 'T10: audit log persists the exact reason text') FROM inventory_movement_audit_log WHERE movement_id = ((SELECT result FROM r101a)->>'movement_id')::uuid AND action = 'reversed';
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_stock_ledger_entries WHERE movement_id = ((SELECT result FROM reva)->>'reversal_movement_id')::uuid),
  1::bigint, 'T11: reversal produces exactly one compensating ledger entry'
);

-- ===========================================================================
-- SCENARIO B: 801 (two-leg) reversal -- both legs invert correctly.
-- ===========================================================================
CREATE TEMP TABLE fxb (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid, loc_b uuid);
GRANT SELECT ON fxb TO authenticated;
RESET ROLE;
INSERT INTO fxb SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid(), gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '103-ic2-scenario-b', 971 FROM fxb;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '103-ic2-b-loc-a', true FROM fxb;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_b, org, branch, '103-ic2-b-loc-b', true FROM fxb;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxb)::text, 'role', 'authenticated')::text, true);

SELECT inventory_create_and_finalize(
  (SELECT org FROM fxb), (SELECT branch FROM fxb), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxb))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxb)
);

CREATE TEMP TABLE r801b AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fxb), (SELECT branch FROM fxb), '801',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxb), 'unit_id', (SELECT unit_1 FROM fxb), 'quantity', 4, 'source_location_id', (SELECT loc_a FROM fxb), 'destination_location_id', (SELECT loc_b FROM fxb))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxb)
) AS result;

SELECT inventory_reverse_movement(((SELECT result FROM r801b)->>'movement_id')::uuid, (SELECT e2e_user FROM fxb), 'pgTAP 801 reversal');

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T12: 801 reversal restores source (loc_a) exactly to pre-move value (10)') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxb) AND branch_id=(SELECT branch FROM fxb) AND location_id=(SELECT loc_a FROM fxb) AND variant_id=(SELECT variant_1 FROM fxb);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 0::numeric, 'T13: 801 reversal restores destination (loc_b) exactly to pre-move value (0)') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxb) AND branch_id=(SELECT branch FROM fxb) AND location_id=(SELECT loc_b FROM fxb) AND variant_id=(SELECT variant_1 FROM fxb);

-- ===========================================================================
-- SCENARIO D: IC-1 commitment invariant applies automatically to reversals.
-- Runs BEFORE Scenario C deliberately: Scenario C's own final negative test
-- (T22, no-permission) strips e2e_user's warehouse.inventory.* grants at
-- the ORG level for the rest of this transaction (no wildcard row exists
-- in user_effective_permissions -- every slug, including `warehouse.
-- inventory.operate`, is its own materialized exact-slug row) -- running
-- Scenario D afterward would spuriously fail on the reservation setup call.
-- ===========================================================================
CREATE TEMP TABLE fxd (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid);
GRANT SELECT ON fxd TO authenticated;
RESET ROLE;
INSERT INTO fxd SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '103-ic2-scenario-d', 973 FROM fxd;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '103-ic2-d-loc', true FROM fxd;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxd)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE r101d AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fxd), (SELECT branch FROM fxd), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxd), 'unit_id', (SELECT unit_1 FROM fxd), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxd))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxd)
) AS result;

CREATE TEMP TABLE movement_count_baseline_d AS
SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fxd) AND branch_id = (SELECT branch FROM fxd);

SELECT (inventory_create_reservation(
  (SELECT org FROM fxd), (SELECT branch FROM fxd),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxd), 'location_id', (SELECT loc_a FROM fxd), 'quantity', 6)),
  'movement_reversal_test', gen_random_uuid(), null, null, null, (SELECT e2e_user FROM fxd)
));

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101d)->>'movement_id')::uuid, (SELECT e2e_user FROM fxd), 'commitment block test');
    INSERT INTO test_log(line) SELECT fail('T23: expected IC-1 commitment block, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0003', 'T23: reversing a receipt that would strand reserved stock is rejected by the SAME IC-1 P0003 invariant');
  END;
END $$;

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T24: balance unchanged after the blocked reversal attempt') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxd) AND branch_id=(SELECT branch FROM fxd) AND location_id=(SELECT loc_a FROM fxd) AND variant_id=(SELECT variant_1 FROM fxd);
INSERT INTO test_log(line) SELECT is(reserved_quantity, 6::numeric, 'T25: reservation unchanged after the blocked reversal attempt') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxd) AND branch_id=(SELECT branch FROM fxd) AND location_id=(SELECT loc_a FROM fxd) AND variant_id=(SELECT variant_1 FROM fxd);
INSERT INTO test_log(line) SELECT is(status, 'posted', 'T26: original remains posted (not reversed) after the blocked attempt') FROM inventory_movement_headers WHERE id = ((SELECT result FROM r101d)->>'movement_id')::uuid;
INSERT INTO test_log(line) SELECT is(reversal_movement_id, NULL::uuid, 'T27: original.reversal_movement_id remains NULL after the blocked attempt') FROM inventory_movement_headers WHERE id = ((SELECT result FROM r101d)->>'movement_id')::uuid;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id = (SELECT org FROM fxd) AND branch_id = (SELECT branch FROM fxd)),
  (SELECT n FROM movement_count_baseline_d),
  'T28: no orphan reversal header was created by the blocked attempt (header count unchanged)'
);

RESET ROLE;

-- ===========================================================================
-- SCENARIO E: security-boundary correction -- explicit effects cannot be
-- reached or abused by any ordinary caller (external review P0, fixed).
-- ===========================================================================
-- REPOSITIONED (IC-7A emergency security pass, 2026-09-16): originally ran
-- AFTER Scenario C. IC-7A added a genuine actor+permission check to
-- inventory_create_draft itself (previously it had none at all) -- Scenario
-- C's own final negative test (T22) strips e2e_user's inventory permission
-- for the REST of this shared transaction (the established, documented
-- convention: user_effective_permissions has no wildcard row, so a DELETE
-- is a permanent, org-wide mutation). Scenario E's own draft_e creation
-- (line ~321 below) previously succeeded regardless, since inventory_
-- create_draft had no permission check to trip on the already-stripped
-- e2e_user -- now that it correctly does, Scenario E must run BEFORE
-- Scenario C's own strip, exactly mirroring the SAME reasoning already
-- documented for Scenario D above. Only the POSITION of this block moved;
-- not one assertion, fixture value, or line of Scenario E's own logic was
-- changed -- see the review bundle's own migration-summary.md for the
-- live-caught regression this reordering fixes.
CREATE TEMP TABLE fxe (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid);
GRANT SELECT ON fxe TO authenticated, anon;
INSERT INTO fxe SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '103-ic2-scenario-e', 974 FROM fxe;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '103-ic2-e-loc', true FROM fxe;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxe)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE draft_e AS
SELECT inventory_create_draft(
  (SELECT org FROM fxe), (SELECT branch FROM fxe), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxe), 'unit_id', (SELECT unit_1 FROM fxe), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxe))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxe)
) AS result;

CREATE TEMP TABLE effect_101_e AS
SELECT e.id FROM inventory_movement_type_effects e JOIN inventory_movement_types mt ON mt.id=e.movement_type_id
WHERE mt.organization_id=(SELECT org FROM fxe) AND mt.code='101';
CREATE TEMP TABLE effect_401_e AS
SELECT e.id FROM inventory_movement_type_effects e JOIN inventory_movement_types mt ON mt.id=e.movement_type_id
WHERE mt.organization_id=(SELECT org FROM fxe) AND mt.code='401';

-- T29 (A): ordinary normal finalize still succeeds using catalog effects.
CREATE TEMP TABLE normal_finalize_e AS
SELECT inventory_finalize_posting(((SELECT result FROM draft_e)->>'movement_id')::uuid, (SELECT e2e_user FROM fxe)) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'T29: ordinary 2-arg inventory_finalize_posting (catalog effects) still succeeds') FROM normal_finalize_e;

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T30: balance is exactly the drafted quantity (10) -- not exploitable via the public 2-arg surface, which has no explicit-effects parameter at all') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxe) AND branch_id=(SELECT branch FROM fxe) AND location_id=(SELECT loc_a FROM fxe) AND variant_id=(SELECT variant_1 FROM fxe);

-- T31 (B): ordinary authenticated caller cannot supply arbitrary explicit
-- effects -- the public function has no such parameter; attempting a 3-arg
-- call fails because that signature no longer exists.
CREATE TEMP TABLE draft_e2 AS
SELECT inventory_create_draft(
  (SELECT org FROM fxe), (SELECT branch FROM fxe), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxe), 'unit_id', (SELECT unit_1 FROM fxe), 'quantity', 5, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxe))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxe)
) AS result;

DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    EXECUTE format('SELECT inventory_finalize_posting(%L::uuid, %L::uuid, %L::jsonb)',
      ((SELECT result FROM draft_e2) ->> 'movement_id')::uuid, (SELECT e2e_user FROM fxe),
      jsonb_build_object('1', jsonb_build_array(jsonb_build_object('id', (SELECT id FROM effect_101_e), 'target','destination','balance_field','on_hand','direction','increase','effect_order',1,'is_required',true)))::text
    ) INTO v_result;
    INSERT INTO test_log(line) SELECT fail('T31: expected the 3-arg public-named call to fail (signature does not exist), it succeeded instead (VULNERABLE)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42883', 'T31: authenticated caller cannot supply explicit effects via the public surface -- 3-arg signature does not exist (42883)');
  END;
END $$;

-- T32 (D): direct call to the internal custom-effects function is denied
-- for authenticated (no EXECUTE grant -- confirmed via the exact live
-- attack payload that was proven exploitable before this fix).
DO $$
DECLARE v_result jsonb;
BEGIN
  BEGIN
    v_result := inventory_finalize_posting_internal(
      ((SELECT result FROM draft_e2) ->> 'movement_id')::uuid,
      (SELECT e2e_user FROM fxe),
      jsonb_build_object('1', jsonb_build_array(
        jsonb_build_object('id', (SELECT id FROM effect_101_e), 'target', 'destination', 'balance_field', 'on_hand', 'direction', 'increase', 'effect_order', 1, 'is_required', true),
        jsonb_build_object('id', (SELECT id FROM effect_401_e), 'target', 'destination', 'balance_field', 'on_hand', 'direction', 'increase', 'effect_order', 2, 'is_required', true)
      ))
    );
    INSERT INTO test_log(line) SELECT fail('T32: expected direct internal-function call to be denied, it succeeded instead (VULNERABLE -- this is the exact attack proven exploitable before the fix)');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T32: authenticated caller is denied EXECUTE on inventory_finalize_posting_internal (42501) -- the exact live-proven attack path is now closed');
  END;
END $$;

INSERT INTO test_log(line) SELECT is(on_hand_quantity, 10::numeric, 'T33: balance still exactly 10 (from T29) -- the draft_e2/draft_e2-targeted attack attempts left zero footprint, no doubling occurred') FROM inventory_balances
WHERE organization_id=(SELECT org FROM fxe) AND branch_id=(SELECT branch FROM fxe) AND location_id=(SELECT loc_a FROM fxe) AND variant_id=(SELECT variant_1 FROM fxe);

RESET ROLE;

-- T34 (C): anon cannot reach the trusted explicit-effects path either --
-- confirmed via has_function_privilege (the authoritative grant check;
-- anon has no valid JWT/session in this pgTAP harness to actually invoke
-- RPCs as, so grant-level proof is the correct, real verification here).
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('anon', 'public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure, 'EXECUTE'),
  false, 'T34: anon has NO EXECUTE privilege on inventory_finalize_posting_internal'
);
INSERT INTO test_log(line) SELECT is(
  has_function_privilege('authenticated', 'public.inventory_finalize_posting_internal(uuid,uuid,jsonb)'::regprocedure, 'EXECUTE'),
  false, 'T35: authenticated also has NO EXECUTE privilege on inventory_finalize_posting_internal (only postgres, via same-owner SECURITY DEFINER calls, can reach it)'
);

-- ===========================================================================
-- SCENARIO C: negative tests -- draft, already-reversed, reversal-of-reversal,
-- reason validation, wrong actor, not-found/no-permission indistinguishable.
-- ===========================================================================
CREATE TEMP TABLE fxc (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid);
GRANT SELECT ON fxc TO authenticated;
RESET ROLE;
INSERT INTO fxc SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid();
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '103-ic2-scenario-c', 972 FROM fxc;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '103-ic2-c-loc', true FROM fxc;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxc)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE draft_c AS
SELECT inventory_create_draft(
  (SELECT org FROM fxc), (SELECT branch FROM fxc), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxc), 'unit_id', (SELECT unit_1 FROM fxc), 'quantity', 5, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxc))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxc)
) AS result;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM draft_c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), 'draft test');
    INSERT INTO test_log(line) SELECT fail('T14: expected draft rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0007', 'T14: draft movement rejected (P0007) -- drafts use cancellation, not reversal');
  END;
END $$;

CREATE TEMP TABLE r101c AS
SELECT inventory_create_and_finalize(
  (SELECT org FROM fxc), (SELECT branch FROM fxc), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxc), 'unit_id', (SELECT unit_1 FROM fxc), 'quantity', 10, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_a FROM fxc))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxc)
) AS result;

CREATE TEMP TABLE revc AS
SELECT inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), 'first reversal') AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'T15: first reversal of a fresh posted movement succeeds') FROM revc;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), 'double reversal attempt');
    INSERT INTO test_log(line) SELECT fail('T16: expected already-reversed rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0007', 'T16: reversing an already-reversed original is rejected (P0007, status=reversed -- the status transition itself is the authoritative already-reversed signal)');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM revc)->>'reversal_movement_id')::uuid, (SELECT e2e_user FROM fxc), 'undo an undo attempt');
    INSERT INTO test_log(line) SELECT fail('T17: expected reversal-of-reversal rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0005', 'T17: reversing a reversal movement itself is rejected (P0005) -- product decision A, undo-an-undo out of scope for MVP');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), NULL);
    INSERT INTO test_log(line) SELECT fail('T18: expected NULL-reason rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T18: NULL reason is rejected');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), '   ');
    INSERT INTO test_log(line) SELECT fail('T19: expected whitespace-reason rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T19: whitespace-only reason is rejected');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, gen_random_uuid(), 'spoof test');
    INSERT INTO test_log(line) SELECT fail('T20: expected wrong-actor rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'T20: p_actor_user_id not matching auth.uid() is rejected');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(gen_random_uuid(), (SELECT e2e_user FROM fxc), 'nonexistent test');
    INSERT INTO test_log(line) SELECT fail('T21: expected not-found rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'T21: a nonexistent movement id is rejected (P0002)');
  END;
END $$;

RESET ROLE;
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fxc) AND organization_id = (SELECT org FROM fxc)
  AND permission_slug_exact IN ('warehouse.inventory.operate', 'warehouse.inventory.adjust', 'warehouse.inventory.reverse');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxc)::text, 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM inventory_reverse_movement(((SELECT result FROM r101c)->>'movement_id')::uuid, (SELECT e2e_user FROM fxc), 'no permission test');
    INSERT INTO test_log(line) SELECT fail('T22: expected no-permission rejection, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'T22: actor lacking warehouse.inventory.operate is rejected with the SAME P0002 as not-found -- no existence leak');
  END;
END $$;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
