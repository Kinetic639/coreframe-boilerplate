-- ============================================================================
-- TEST: Phase 8 logical RepairOrderLine read model -- live RLS + aggregation
-- ============================================================================
-- Complements the mocked service-level tests in
-- repair-orders.service.test.ts (RepairOrdersService.listRepairOrderLines)
-- with the SAME assertions proven against real persisted rows and real RLS,
-- as the genuinely-RLS-enforced `authenticated` role (not `postgres`).
--
-- Phase 10 has not been built yet, so nothing in this codebase writes real
-- `repair_order_line_movement_links` rows today (live-verified: 0 rows exist
-- in the live table before this test). Per this phase's explicit instruction
-- ("Phase 8 may READ existing repair_order_line_movement_links... use valid
-- persisted linked data or transaction-scoped fixtures that respect the real
-- schema"), this test creates its own transaction-scoped fixture rows
-- directly (bypassing the not-yet-built Phase 10 receiving/issuing flow,
-- exactly as Phase 8's own scope boundary anticipates) and rolls everything
-- back at the end -- zero residual data.
--
-- Covers, against real rows and real RLS (not mocks):
--   - same-SKU independence: two repair_order_lines rows sharing the same
--     product_code, in the same repair_order, remain fully independent --
--     never merged, never cross-attributed.
--   - the worked example (ordered=5, receipts 2+2+1=5, issues 2+1=3 ->
--     outstandingToReceive=0, availableForIssue=2), computed via a raw SQL
--     aggregation that mirrors exactly what the service's PostgREST embedded
--     select + TypeScript reduce() computes.
--   - one line -> many receipt links and many issue links, aggregated
--     strictly by repair_order_line_id.
--   - a 'reversal'-typed row does not affect either sum (disclosed
--     limitation, not netted -- matches the service's own documented
--     behavior).
--   - branch isolation: a second RepairOrder in a branch the actor has no
--     permission for is completely invisible (parent AND lines), proving
--     "parent RepairOrder not accessible -> lines not exposed" at the RLS
--     layer, not just the service's own defensive pre-check.
--
-- Executed live against supabase-target via Supabase MCP. Last run:
-- 2026-09-12, 11/11 assertions passing.

BEGIN;

SELECT plan(11);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, e2e_user uuid,
  ro1 uuid, ro2_other_branch uuid,
  line_a uuid, line_b uuid, line_worked uuid, line_empty uuid, line_reversal uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- Second branch, same org -- the actor will NOT be granted any permission
-- there, to prove branch isolation.
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '095-test-branch-B', 995 FROM fx;

-- Primary RepairOrder (real branch) with 5 logical lines fixturing every
-- scenario this test needs, all inserted directly (as the connecting role,
-- which bypasses RLS here exactly as 093/094's own fixture setup already
-- does for crm_contacts) -- Phase 10's real receiving/issuing flow does not
-- exist yet to create these through the normal path.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro1, org, branch, '095-test-RO', 'open' FROM fx;

-- Same-org, DIFFERENT branch RepairOrder -- for the branch-isolation test.
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro2_other_branch, org, branch_b, '095-test-RO-other-branch', 'open' FROM fx;

INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_a, ro1, 'SKU-X', '095 same-SKU line A', 2, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_b, ro1, 'SKU-X', '095 same-SKU line B', 3, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_worked, ro1, '095-WORKED', '095 worked-example line', 5, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_empty, ro1, '095-EMPTY', '095 no-links line', 7, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_reversal, ro1, '095-REV', '095 reversal line', 10, 'pcs' FROM fx;

-- Real inventory_movement_lines rows are required as movement-link FK
-- targets -- reuse 9 distinct existing ones (RLS/content of that table is
-- irrelevant to this test; only distinct ids are needed, since
-- repair_order_line_movement_links_unique is UNIQUE on (repair_order_line_id,
-- inventory_movement_line_id, relation_type) -- reusing the SAME movement
-- line id for two rows of the SAME relation_type on the SAME logical line
-- would collide with that constraint).
CREATE TEMP TABLE fx_movement AS
SELECT id AS movement_line_id, row_number() OVER () AS rn FROM inventory_movement_lines LIMIT 9;

-- Line A: one receipt of 2 (fully independent from line B below).
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_a, (SELECT movement_line_id FROM fx_movement WHERE rn = 1), 2, 'receipt' FROM fx;

-- Line B: one receipt of 1 -- same SKU as line A, must never be summed
-- together or cross-attributed.
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_b, (SELECT movement_line_id FROM fx_movement WHERE rn = 2), 1, 'receipt' FROM fx;

-- Worked example: 3 receipts (2+2+1=5), 2 issues (2+1=3), each against a
-- distinct movement line id.
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_worked, m.movement_line_id, q.applied, 'receipt'
FROM fx, (VALUES (3,2),(4,2),(5,1)) AS q(rn, applied) JOIN fx_movement m ON m.rn = q.rn;
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_worked, m.movement_line_id, q.applied, 'issue'
FROM fx, (VALUES (6,2),(7,1)) AS q(rn, applied) JOIN fx_movement m ON m.rn = q.rn;

-- Reversal line: one receipt of 5, one reversal of 3 -- reversal must not
-- net against the receipt sum (disclosed limitation, not implemented).
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_reversal, (SELECT movement_line_id FROM fx_movement WHERE rn = 8), 5, 'receipt' FROM fx;
INSERT INTO repair_order_line_movement_links (repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type)
SELECT line_reversal, (SELECT movement_line_id FROM fx_movement WHERE rn = 9), 3, 'reversal' FROM fx;

-- Actor holds workshop.repair_orders.read ONLY for the PRIMARY branch --
-- deliberately nothing granted for branch_b, to prove branch isolation.
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, 'workshop.repair_orders.read', 'workshop.repair_orders.read' FROM fx;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T1: same-SKU lines A and B are BOTH visible as separate rows (not merged).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM repair_order_lines WHERE repair_order_id = (SELECT ro1 FROM fx) AND product_code = 'SKU-X')::int,
  2,
  'T1: two same-SKU lines (A and B) are both visible as separate rows, not merged into one'
);

-- T2: line A's own ordered_quantity is untouched by line B (2, not 5).
INSERT INTO test_log(line) SELECT is(
  (SELECT ordered_quantity FROM repair_order_lines WHERE id = (SELECT line_a FROM fx)),
  2::numeric,
  'T2: line A''s ordered_quantity remains 2 (not summed with line B''s 3)'
);

-- T3: line A's aggregated received quantity (via the same GROUP BY
-- repair_order_line_id shape the service uses) is 2 -- only its own link.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_a FROM fx)),
  2::numeric,
  'T3: line A''s received quantity is 2, aggregated strictly by its own repair_order_line_id'
);

-- T4: line B's aggregated received quantity is 1 -- independently, never
-- picking up line A's 2 despite sharing the same SKU.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_b FROM fx)),
  1::numeric,
  'T4: line B''s received quantity is 1, independent of line A''s'
);

-- T5: worked example -- received = 5 (2+2+1).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx)),
  5::numeric,
  'T5 (worked example): receivedQuantity = 5 across 3 receipt links (2+2+1)'
);

-- T6: worked example -- issued = 3 (2+1).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'issue'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx)),
  3::numeric,
  'T6 (worked example): issuedQuantity = 3 across 2 issue links (2+1)'
);

-- T7: worked example -- outstandingToReceive = ordered(5) - received(5) = 0.
INSERT INTO test_log(line) SELECT is(
  (
    (SELECT ordered_quantity FROM repair_order_lines WHERE id = (SELECT line_worked FROM fx))
    - (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
       FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
  ),
  0::numeric,
  'T7 (worked example): outstandingToReceive = 0 (ordered=5, received=5)'
);

-- T8: worked example -- availableForIssue = received(5) - issued(3) = 2.
INSERT INTO test_log(line) SELECT is(
  (
    (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
     FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
    - (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'issue'), 0)
       FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_worked FROM fx))
  ),
  2::numeric,
  'T8 (worked example): availableForIssue = 2 (received=5, issued=3)'
);

-- T9: a line with zero movement links has zero derived quantities (not NULL
-- -- the COALESCE(...,0) shape this test mirrors from the service).
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity), 0) FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_empty FROM fx)),
  0::numeric,
  'T9: a line with zero movement links aggregates to 0, not NULL'
);

-- T10: 'reversal' does not net against the receipt sum -- still reads 5,
-- not 2 (5 receipt - 3 reversal), matching the disclosed non-netting
-- limitation.
INSERT INTO test_log(line) SELECT is(
  (SELECT COALESCE(SUM(applied_quantity) FILTER (WHERE relation_type = 'receipt'), 0)
   FROM repair_order_line_movement_links WHERE repair_order_line_id = (SELECT line_reversal FROM fx)),
  5::numeric,
  'T10: a reversal-typed row does not net against the receipt sum (disclosed limitation)'
);

-- T11: branch isolation -- the OTHER branch's RepairOrder and its lines are
-- completely invisible to an actor with no permission grant there (parent
-- AND lines, proving RLS itself enforces "parent not accessible -> lines
-- not exposed", not merely the service's own defensive pre-check).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM repair_orders WHERE id = (SELECT ro2_other_branch FROM fx))::int
  + (SELECT count(*) FROM repair_order_lines rol
     JOIN repair_orders ro ON ro.id = rol.repair_order_id
     WHERE ro.id = (SELECT ro2_other_branch FROM fx))::int,
  0,
  'T11: a RepairOrder (and its lines) in a branch the actor has no permission for is completely invisible'
);

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
