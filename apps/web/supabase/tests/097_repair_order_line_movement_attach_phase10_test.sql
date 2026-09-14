-- ============================================================================
-- TEST: Phase 10 inventory movement-line linkage -- attach_repair_order_line_movement RPC
-- ============================================================================
-- Complements the mocked service-level tests in repair-orders.service.test.ts
-- (RepairOrdersService.attachMovementToRepairOrderLine) with the SAME rules
-- proven against real persisted rows, real RLS, and the actual SECURITY
-- DEFINER RPC (20260912162802_repair_order_line_movement_attach_rpc.sql),
-- called as the genuinely-RLS-enforced `authenticated` role (not `postgres`).
--
-- RECEIPT side: every successful attribution below is produced by CALLING
-- THE REAL RPC against a real, posted `inventory_movement_lines` row (this
-- test creates real inventory_movement_headers/lines fixtures itself, since
-- no real receiving UI writes them yet -- see review-context.md's ownership
-- discussion). This is the strongest available proof: not mocked, and not a
-- direct table insert bypassing the RPC's own validation.
--
-- ISSUE side: LIVE VERIFIED this session that the target project has ZERO
-- `inventory_movement_types` rows with `category = 'issue'` (only receipt,
-- transfer, adjustment, bin_operation exist) -- so the RPC's own
-- relation_type<->category check can never let a real `relation_type =
-- 'issue'` attribution succeed today (proven negatively below, T12). This is
-- a genuine, disclosed, live-data-backed limitation, not a gap in this
-- RPC -- real issue attribution depends on Phase 10F introducing a real
-- issue movement flow. To still prove the read side of the canonical
-- worked example (which the architecture doc's own example requires),
-- the two 'issue' rows are inserted directly as fixture rows (same
-- disclosed pattern Phase 8's own 095 test already established), NOT
-- through the RPC -- clearly separated below from every RPC-produced row.
--
-- Executed live against supabase-target via Supabase MCP.
--
-- CORRECTION PASS (2026-09-14): added T20-T27 below, proving (a) the
-- cardinality contract this architecture intentionally permits -- ONE
-- inventory_movement_line split across MANY RepairOrderLines, capped by the
-- locked global SUM, proven both for the success split (T20-T22) and its
-- over-cap inverse (T23-T25, no partial write) -- and (b) the corrected
-- production write boundary: a direct authenticated client INSERT against
-- repair_order_line_movement_links is now denied (T26), while the SAME
-- actor's call to the canonical attach_repair_order_line_movement RPC still
-- succeeds (T27) -- see migration 20260914052934_repair_order_line_
-- movement_links_close_direct_insert.sql. Everything above T20 is UNCHANGED
-- from the original Phase 10 pass (re-run and reconfirmed passing as-is).

BEGIN;

SELECT plan(29);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, org_other uuid, branch_other uuid,
  e2e_user uuid,
  ro uuid, ro_other_order uuid,
  line_worked uuid, line_no_variant uuid, line_sku_a uuid, line_sku_b uuid, line_variant_check uuid, line_dup_test uuid,
  variant_1 uuid, variant_2 uuid, unit_1 uuid,
  doctype uuid, movement_type_receipt uuid,
  variant_other uuid, unit_other uuid, movement_type_other uuid,
  hdr_r1 uuid, hdr_r2 uuid, hdr_r3 uuid, hdr_dup uuid, hdr_draft uuid,
  hdr_sku_a uuid, hdr_sku_b uuid, hdr_branch_b uuid, hdr_wrong_ref uuid, hdr_variant_mismatch uuid, hdr_other_org uuid,
  ml_r1 uuid, ml_r2 uuid, ml_r3 uuid, ml_dup uuid, ml_draft uuid,
  ml_sku_a uuid, ml_sku_b uuid, ml_branch_b uuid, ml_wrong_ref uuid, ml_variant_mismatch uuid, ml_other_org uuid,
  line_split_a uuid, line_split_b uuid, hdr_split uuid, ml_split uuid,
  line_cap_a uuid, line_cap_b uuid, hdr_overcap uuid, ml_overcap uuid,
  line_rawinsert uuid, hdr_rawinsert uuid, ml_rawinsert uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid, 'e11a5012-d136-4551-952d-6b264023737c'::uuid,
  '9d4b07c2-a7f5-4299-8b05-e9cb30e88660'::uuid,
  '38f9877e-5b6b-4e84-9bf7-405334bdb185'::uuid, 'e14e139d-2ce3-4c10-bb92-78a8023e9452'::uuid,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted -- mirrors 093-096's
-- own convention of creating fixtures before switching to `authenticated`).
-- ===========================================================================

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '097-test-branch-B', 993 FROM fx;

-- A second, genuinely different organization -- for the cross-org rejection
-- test (T9). A fully synthetic minimal chain (org -> branch -> product ->
-- variant -> unit -> movement type) so this test does not depend on the
-- shape of any other real production org.
INSERT INTO organizations (id, name) SELECT org_other, '097-test-other-org' FROM fx;
INSERT INTO branches (id, organization_id, name, branch_number) SELECT branch_other, org_other, '097-other-org-branch', 1 FROM fx;
INSERT INTO inventory_units (id, organization_id, code, name, unit_kind, precision, is_system)
SELECT unit_other, org_other, 'PCS', 'Piece', 'count', 0, false FROM fx;
INSERT INTO inventory_products (id, organization_id, name, product_type, status, base_unit_id, returnable)
SELECT gen_random_uuid(), org_other, '097 other-org product', 'stocked', 'active', unit_other, false FROM fx;
INSERT INTO inventory_variants (id, organization_id, product_id, sku)
SELECT variant_other, org_other, (SELECT id FROM inventory_products WHERE organization_id = (SELECT org_other FROM fx) LIMIT 1), '097-OTHER-SKU' FROM fx;
INSERT INTO inventory_movement_types (id, organization_id, code, document_type_id, name, category)
SELECT movement_type_other, org_other, '101', doctype, 'Receipt', 'receipt' FROM fx;

-- Our own RepairOrder + logical lines.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro, org, branch, '097-test-RO', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_other_order, org, branch, '097-test-RO-other', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_worked, ro, variant_1, '097-WORKED', '097 worked-example line', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_no_variant, ro, NULL, '097-NOVAR', '097 no-variant line', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_sku_a, ro, variant_1, '097-SKU-X', '097 same-SKU line A', 3, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_sku_b, ro, variant_1, '097-SKU-X', '097 same-SKU line B', 3, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_variant_check, ro, variant_1, '097-VARCHK', '097 variant-check line', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_dup_test, ro, variant_1, '097-DUP', '097 duplicate-attribution test line', 4, 'pcs' FROM fx;

-- Cardinality proof fixtures (T20-T25, correction pass): two SAME-SKU
-- RepairOrderLines, each attributing against the SAME movement line --
-- proves attribution is RepairOrderLine-identity based, never SKU-based.
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_split_a, ro, variant_1, '097-SPLIT-SKU', '097 split line A (same SKU as B)', 6, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_split_b, ro, variant_1, '097-SPLIT-SKU', '097 split line B (same SKU as A)', 4, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_cap_a, ro, variant_1, '097-CAP-SKU', '097 over-cap line A', 6, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_cap_b, ro, variant_1, '097-CAP-SKU', '097 over-cap line B', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit)
SELECT line_rawinsert, ro, variant_1, '097-RAWINSERT', '097 raw-insert negative-test line', 5, 'pcs' FROM fx;

-- Real posted 101 movement headers + lines, all in fx.org/fx.branch unless
-- noted otherwise. Every header is fully posted (status='posted') except
-- hdr_draft, which stays 'draft' on purpose (T11).
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_r1, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_r2, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_r3, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_dup, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_draft, org, branch, 'draft', movement_type_receipt, '101', NULL FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_sku_a, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_sku_b, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_branch_b, org, branch_b, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at, reference_type, reference_id)
SELECT hdr_wrong_ref, org, branch, 'posted', movement_type_receipt, '101', now(), 'repair_order', ro_other_order::text FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_variant_mismatch, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_other_org, org_other, branch_other, 'posted', movement_type_other, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_split, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_overcap, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;
INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_rawinsert, org, branch, 'posted', movement_type_receipt, '101', now() FROM fx;

INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_r1, org, branch, hdr_r1, 1, variant_1, unit_1, 2 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_r2, org, branch, hdr_r2, 1, variant_1, unit_1, 2 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_r3, org, branch, hdr_r3, 1, variant_1, unit_1, 1 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_dup, org, branch, hdr_dup, 1, variant_1, unit_1, 4 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_draft, org, branch, hdr_draft, 1, variant_1, unit_1, 5 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_sku_a, org, branch, hdr_sku_a, 1, variant_1, unit_1, 3 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_sku_b, org, branch, hdr_sku_b, 1, variant_1, unit_1, 3 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_branch_b, org, branch_b, hdr_branch_b, 1, variant_1, unit_1, 5 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_wrong_ref, org, branch, hdr_wrong_ref, 1, variant_1, unit_1, 5 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_variant_mismatch, org, branch, hdr_variant_mismatch, 1, variant_2, unit_1, 5 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_other_org, org_other, branch_other, hdr_other_org, 1, variant_other, unit_other, 5 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_split, org, branch, hdr_split, 1, variant_1, unit_1, 10 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_overcap, org, branch, hdr_overcap, 1, variant_1, unit_1, 10 FROM fx;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_rawinsert, org, branch, hdr_rawinsert, 1, variant_1, unit_1, 5 FROM fx;

-- LIVE-DISCOVERED FACT (this session): the shared e2e_user fixture already
-- holds a REAL, permanent warehouse.* wildcard grant in this org (org-wide,
-- branch_id NULL) -- confirmed live via user_effective_permissions before
-- writing this test. T1 needs the actor to genuinely have NEITHER
-- warehouse.inventory.operate NOR .adjust, so those two specific compiled
-- rows are removed for the duration of T1 only (transaction-scoped; the
-- real permanent rows are restored by this whole file's own ROLLBACK, never
-- actually deleted).
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact IN ('warehouse.inventory.operate', 'warehouse.inventory.adjust');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T1: no warehouse.inventory.operate/.adjust grant yet -> 42501, no row
-- created (permission gate, checked before any other logic).
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_r1 INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 2, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T1: expected 42501 permission-denied, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T1: no warehouse.inventory.operate/.adjust grant -> rejected 42501');
  END;
END $$;

RESET ROLE;
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, 'warehouse.inventory.operate', 'warehouse.inventory.operate' FROM fx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T2/T3/T4: worked example receipts, via the REAL RPC, against three real,
-- distinct, posted movement lines (2 + 2 + 1 = 5). Each call is made exactly
-- once inside a DO block (captured into a variable) rather than as a bare
-- scalar subquery, to rule out any risk of the planner evaluating a VOLATILE
-- function's subquery more than once.
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_worked FROM fx), (SELECT ml_r1 FROM fx), 2, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 2::numeric, 'T2: real RPC receipt #1 of 2 succeeds');
END $$;
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_worked FROM fx), (SELECT ml_r2 FROM fx), 2, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 2::numeric, 'T3: real RPC receipt #2 of 2 succeeds (one line -> many movement lines)');
END $$;
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_worked FROM fx), (SELECT ml_r3 FROM fx), 1, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 1::numeric, 'T4: real RPC receipt #3 of 1 succeeds -> receivedQuantity totals 5');
END $$;

-- T5: applied_quantity boundary -- attempting 1 more against ml_r3 (already
-- fully applied at 1/1) exceeds the movement line's own quantity -> 22023.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_r3 INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T5: expected 22023 quantity-exceeded, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T5: applied_quantity exceeding the movement line''s own remaining quantity -> rejected 22023');
  END;
END $$;

-- T6: duplicate attribution (same repair_order_line_id + movement_line_id +
-- relation_type) rejected with a distinct domain error, not silently
-- ignored and not a generic constraint-violation leak. Uses its OWN
-- dedicated RepairOrderLine (line_dup_test), deliberately NOT line_worked
-- -- reusing line_worked here would silently inflate the canonical worked
-- example's own receivedQuantity below (a real bug caught by this file's
-- own first live run: T16 read 7, not 5, until this line was split out).
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_dup_test FROM fx), (SELECT ml_dup FROM fx), 2, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 2::numeric, 'T6a: first attribution against ml_dup (qty 4, applying 2) succeeds');
END $$;
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_dup_test, ml_dup INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 2, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T6b: expected 23505 duplicate, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '23505', 'T6b: repeating the exact same (line, movement line, relation_type) -> rejected 23505, not double-applied');
  END;
END $$;

-- T7: same-SKU independence via the real RPC -- two RepairOrderLines
-- sharing product_code '097-SKU-X' each attribute independently.
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_sku_a FROM fx), (SELECT ml_sku_a FROM fx), 3, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 3::numeric, 'T7a: same-SKU line A attributes its own 3 independently');
END $$;
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity), 0) FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_sku_b FROM fx)),
  0::numeric, 'T7b: same-SKU line B is untouched by line A''s attribution (still 0)'
);

-- T8: cross-org rejection -- movement line belongs to a genuinely different
-- organization -> 42501, never attributed by SKU/coincidence.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_other_org INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T8: expected 42501 cross-org rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T8: movement line from a different organization -> rejected 42501');
  END;
END $$;

-- T9: cross-branch rejection -- movement line belongs to a different branch
-- in the SAME organization -> 42501.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_branch_b INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T9: expected 42501 cross-branch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T9: movement line from a different branch (same org) -> rejected 42501');
  END;
END $$;

-- T10: not-posted (draft) movement line rejected -> 55000.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_draft INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T10: expected 55000 not-posted rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'T10: draft (not posted) movement line -> rejected 55000');
  END;
END $$;

-- T11 (mandatory issue-side proof): relation_type='issue' against a real
-- RECEIPT-category movement line is rejected -- and, combined with the
-- header comment's live finding (zero 'issue'-category movement types
-- exist in this project today), proves no real issue attribution can
-- succeed through this RPC yet. Not a gap in this RPC -- a disclosed,
-- live-data-backed limitation pending Phase 10F.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_sku_b INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'issue');
    INSERT INTO test_log(line) SELECT fail('T11: expected 22023 category mismatch, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T11: relation_type=issue against a receipt-category movement line -> rejected 22023 (no live issue category exists at all)');
  END;
END $$;

-- T12: RepairOrder-reference consistency -- the movement header explicitly
-- references a DIFFERENT RepairOrder -> rejected 55000.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_worked, ml_wrong_ref INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T12: expected 55000 wrong-reference rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'T12: movement referenced to a different RepairOrder -> rejected 55000');
  END;
END $$;

-- T13: variant/product identity mismatch (never inferred from SKU text) ->
-- rejected 55000.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_variant_check, ml_variant_mismatch INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T13: expected 55000 variant-mismatch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '55000', 'T13: movement line variant does not match the RepairOrderLine''s own variant -> rejected 55000');
  END;
END $$;

-- T14: actor-identity spoof -- p_actor_user_id does not match auth.uid() ->
-- rejected 28000.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_no_variant, ml_variant_mismatch INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(gen_random_uuid(), v_line, v_ml, 1, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T14: expected 28000 actor-mismatch rejection, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '28000', 'T14: p_actor_user_id spoofing (not the authenticated caller) -> rejected 28000');
  END;
END $$;

-- T15: a RepairOrderLine with NO variant_id set (line_no_variant) is not
-- blocked by the variant-compatibility check (only enforced "where
-- authoritative data exists", per the central Phase 10 invariant).
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_no_variant FROM fx), (SELECT ml_variant_mismatch FROM fx), 1, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 1::numeric, 'T15: RepairOrderLine with no variant_id set is not blocked by the variant-compatibility check');
END $$;

-- ===========================================================================
-- CORRECTION PASS (2026-09-14): missing cardinality proof (T20-T25) + the
-- production write-boundary correction's own central acceptance proof
-- (T26-T27). All via the real RPC / real RLS, same actor, same role.
-- ===========================================================================

-- T20/T21/T22: the architecture's own cardinality contract -- ONE
-- inventory_movement_line (ml_split, quantity=10) split across TWO
-- DIFFERENT, same-SKU RepairOrderLines. Proves attribution is
-- RepairOrderLine-identity based, never SKU-identity based -- both lines
-- share product_code '097-SPLIT-SKU', yet attribute independently against
-- the SAME physical movement line, and the movement line's own total
-- attributed sum reaches exactly its quantity (10), not more, not less.
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_split_a FROM fx), (SELECT ml_split FROM fx), 6, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 6::numeric, 'T20: same movement line, RepairOrderLine A (same SKU as B) receives 6 -> succeeds');
END $$;
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_split_b FROM fx), (SELECT ml_split FROM fx), 4, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 4::numeric, 'T21: same movement line, RepairOrderLine B (same SKU as A) receives 4 -> succeeds');
END $$;
-- T22 (the read-back of the movement line's own total) is deferred to
-- AFTER `RESET ROLE` below, alongside T16-T19/T25 -- this test's own actor
-- is granted `warehouse.inventory.operate` (needed for the WRITE side) but
-- NOT `workshop.repair_orders.read` (needed to SELECT the link rows back
-- under this table's own RLS), so reading them back as `authenticated`
-- here would read 0 regardless of what the RPC actually wrote -- exactly
-- the same RLS-visibility artifact already relied on for T16-T19's own
-- placement, not a data bug (this file's own first live run of this
-- correction pass caught exactly this: T22 read 0, not 10, until moved).

-- T23/T24/T25: the over-cap inverse -- SAME shape, but B's request (5)
-- would push the movement line's total to 11 > 10 -> rejected. Proves no
-- partial write: A's own row is untouched at 6, B's own contribution is
-- entirely absent (not partially written), and the movement line's total
-- stays at 6, not 6+5 and not some partial amount.
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_cap_a FROM fx), (SELECT ml_overcap FROM fx), 6, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 6::numeric, 'T23: over-cap scenario, RepairOrderLine A receives 6 of 10 -> succeeds');
END $$;
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_cap_b, ml_overcap INTO v_line, v_ml FROM fx;
  BEGIN
    PERFORM attach_repair_order_line_movement(auth.uid(), v_line, v_ml, 5, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T24: expected 22023 over-cap rejection (6+5=11 > 10), call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '22023', 'T24: RepairOrderLine B attempts 5 more (6+5=11 > movement line quantity 10) -> rejected 22023, no partial write');
  END;
END $$;
-- T25 (the read-back) is likewise deferred to after `RESET ROLE` -- see T22's own comment above for why.

-- T26/T27: the central acceptance proof for this correction -- the SAME
-- actor, holding the SAME warehouse.inventory.operate grant that used to
-- satisfy the old permissive INSERT policy, can no longer write a
-- repair_order_line_movement_links row by a direct client INSERT (the
-- production write boundary is now closed -- migration 20260914052934),
-- but the canonical RPC still succeeds for that identical actor and data.
DO $$
DECLARE v_line uuid; v_ml uuid;
BEGIN
  SELECT line_rawinsert, ml_rawinsert INTO v_line, v_ml FROM fx;
  BEGIN
    INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
    VALUES (v_line, v_ml, 2, 'receipt');
    INSERT INTO test_log(line) SELECT fail('T26: expected the direct INSERT to be denied by RLS, it succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'T26: a direct authenticated client INSERT (same actor, same warehouse.inventory.operate grant that used to be sufficient) is now denied by RLS -- the RPC is the only production write path');
  END;
END $$;
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT attach_repair_order_line_movement((SELECT e2e_user FROM fx), (SELECT line_rawinsert FROM fx), (SELECT ml_rawinsert FROM fx), 2, 'receipt') INTO v_result;
  INSERT INTO test_log(line) SELECT is((v_result ->> 'applied_quantity')::numeric, 2::numeric, 'T27: the SAME actor calling the canonical attach_repair_order_line_movement RPC still succeeds -- confirms the RPC never depended on the now-closed direct-INSERT policy (SECURITY DEFINER, owner=postgres, rolbypassrls=true)');
END $$;

RESET ROLE;

-- ===========================================================================
-- Canonical worked example, read side (mandatory test #1). Receipts (5 =
-- 2+2+1) are the SAME real rows T2-T4 already produced via the RPC above --
-- no new rows inserted here for the receipt half. Issues (3 = 2+1) are
-- inserted directly as fixture rows (connecting role, bypassing the RPC),
-- exactly as disclosed above and in this file's header comment: no real
-- 'issue'-category movement exists live today for the RPC to attribute
-- against (T11 proves this negatively). This still reads the SAME derived-
-- quantity formula Phase 8's listRepairOrderLines uses, against a table
-- that is otherwise indistinguishable from one populated entirely for real.
-- ===========================================================================
-- `now()` is stable for the whole transaction in Postgres (it returns the
-- TRANSACTION start time, not per-statement), so every fixture header
-- above shares the exact same created_at -- "pick the most recent header"
-- would be genuinely non-deterministic. This header's own id is therefore
-- generated explicitly up front and reused directly, exactly like every
-- other fixture header above, rather than looked up after the fact.
CREATE TEMP TABLE fx_issue AS
SELECT gen_random_uuid() AS hdr_issue, gen_random_uuid() AS ml_issue_1, gen_random_uuid() AS ml_issue_2;

INSERT INTO inventory_movement_headers (id, organization_id, branch_id, status, movement_type_id, movement_type_code, posted_at)
SELECT hdr_issue, fx.org, fx.branch, 'posted', fx.movement_type_receipt, '101', now()
FROM fx, fx_issue;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_issue_1, fx.org, fx.branch, hdr_issue, 1, fx.variant_1, fx.unit_1, 2
FROM fx, fx_issue;
INSERT INTO inventory_movement_lines (id, organization_id, branch_id, movement_id, line_number, variant_id, unit_id, quantity)
SELECT ml_issue_2, fx.org, fx.branch, hdr_issue, 2, fx.variant_1, fx.unit_1, 1
FROM fx, fx_issue;

INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT (SELECT line_worked FROM fx), ml_issue_1, 2, 'issue' FROM fx_issue;
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT (SELECT line_worked FROM fx), ml_issue_2, 1, 'issue' FROM fx_issue;

-- T22 (deferred from the split-success block above -- see its own comment
-- there for why this read happens post-RESET ROLE, as the unrestricted
-- connecting role, exactly like T16-T19 below).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity), 0) FROM repair_order_line_movement_links WHERE inventory_movement_line_id = (SELECT ml_split FROM fx)),
  10::numeric,
  'T22: the movement line''s own total attributed (across both RepairOrderLines) is exactly 10 (its own quantity) -- A=6 + B=4'
);

-- T25 (deferred from the over-cap block above -- same reason as T22).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity), 0) FROM repair_order_line_movement_links WHERE inventory_movement_line_id = (SELECT ml_overcap FROM fx)),
  6::numeric,
  'T25: after the rejected over-cap attempt, the movement line''s own total attributed remains exactly 6 -- A''s row untouched, B''s row never created, no partial write'
);

-- T16: receivedQuantity = 5 (real RPC-produced rows).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx)),
  5::numeric, 'T16 (worked example): receivedQuantity = 5 via 3 real RPC-produced receipt links (2+2+1)'
);

-- T17: issuedQuantity = 3 (disclosed fixture rows -- no real issue category exists).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'issue'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx)),
  3::numeric, 'T17 (worked example): issuedQuantity = 3 (2+1, fixture rows -- disclosed, no live issue category exists)'
);

-- T18: outstandingToReceive = ordered(5) - received(5) = 0.
INSERT INTO test_log(line) SELECT is(
  (
    (SELECT ordered_quantity FROM repair_order_lines WHERE id = (SELECT line_worked FROM fx))
    - (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
       FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
  ),
  0::numeric, 'T18 (worked example): outstandingToReceive = 0 (ordered=5, received=5)'
);

-- T19: availableForIssue = received(5) - issued(3) = 2.
INSERT INTO test_log(line) SELECT is(
  (
    (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
     FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
    - (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'issue'), 0)
       FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
  ),
  2::numeric, 'T19 (worked example): availableForIssue = 2 (received=5, issued=3)'
);

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
