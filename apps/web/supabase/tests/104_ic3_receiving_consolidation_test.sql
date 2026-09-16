-- ============================================================================
-- TEST: IC-3 -- Receiving Consolidation
-- ============================================================================
-- Proves the new canonical `inventory_receive_stock` primitive (Scenario F),
-- the refactored `receive_repair_order_stock` wrapper (Scenario G), and the
-- refactored/fixed `inventory_receive_purchase_order` wrapper (Scenario H)
-- all behave correctly, atomically, and securely, on top of the SAME
-- underlying canonical engine (`inventory_create_and_finalize` ->
-- `inventory_finalize_posting`, the frozen IC-2 catalog-effects-only public
-- contract -- `inventory_finalize_posting_internal` is never called by any
-- of this phase's own code).
--
-- ORDERING NOTE (same convention as 099/103): `user_effective_permissions`
-- has no wildcard row -- every granular permission is its own materialized
-- exact-slug row, and DELETing one is a permanent, ORG-WIDE mutation for
-- the rest of this shared transaction. Scenario J (permission negatives)
-- therefore runs LAST, after every other scenario that depends on
-- `warehouse.inventory.operate`/`.adjust`/`.reverse` or `warehouse.
-- procurement.manage` has already run.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(44);

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ============================================================================
-- SCENARIO F: the canonical `inventory_receive_stock` primitive, directly.
-- ============================================================================

CREATE TEMP TABLE fxf (org uuid, branch uuid, e2e_user uuid, variant_1 uuid, unit_1 uuid, loc_a uuid, loc_b uuid, loc_c uuid);
GRANT SELECT ON fxf TO authenticated;
INSERT INTO fxf SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid, gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '104-ic3-scenario-f', 980 FROM fxf;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_a, org, branch, '104-f-loc-a', true FROM fxf;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_b, org, branch, '104-f-loc-b', true FROM fxf;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_c, org, branch, '104-f-loc-c', true FROM fxf;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxf)::text, 'role', 'authenticated')::text, true);

-- F1-F4: two same-variant lines in one call.
CREATE TEMP TABLE recv_f AS
SELECT inventory_receive_stock(
  (SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 2, 'destination_location_id', (SELECT loc_a FROM fxf)),
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 3, 'destination_location_id', (SELECT loc_a FROM fxf))
  ),
  NULL, NULL, 'F-test', 'F note', 'f-idem-1'
) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'F1: two-line same-variant receive via the primitive posts successfully') FROM recv_f;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 5::numeric, 'F2: aggregate balance is exactly 2+3=5') FROM inventory_balances WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf) AND location_id=(SELECT loc_a FROM fxf) AND variant_id=(SELECT variant_1 FROM fxf);
INSERT INTO test_log(line) SELECT is(jsonb_array_length(result->'lines'), 2, 'F3: returned lines array has exactly 2 entries') FROM recv_f;
INSERT INTO test_log(line) SELECT isnt(((result->'lines'->0)->>'movement_line_id'), ((result->'lines'->1)->>'movement_line_id'), 'F4: the two same-variant lines map to two DISTINCT movement_line_ids (never merged)') FROM recv_f;

-- F5-F6: sequential idempotent retry, same key -- no double-post.
CREATE TEMP TABLE recv_f_retry AS
SELECT inventory_receive_stock(
  (SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
  jsonb_build_array(
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 2, 'destination_location_id', (SELECT loc_a FROM fxf)),
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 3, 'destination_location_id', (SELECT loc_a FROM fxf))
  ),
  NULL, NULL, 'F-test', 'F note', 'f-idem-1'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'movement_id'), (SELECT result->>'movement_id' FROM recv_f), 'F5: sequential retry with the SAME idempotency key returns the SAME movement_id') FROM recv_f_retry;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 5::numeric, 'F6: balance still exactly 5 after the retry -- no double-post') FROM inventory_balances WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf) AND location_id=(SELECT loc_a FROM fxf) AND variant_id=(SELECT variant_1 FROM fxf);

-- F7: negative -- missing destination.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock((SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 1)),
    NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('F7: expected missing-destination rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'F7: missing destination_location_id is rejected (22023)');
END; END $$;

-- F8: negative -- quantity <= 0.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock((SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 0, 'destination_location_id', (SELECT loc_a FROM fxf))),
    NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('F8: expected non-positive-quantity rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'F8: quantity <= 0 is rejected (22023)');
END; END $$;

-- F9: negative -- wrong actor (spoof).
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock(gen_random_uuid(), (SELECT org FROM fxf), (SELECT branch FROM fxf),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxf))),
    NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('F9: expected wrong-actor rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'F9: p_actor_user_id not matching auth.uid() is rejected (28000)');
END; END $$;

-- F10-F11: side-by-side equivalence, primitive vs. direct legacy engine call.
CREATE TEMP TABLE recv_f_prim AS
SELECT inventory_receive_stock((SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 7, 'destination_location_id', (SELECT loc_b FROM fxf))),
  NULL, NULL, NULL, NULL, NULL) AS result;

CREATE TEMP TABLE recv_f_legacy AS
SELECT inventory_create_and_finalize((SELECT org FROM fxf), (SELECT branch FROM fxf), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 7, 'source_location_id', NULL, 'destination_location_id', (SELECT loc_c FROM fxf))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fxf)) AS result;

INSERT INTO test_log(line) SELECT is(
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf) AND location_id=(SELECT loc_b FROM fxf) AND variant_id=(SELECT variant_1 FROM fxf)),
  (SELECT on_hand_quantity FROM inventory_balances WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf) AND location_id=(SELECT loc_c FROM fxf) AND variant_id=(SELECT variant_1 FROM fxf)),
  'F10: primitive-posted and legacy-direct-posted receipts of equal quantity produce equal on_hand balances (7 == 7)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_stock_ledger_entries WHERE movement_id = ((SELECT result FROM recv_f_prim)->>'movement_id')::uuid),
  (SELECT count(*) FROM inventory_stock_ledger_entries WHERE movement_id = ((SELECT result FROM recv_f_legacy)->>'movement_id')::uuid),
  'F11: both paths produce the same number of ledger entries (1 each, destination-increase-only per 101 semantics)'
);

-- F12-F13: atomicity -- a 2-line call where line 2 is invalid leaves NO trace.
CREATE TEMP TABLE header_count_before_f13 AS SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf);
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock((SELECT e2e_user FROM fxf), (SELECT org FROM fxf), (SELECT branch FROM fxf),
    jsonb_build_array(
      jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxf)),
      jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 1)
    ),
    NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('F12: expected atomic rejection of the whole 2-line call, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'F12: 2nd line missing destination rejects the WHOLE call (22023)');
END; END $$;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id=(SELECT org FROM fxf) AND branch_id=(SELECT branch FROM fxf)),
  (SELECT n FROM header_count_before_f13),
  'F13: no orphan movement header was created by the atomically-rejected call (header count unchanged)'
);

RESET ROLE;

-- ============================================================================
-- SCENARIO G: `receive_repair_order_stock` wrapper.
-- ============================================================================

CREATE TEMP TABLE fxg (
  org uuid, branch uuid, branch2 uuid, e2e_user uuid, variant_1 uuid, variant_2 uuid, unit_1 uuid,
  ro uuid, rol_a uuid, rol_b uuid, ro2 uuid, rol_wrongorg uuid, rol_wrongvariant uuid,
  receiving_loc uuid, receiving_loc2 uuid,
  session_id uuid, session_file_id uuid, block_id uuid, doc_id uuid, doc_id2 uuid,
  ml_a uuid, ml_b uuid, ml_ambig uuid, ml_wrongorg uuid, ml_wrongvariant uuid,
  wsdl_a uuid, wsdl_b uuid, wsdl_ambig uuid, wsdl_ambig2 uuid, wsdl_wrongorg uuid, wsdl_wrongvariant uuid
);
GRANT SELECT ON fxg TO authenticated;
INSERT INTO fxg SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid, 'e11a5012-d136-4551-952d-6b264023737c'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '104-ic3-scenario-g', 981 FROM fxg;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch2, org, '104-ic3-scenario-g-b2', 982 FROM fxg;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose) SELECT receiving_loc, org, branch, '104-g-receiving', true, 'receiving' FROM fxg;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose) SELECT receiving_loc2, org, branch2, '104-g-receiving-b2', true, 'receiving' FROM fxg;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status) SELECT ro, org, branch, '104-G-RO', 'open' FROM fxg;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit) SELECT rol_a, ro, variant_1, '104-G-SKU', '104 G line A', 10, 'pcs' FROM fxg;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit) SELECT rol_b, ro, variant_1, '104-G-SKU', '104 G line B (same SKU as A)', 10, 'pcs' FROM fxg;

INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status) SELECT ro2, org, branch2, '104-G-RO2-OTHER-BRANCH', 'open' FROM fxg;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit) SELECT rol_wrongorg, ro2, variant_1, '104-G-SKU', '104 G line wrong-branch', 10, 'pcs' FROM fxg;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit) SELECT rol_wrongvariant, ro, variant_2, '104-G-SKU-V2', '104 G line wrong-variant (variant_2)', 10, 'pcs' FROM fxg;

INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name) SELECT session_id, org, branch, '104-g-session' FROM fxg;
INSERT INTO wdd_matcher_session_files (id, session_id, organization_id, file_role, file_name) SELECT session_file_id, session_id, org, 'wdd', '104-g-file.pdf' FROM fxg;
INSERT INTO wdd_matcher_blocks (id, session_file_id, session_id, organization_id, block_index, block_type) SELECT block_id, session_file_id, session_id, org, 1, 'wdd_source' FROM fxg;

INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity) SELECT ml_a, block_id, session_id, org, 1, '104-G-SKU', 6 FROM fxg;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity) SELECT ml_b, block_id, session_id, org, 2, '104-G-SKU', 4 FROM fxg;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity) SELECT ml_ambig, block_id, session_id, org, 3, '104-G-SKU', 1 FROM fxg;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity) SELECT ml_wrongorg, block_id, session_id, org, 4, '104-G-SKU', 1 FROM fxg;
INSERT INTO wdd_matcher_lines (id, block_id, session_id, organization_id, line_number, product_code, quantity) SELECT ml_wrongvariant, block_id, session_id, org, 5, '104-G-SKU', 1 FROM fxg;

INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id) SELECT doc_id, org, branch, 'wdd', '104-G-DOC', session_id FROM fxg;
-- A SECOND, independent source document -- needed for the ambiguity test:
-- `workshop_source_document_lines`'s own unique index is composite
-- (workshop_source_document_id, wdd_matcher_line_id), so the SAME matcher
-- line can legitimately appear once per DISTINCT document (e.g. two
-- different uploaded files both mentioning the same physical line) --
-- that is the real mechanism the ambiguity check in `receive_repair_order_
-- stock` guards against, not two links from one document line (which
-- `repair_order_line_source_links_source_line_unique` already forbids
-- outright, live-discovered while building this fixture).
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id) SELECT doc_id2, org, branch, 'wdd', '104-G-DOC-2', session_id FROM fxg;

INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_a, doc_id, ml_a, '104-G-SKU', 6 FROM fxg;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_b, doc_id, ml_b, '104-G-SKU', 4 FROM fxg;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_ambig, doc_id, ml_ambig, '104-G-SKU', 1 FROM fxg;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_ambig2, doc_id2, ml_ambig, '104-G-SKU', 1 FROM fxg;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_wrongorg, doc_id, ml_wrongorg, '104-G-SKU', 1 FROM fxg;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, wdd_matcher_line_id, product_code, quantity) SELECT wsdl_wrongvariant, doc_id, ml_wrongvariant, '104-G-SKU', 1 FROM fxg;

INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_a, wsdl_a, 6 FROM fxg;
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_b, wsdl_b, 4 FROM fxg;
-- Ambiguous: the SAME wdd_matcher_line_id (ml_ambig) is reachable via TWO
-- different workshop_source_document_lines rows (one per document), each
-- correctly, uniquely linked (1:1) to a DIFFERENT RepairOrderLine.
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_a, wsdl_ambig, 1 FROM fxg;
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_b, wsdl_ambig2, 1 FROM fxg;
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_wrongorg, wsdl_wrongorg, 1 FROM fxg;
INSERT INTO repair_order_line_source_links (id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution) SELECT gen_random_uuid(), rol_wrongvariant, wsdl_wrongvariant, 1 FROM fxg;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxg)::text, 'role', 'authenticated')::text, true);

-- G1-G8: happy path -- 3 lines: rol_a (6), rol_b (4, same SKU as A, different RepairOrderLine), and one UNATTRIBUTED line (5).
CREATE TEMP TABLE recv_g AS
SELECT receive_repair_order_stock(
  (SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
  jsonb_build_array(
    jsonb_build_object('source_line_id', (SELECT ml_a FROM fxg), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 6),
    jsonb_build_object('source_line_id', (SELECT ml_b FROM fxg), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 4),
    jsonb_build_object('variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 5)
  )
) AS result;

INSERT INTO test_log(line) SELECT is((result->>'status'), 'posted', 'G1: 3-line RepairOrder receipt (2 attributed + 1 unattributed) posts successfully') FROM recv_g;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 15::numeric, 'G2: receiving location stock increases by the exact sum (6+4+5=15)') FROM inventory_balances WHERE organization_id=(SELECT org FROM fxg) AND branch_id=(SELECT branch FROM fxg) AND location_id=(SELECT receiving_loc FROM fxg) AND variant_id=(SELECT variant_1 FROM fxg);
INSERT INTO test_log(line) SELECT is(
  (SELECT applied_quantity FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_a FROM fxg)),
  6::numeric, 'G3: rol_a''s own attribution link carries applied_quantity=6 exactly'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT applied_quantity FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_b FROM fxg)),
  4::numeric, 'G4: rol_b''s own attribution link carries applied_quantity=4 exactly (same-SKU line independence, never merged with rol_a)'
);
INSERT INTO test_log(line) SELECT isnt(
  (SELECT inventory_movement_line_id FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_a FROM fxg)),
  (SELECT inventory_movement_line_id FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT rol_b FROM fxg)),
  'G5: rol_a and rol_b are attributed to two DISTINCT movement lines (no cross-line contamination)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol_a FROM fxg) AND location_id = (SELECT receiving_loc FROM fxg)),
  6::numeric, 'G6: repair_order_line_locations seeded correctly for rol_a (quantity=6)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity FROM repair_order_line_locations WHERE repair_order_line_id = (SELECT rol_b FROM fxg) AND location_id = (SELECT receiving_loc FROM fxg)),
  4::numeric, 'G7: repair_order_line_locations seeded correctly for rol_b (quantity=4)'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_line_movement_links rolml JOIN inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id WHERE iml.movement_id = ((SELECT result FROM recv_g)->>'movement_id')::uuid),
  2, 'G8: exactly 2 attribution links exist for this movement (the 3rd, unattributed line created NO fabricated attribution)'
);

-- G9: negative -- nonexistent source_line_id.
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock((SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(jsonb_build_object('source_line_id', gen_random_uuid(), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)));
  INSERT INTO test_log(line) SELECT fail('G9: expected nonexistent-provenance rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'G9: nonexistent source_line_id is rejected (P0002)');
END; END $$;

-- G10: negative -- ambiguous source_line_id (ml_ambig resolves to 2 RepairOrderLines).
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock((SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(jsonb_build_object('source_line_id', (SELECT ml_ambig FROM fxg), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)));
  INSERT INTO test_log(line) SELECT fail('G10: expected ambiguous-provenance rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'G10: ambiguous source_line_id (2 RepairOrderLine candidates) is rejected (55000)');
END; END $$;

-- G11: negative -- source line resolves to a RepairOrder in a DIFFERENT branch than the call's own target.
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock((SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(jsonb_build_object('source_line_id', (SELECT ml_wrongorg FROM fxg), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)));
  INSERT INTO test_log(line) SELECT fail('G11: expected wrong-branch-provenance rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'G11: source line resolving to a RepairOrder in a different branch is rejected (42501)');
END; END $$;

-- G12: negative -- resolved RepairOrderLine variant does not match the received variant.
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock((SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(jsonb_build_object('source_line_id', (SELECT ml_wrongvariant FROM fxg), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)));
  INSERT INTO test_log(line) SELECT fail('G12: expected variant-mismatch rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'G12: resolved RepairOrderLine variant (variant_2) not matching received variant_1 is rejected (22023)');
END; END $$;

-- G13-G14: atomicity -- one good attributed line + one provenance-invalid line -> ZERO physical movement.
CREATE TEMP TABLE header_count_before_g14 AS SELECT count(*) AS n FROM inventory_movement_headers WHERE organization_id=(SELECT org FROM fxg) AND branch_id=(SELECT branch FROM fxg);
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock((SELECT e2e_user FROM fxg), (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(
      jsonb_build_object('variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1),
      jsonb_build_object('source_line_id', gen_random_uuid(), 'variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)
    ));
  INSERT INTO test_log(line) SELECT fail('G13: expected the whole 2-line call to be rejected atomically, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'G13: 2nd line''s bad provenance rejects the WHOLE call (P0002)');
END; END $$;
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM inventory_movement_headers WHERE organization_id=(SELECT org FROM fxg) AND branch_id=(SELECT branch FROM fxg)),
  (SELECT n FROM header_count_before_g14),
  'G14: no orphan movement header was created by the atomically-rejected call (header count unchanged)'
);

RESET ROLE;

-- ============================================================================
-- SCENARIO H: `inventory_receive_purchase_order` wrapper.
-- ============================================================================

CREATE TEMP TABLE fxh (
  org uuid, branch uuid, e2e_user uuid, variant_1 uuid, product_1 uuid, unit_1 uuid,
  loc_delivery uuid, loc_override uuid, supplier_1 uuid,
  po_1 uuid, poline_1 uuid, po_2 uuid, poline_2 uuid, po_nodest uuid, poline_nodest uuid
);
GRANT SELECT ON fxh TO authenticated;
INSERT INTO fxh SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid, gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, 'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '72501d89-2de6-46bf-af3a-e4d063d3757c'::uuid, '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch, org, '104-ic3-scenario-h', 983 FROM fxh;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_delivery, org, branch, '104-h-delivery', true FROM fxh;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory) SELECT loc_override, org, branch, '104-h-override', true FROM fxh;
INSERT INTO inventory_suppliers (id, organization_id, name) SELECT supplier_1, org, '104-H-Supplier' FROM fxh;

INSERT INTO inventory_purchase_orders (id, organization_id, branch_id, po_number, supplier_id, status, delivery_location_id)
  SELECT po_1, org, branch, '104-PO-0001', supplier_1, 'ordered', loc_delivery FROM fxh;
INSERT INTO inventory_purchase_order_lines (id, organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id, unit_id, ordered_quantity, unit_cost)
  SELECT poline_1, org, branch, po_1, 1, product_1, variant_1, unit_1, 10, 5.50 FROM fxh;

INSERT INTO inventory_purchase_orders (id, organization_id, branch_id, po_number, supplier_id, status, delivery_location_id)
  SELECT po_2, org, branch, '104-PO-0002', supplier_1, 'ordered', loc_delivery FROM fxh;
INSERT INTO inventory_purchase_order_lines (id, organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id, unit_id, ordered_quantity, unit_cost)
  SELECT poline_2, org, branch, po_2, 1, product_1, variant_1, unit_1, 5, 5.50 FROM fxh;

-- A PO with NO delivery_location_id, for the missing-destination negative test.
INSERT INTO inventory_purchase_orders (id, organization_id, branch_id, po_number, supplier_id, status, delivery_location_id)
  SELECT po_nodest, org, branch, '104-PO-0003-NODEST', supplier_1, 'ordered', NULL FROM fxh;
INSERT INTO inventory_purchase_order_lines (id, organization_id, branch_id, purchase_order_id, line_number, product_id, variant_id, unit_id, ordered_quantity, unit_cost)
  SELECT poline_nodest, org, branch, po_nodest, 1, product_1, variant_1, unit_1, 5, 5.50 FROM fxh;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fxh)::text, 'role', 'authenticated')::text, true);

-- H1-H4: partial receive, then complete it -- status transitions correctly.
CREATE TEMP TABLE recv_h1 AS
SELECT inventory_receive_purchase_order(
  (SELECT po_1 FROM fxh),
  jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxh), 'quantity', 6)),
  (SELECT e2e_user FROM fxh), 'h-idem-1'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'partially_received', 'H1: partial PO receipt (6 of 10) transitions status to partially_received') FROM recv_h1;
INSERT INTO test_log(line) SELECT is(received_quantity, 6::numeric, 'H2: PO line received_quantity is exactly 6 after the partial receipt') FROM inventory_purchase_order_lines WHERE id = (SELECT poline_1 FROM fxh);
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 6::numeric, 'H3: physical stock at the delivery location increased by exactly 6') FROM inventory_balances WHERE organization_id=(SELECT org FROM fxh) AND branch_id=(SELECT branch FROM fxh) AND location_id=(SELECT loc_delivery FROM fxh) AND variant_id=(SELECT variant_1 FROM fxh);

CREATE TEMP TABLE recv_h1b AS
SELECT inventory_receive_purchase_order(
  (SELECT po_1 FROM fxh),
  jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxh), 'quantity', 4)),
  (SELECT e2e_user FROM fxh), 'h-idem-2'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'received', 'H4: completing the remaining 4 units transitions PO status to received') FROM recv_h1b;

-- H5: negative -- nonexistent PO.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order(gen_random_uuid(), jsonb_build_array(jsonb_build_object('purchase_order_line_id', gen_random_uuid(), 'quantity', 1)), (SELECT e2e_user FROM fxh), NULL);
  INSERT INTO test_log(line) SELECT fail('H5: expected nonexistent-PO rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'H5: nonexistent purchase order is rejected (P0002)');
END; END $$;

-- H6: negative -- invalid line (line belongs to a DIFFERENT PO).
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order((SELECT po_2 FROM fxh), jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxh), 'quantity', 1)), (SELECT e2e_user FROM fxh), NULL);
  INSERT INTO test_log(line) SELECT fail('H6: expected wrong-PO-line rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0002', 'H6: a purchase_order_line_id belonging to a DIFFERENT PO is rejected (P0002)');
END; END $$;

-- H7: negative -- receive above remaining quantity.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order((SELECT po_2 FROM fxh), jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_2 FROM fxh), 'quantity', 999)), (SELECT e2e_user FROM fxh), NULL);
  INSERT INTO test_log(line) SELECT fail('H7: expected over-receipt rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'H7: receiving more than the remaining open quantity is rejected (22023)');
END; END $$;

-- H8: negative -- already fully received (po_1 is now 'received' from H4).
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order((SELECT po_1 FROM fxh), jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxh), 'quantity', 1)), (SELECT e2e_user FROM fxh), NULL);
  INSERT INTO test_log(line) SELECT fail('H8: expected already-received rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'H8: a PO already fully received is rejected from receiving again (55000)');
END; END $$;

-- H9: negative -- no delivery_location_id and no per-line override.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order((SELECT po_nodest FROM fxh), jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_nodest FROM fxh), 'quantity', 1)), (SELECT e2e_user FROM fxh), NULL);
  INSERT INTO test_log(line) SELECT fail('H9: expected missing-destination rejection, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'H9: no delivery_location_id and no per-line override is rejected (22023)');
END; END $$;

-- H10: per-line destination override works (different from the PO's own delivery_location_id).
CREATE TEMP TABLE recv_h10 AS
SELECT inventory_receive_purchase_order(
  (SELECT po_2 FROM fxh),
  jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_2 FROM fxh), 'quantity', 5, 'destination_location_id', (SELECT loc_override FROM fxh))),
  (SELECT e2e_user FROM fxh), 'h-idem-override'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'status'), 'received', 'H10a: per-line destination_location_id override is honored and PO completes') FROM recv_h10;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 5::numeric, 'H10b: stock landed at the OVERRIDE location, not the PO''s own default delivery_location_id') FROM inventory_balances WHERE organization_id=(SELECT org FROM fxh) AND branch_id=(SELECT branch FROM fxh) AND location_id=(SELECT loc_override FROM fxh) AND variant_id=(SELECT variant_1 FROM fxh);

-- H11-H12: idempotent retry -- received_quantity NOT double-incremented, same movement_id.
CREATE TEMP TABLE recv_h1_retry AS
SELECT inventory_receive_purchase_order(
  (SELECT po_1 FROM fxh),
  jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_1 FROM fxh), 'quantity', 6)),
  (SELECT e2e_user FROM fxh), 'h-idem-1'
) AS result;
INSERT INTO test_log(line) SELECT is((result->>'movement_id'), (SELECT result->>'movement_id' FROM recv_h1), 'H11: retrying the FIRST partial receipt with the same idempotency token returns the SAME movement_id') FROM recv_h1_retry;
INSERT INTO test_log(line) SELECT is(received_quantity, 10::numeric, 'H12: received_quantity is still exactly 10 (6+4) after the retry -- NOT double-incremented to 16') FROM inventory_purchase_order_lines WHERE id = (SELECT poline_1 FROM fxh);

-- H13: PO wrapper never touches RepairOrder attribution tables.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_line_movement_links rolml
   JOIN inventory_movement_lines iml ON iml.id = rolml.inventory_movement_line_id
   WHERE iml.organization_id = (SELECT org FROM fxh) AND iml.branch_id = (SELECT branch FROM fxh)),
  0, 'H13: zero repair_order_line_movement_links rows reference any movement line created by the PO wrapper'
);

RESET ROLE;

-- ============================================================================
-- SCENARIO J: permission negatives (run LAST -- org-wide, permanent for the
-- rest of this transaction once stripped).
-- ============================================================================

DELETE FROM user_effective_permissions
WHERE organization_id = '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid
  AND user_id = 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid
  AND permission_slug_exact IN ('warehouse.inventory.operate', 'warehouse.inventory.adjust', 'warehouse.inventory.reverse', 'warehouse.procurement.manage');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4', 'role', 'authenticated')::text, true);

-- J1: primitive rejects with no permission.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_stock('c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, (SELECT org FROM fxf), (SELECT branch FROM fxf),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxf), 'unit_id', (SELECT unit_1 FROM fxf), 'quantity', 1, 'destination_location_id', (SELECT loc_a FROM fxf))),
    NULL, NULL, NULL, NULL, NULL);
  INSERT INTO test_log(line) SELECT fail('J1: expected no-permission rejection on the primitive, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'J1: inventory_receive_stock rejects an actor lacking warehouse.inventory.operate/.adjust (42501)');
END; END $$;

-- J2: RepairOrder wrapper rejects with no permission.
DO $$ BEGIN BEGIN
  PERFORM receive_repair_order_stock('c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, (SELECT org FROM fxg), (SELECT branch FROM fxg),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fxg), 'unit_id', (SELECT unit_1 FROM fxg), 'quantity', 1)));
  INSERT INTO test_log(line) SELECT fail('J2: expected no-permission rejection on the RepairOrder wrapper, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'J2: receive_repair_order_stock rejects an actor lacking warehouse.inventory.operate/.adjust (42501)');
END; END $$;

-- J3: PO wrapper rejects with no permission.
DO $$ BEGIN BEGIN
  PERFORM inventory_receive_purchase_order((SELECT po_2 FROM fxh), jsonb_build_array(jsonb_build_object('purchase_order_line_id', (SELECT poline_2 FROM fxh), 'quantity', 1)), 'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid, NULL);
  INSERT INTO test_log(line) SELECT fail('J3: expected no-permission rejection on the PO wrapper, succeeded instead');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'J3: inventory_receive_purchase_order rejects an actor lacking warehouse.procurement.manage (42501)');
END; END $$;

RESET ROLE;

SELECT count(*) FILTER (WHERE line NOT LIKE 'ok %') AS not_ok_count, count(*) AS total_assertions FROM test_log;

ROLLBACK;
