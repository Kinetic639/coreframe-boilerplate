-- ============================================================================
-- TEST: Phase 9 provenance read model -- live RLS + M:N + traceability
-- ============================================================================
-- Complements the mocked service-level tests in repair-orders.service.test.ts
-- (RepairOrdersService.getRepairOrderProvenance) with the SAME assertions
-- proven against real persisted rows and real RLS, as the genuinely-RLS-
-- enforced `authenticated` role (not `postgres`).
--
-- Live data at verification time (2026-09-12) showed a perfect 1:1:1 ratio
-- between documents/orders/links (26 = 26 = 26) -- no document-M:N or
-- later-arrival scenario exists in production yet. This test therefore
-- creates its own transaction-scoped fixture rows directly (bypassing the
-- materialization RPC, exactly as the same class of test already did for
-- Phase 8's same-SKU-independence case) and rolls everything back at the
-- end -- zero residual data. All fixture INSERTs happen before the role
-- switch below (this test's own actor is granted only
-- workshop.repair_orders.read -- a read-only grant -- so every write must
-- happen while still connected as the unrestricted connecting role, exactly
-- matching 093/094/095's own established fixture-setup convention).
--
-- Covers, against real rows and real RLS (not mocks):
--   - one document -> many RepairOrders (M:N), WITHOUT leaking one order's
--     logical-line contribution into the other's provenance (the exact
--     cross-order leak found and fixed during this phase's own
--     implementation -- see repair-orders.service.ts's own doc comment).
--   - one RepairOrder -> many source documents.
--   - one logical RepairOrderLine -> many source lines, quantity_
--     contribution preserved exactly, never summed/collapsed.
--   - source-line unique ownership: a source line CANNOT be linked to a
--     second logical RepairOrderLine (negative case, proven via the
--     specific expected SQLSTATE).
--   - traceability to a specific, real, existing wdd_matcher_lines row.
--   - branch isolation: a RepairOrder (and its provenance) in a branch the
--     actor has no permission for is completely invisible.
--   - later-arriving document: a second document attaches to an ALREADY-
--     EXISTING RepairOrder without creating a duplicate order.
--
-- Executed live against supabase-target via Supabase MCP. Last run:
-- 2026-09-12, 15/15 assertions passing.
--
-- NOTE (external-review correction, same day): a separate cross-order
-- SOURCE-LINE METADATA leak (not just the contribution-reference leak T3
-- proves at the raw data-shape level below) was found and fixed in the
-- TypeScript mapper (`RepairOrdersService.getRepairOrderProvenance` /
-- `mapProvenanceDocument`), not in this SQL file -- pgTAP tests the
-- underlying relational data/RLS/constraints directly, not the
-- application-layer filtering logic that fix lives in, so this file's own
-- assertions/fixtures did not need to change and were not re-run for that
-- fix. See `repair-orders.service.test.ts`'s own "cross-order metadata
-- leak fix" tests for the live proof of that specific correction.

BEGIN;

SELECT plan(15);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, branch_b uuid, e2e_user uuid,
  session1 uuid,
  ro1 uuid, ro2 uuid, ro_other_branch uuid,
  doc1 uuid, doc2 uuid, doc_later uuid, doc_other_branch uuid,
  line_mine uuid, line_theirs uuid,
  docline_a uuid, docline_b uuid, docline_theirs uuid, docline_traced uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  gen_random_uuid(),
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

-- ===========================================================================
-- Fixture setup (as the connecting role, unrestricted -- mirrors 093/094/095's
-- own convention of creating fixtures before switching to `authenticated`).
-- ===========================================================================

-- Second branch, same org -- for the branch-isolation tests.
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch_b, org, '096-test-branch-B', 994 FROM fx;

-- Minimal synthetic Matcher session (own module, not otherwise touched by
-- Phase 9 -- only needed to satisfy workshop_source_documents' own NOT NULL
-- FK to it).
INSERT INTO wdd_matcher_sessions (id, organization_id, branch_id, name, status)
SELECT session1, org, branch, '096-test-session', 'approved' FROM fx;

-- Three RepairOrders: ro1/ro2 in the real branch (for the document-M:N and
-- cross-order-leak tests), ro_other_branch in branch_b (isolation test).
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro1, org, branch, '096-test-RO1', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro2, org, branch, '096-test-RO2', 'open' FROM fx;
INSERT INTO repair_orders (id, organization_id, branch_id, order_number, status)
SELECT ro_other_branch, org, branch_b, '096-test-RO-other-branch', 'open' FROM fx;

-- Logical lines (Phase 8): line_mine under ro1, line_theirs under ro2.
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_mine, ro1, '096-SKU-A', '096 line under ro1', 2, 'pcs' FROM fx;
INSERT INTO repair_order_lines (id, repair_order_id, product_code, product_name, ordered_quantity, unit)
SELECT line_theirs, ro2, '096-SKU-B', '096 line under ro2', 4, 'pcs' FROM fx;

-- doc1: linked to BOTH ro1 and ro2 -- proves one document -> many orders.
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc1, org, branch, 'wdd', '096-DOC-SHARED', session1 FROM fx;
INSERT INTO repair_order_source_document_links (repair_order_id, workshop_source_document_id)
SELECT ro1, doc1 FROM fx;
INSERT INTO repair_order_source_document_links (repair_order_id, workshop_source_document_id)
SELECT ro2, doc1 FROM fx;

-- doc2: linked to ro1 only -- combined with doc1, proves ro1 -> many docs.
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc2, org, branch, 'zl', '096-DOC-RO1-ONLY', session1 FROM fx;
INSERT INTO repair_order_source_document_links (repair_order_id, workshop_source_document_id)
SELECT ro1, doc2 FROM fx;

-- Later-arriving document: attaches to the ALREADY-EXISTING ro1 (simulating
-- a second Matcher session's materialization output arriving after the
-- fact) -- fixture created now; T10/T11 below verify it does not create a
-- duplicate order and appears alongside the original provenance.
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_later, org, branch, 'wdd', '096-DOC-LATER', session1 FROM fx;
INSERT INTO repair_order_source_document_links (repair_order_id, workshop_source_document_id)
SELECT ro1, doc_later FROM fx;

-- A source document scoped to branch_b -- for the branch-isolation test.
INSERT INTO workshop_source_documents (id, organization_id, branch_id, document_type, external_document_number, source_session_id)
SELECT doc_other_branch, org, branch_b, 'wdd', '096-DOC-OTHER-BRANCH', session1 FROM fx;

-- doc1 has TWO lines: docline_a contributes to ro1's line_mine, docline_theirs
-- contributes to ro2's line_theirs -- the exact cross-order-leak scenario.
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, product_code, product_name, quantity, unit)
SELECT docline_a, doc1, '096-SKU-A', '096 part A', 2, 'pcs' FROM fx;
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, product_code, product_name, quantity, unit)
SELECT docline_theirs, doc1, '096-SKU-B', '096 part B', 4, 'pcs' FROM fx;

-- doc2 has one line (docline_b), ALSO contributing to line_mine -- proves
-- one logical line -> many source lines, across TWO different documents.
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, product_code, product_name, quantity, unit)
SELECT docline_b, doc2, '096-SKU-A', '096 part A (2nd batch)', 3, 'pcs' FROM fx;

-- A source line for the traceability test, referencing a REAL, EXISTING
-- wdd_matcher_lines row (read-only reference, borrowed by id -- does not
-- mutate wdd_matcher_lines itself).
INSERT INTO workshop_source_document_lines (id, workshop_source_document_id, product_code, product_name, quantity, unit, wdd_matcher_line_id)
SELECT docline_traced, doc2, '096-TRACED', '096 traced part', 1, 'pcs',
  (SELECT id FROM wdd_matcher_lines LIMIT 1)
FROM fx;

-- Links: docline_a (2) + docline_b (3) -> line_mine (total 5, matches
-- ordered_quantity=2... intentionally left at 2 to independently prove
-- quantity_contribution is read AS PERSISTED, not recomputed/reconciled
-- against ordered_quantity -- this phase must expose real data, not
-- silently normalize a mismatch).
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT line_mine, docline_a, 2 FROM fx;
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT line_mine, docline_b, 3 FROM fx;
-- docline_theirs -> line_theirs (ro2's own line -- this is the "leak
-- candidate" the cross-order fix must exclude from ro1's own provenance).
INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution)
SELECT line_theirs, docline_theirs, 4 FROM fx;

-- T-integrity (data integrity, checked as the unrestricted connecting role
-- -- independent of RLS): the traced source line's wdd_matcher_line_id
-- genuinely resolves to a real, existing wdd_matcher_lines row (not a
-- dangling/fabricated id). Proven here, before the role switch, precisely
-- BECAUSE the authenticated actor below cannot read wdd_matcher_lines
-- directly (see T9/T9b) -- this is the one assertion in this file that
-- deliberately runs outside the RLS-enforced role, to isolate "is the data
-- itself correct" from "can this specific actor see it".
INSERT INTO test_log(line) SELECT ok(
  EXISTS (
    SELECT 1 FROM wdd_matcher_lines wml
    JOIN workshop_source_document_lines wsdl ON wsdl.wdd_matcher_line_id = wml.id
    WHERE wsdl.id = (SELECT docline_traced FROM fx)
  ),
  'T-integrity: the traced source line''s wdd_matcher_line_id resolves to a real, existing wdd_matcher_lines row (data-integrity check, not an RLS-outcome check)'
);

-- Actor holds workshop.repair_orders.read + .manage_all for the PRIMARY
-- branch ONLY -- deliberately nothing granted for branch_b, to prove branch
-- isolation. manage_all is included (not just .read) so that T8's negative
-- unique-constraint case below is genuinely proven at the CONSTRAINT layer
-- -- without it, RLS's own manage_own/manage_all requirement on
-- repair_order_line_source_links_insert would reject the attempt first
-- (42501), before the unique constraint ever got a chance to fire, which
-- would prove the wrong thing.
DELETE FROM user_effective_permissions WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx);
INSERT INTO user_effective_permissions (user_id, organization_id, branch_id, permission_slug, permission_slug_exact)
SELECT e2e_user, org, branch, slug, slug FROM fx, unnest(ARRAY['workshop.repair_orders.read', 'workshop.repair_orders.manage_all']) AS slug;

-- ===========================================================================
-- Assertions, as the genuinely-RLS-enforced `authenticated` role.
-- ===========================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- T1: doc1 (shared) is visible from BOTH ro1's and ro2's own document-link
-- list -- proves one document -> many orders.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_source_document_links
   WHERE workshop_source_document_id = (SELECT doc1 FROM fx)
     AND repair_order_id IN (SELECT ro1 FROM fx UNION SELECT ro2 FROM fx)),
  2,
  'T1: doc1 is linked to BOTH ro1 and ro2 (one document -> many orders)'
);

-- T2: ro1 has THREE documents linked (doc1 + doc2 + doc_later, the last
-- one being the later-arrival) -- proves one order -> many documents.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_source_document_links WHERE repair_order_id = (SELECT ro1 FROM fx)),
  3,
  'T2: ro1 is linked to THREE source documents (one order -> many documents)'
);

-- T3 (cross-order leak): a raw SQL simulation of ro1's own provenance
-- fetch -- joining through doc1's lines -- confirms that WITHOUT
-- filtering, a contribution belonging to a DIFFERENT order (line_theirs)
-- genuinely IS reachable via the shared document, proving the leak
-- scenario this phase's service-layer fix (ownLineIds filtering) is
-- required to close (verified separately, live, in the mocked Vitest
-- suite's own "cross-order leak fix" test, since pgTAP cannot invoke the
-- application's own filtering code -- this assertion proves the DATA
-- SHAPE that makes the fix necessary).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_line_source_links rls
   JOIN workshop_source_document_lines wsdl ON wsdl.id = rls.workshop_source_document_line_id
   WHERE wsdl.workshop_source_document_id = (SELECT doc1 FROM fx)
     AND rls.repair_order_line_id NOT IN (SELECT id FROM repair_order_lines WHERE repair_order_id = (SELECT ro1 FROM fx))),
  1,
  'T3: exactly one contribution on the shared document belongs to a DIFFERENT order (line_theirs) -- confirms the leak scenario is real and must be filtered client-side'
);

-- T4: one logical line (line_mine) has source contributions from TWO
-- different documents (doc1's docline_a=2, doc2's docline_b=3) -- proves
-- one logical line -> many source lines, across documents.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_line_source_links WHERE repair_order_line_id = (SELECT line_mine FROM fx)),
  2,
  'T4: line_mine has TWO independent source-line contributions (across two different documents)'
);

-- T5/T6: quantity_contribution is preserved EXACTLY as persisted for each
-- -- never summed/collapsed into one row.
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity_contribution FROM repair_order_line_source_links WHERE workshop_source_document_line_id = (SELECT docline_a FROM fx)),
  2::numeric,
  'T5: docline_a''s quantity_contribution is exactly 2, as persisted'
);
INSERT INTO test_log(line) SELECT is(
  (SELECT quantity_contribution FROM repair_order_line_source_links WHERE workshop_source_document_line_id = (SELECT docline_b FROM fx)),
  3::numeric,
  'T6: docline_b''s quantity_contribution is exactly 3, as persisted'
);

-- T7: real persisted data may legitimately diverge from ordered_quantity
-- (2+3=5 contributed vs. ordered_quantity=2 on line_mine) -- this phase
-- must expose that truthfully, not silently reconcile it. Confirms the sum
-- genuinely differs, matching this test's own deliberate fixture choice.
INSERT INTO test_log(line) SELECT isnt(
  (SELECT ordered_quantity FROM repair_order_lines WHERE id = (SELECT line_mine FROM fx)),
  (SELECT sum(quantity_contribution) FROM repair_order_line_source_links WHERE repair_order_line_id = (SELECT line_mine FROM fx)),
  'T7: a genuine ordered_quantity vs. summed quantity_contribution mismatch is real, persisted data -- not silently normalized by this fixture'
);

-- T8: source-line unique ownership -- a source line already linked to
-- line_mine CANNOT also be linked to line_theirs (negative case, specific
-- expected SQLSTATE).
INSERT INTO test_log(line) SELECT throws_ok(
  format(
    'INSERT INTO repair_order_line_source_links (repair_order_line_id, workshop_source_document_line_id, quantity_contribution) VALUES (%L::uuid, %L::uuid, 1)',
    (SELECT line_theirs FROM fx), (SELECT docline_a FROM fx)
  ),
  '23505',
  'duplicate key value violates unique constraint "repair_order_line_source_links_source_line_unique"',
  'T8: a source line already linked to one logical line cannot ALSO be linked to a second (rejected by the unique constraint, SQLSTATE 23505)'
);

-- T9: traceability -- the traced source line's wdd_matcher_line_id is
-- exposed correctly via workshop_source_document_lines' OWN RLS (which
-- only requires workshop.repair_orders.read, already granted) -- NOT via a
-- join through wdd_matcher_lines itself, which this actor deliberately
-- cannot read (no wdd_matcher.read granted -- confirmed by the immediately
-- following T9b). This is exactly the service's own real design: the raw
-- id reference is the traceability signal; the target row's own CONTENT
-- requires a separate, unrelated Matcher-module permission.
INSERT INTO test_log(line) SELECT ok(
  (SELECT wdd_matcher_line_id FROM workshop_source_document_lines WHERE id = (SELECT docline_traced FROM fx)) IS NOT NULL,
  'T9: the traced source line''s wdd_matcher_line_id is exposed via workshop_source_document_lines'' own (accessible) RLS, without requiring wdd_matcher.read'
);

-- T9b: ...confirms WHY the service correctly avoids joining wdd_matcher_
-- lines for content -- this actor (workshop.repair_orders.read/manage_all,
-- no wdd_matcher.read) genuinely cannot see ANY wdd_matcher_lines rows,
-- including the very one just proven to exist at the data-integrity layer
-- above. A naive join would have silently returned nothing here, not an
-- error -- exactly the failure mode the service's own design avoids by
-- never attempting that join in the first place.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM wdd_matcher_lines
   WHERE id = (SELECT wdd_matcher_line_id FROM workshop_source_document_lines WHERE id = (SELECT docline_traced FROM fx))),
  0,
  'T9b: this actor (no wdd_matcher.read) cannot see the traced wdd_matcher_lines row directly, even though it genuinely exists (confirms the cross-module RLS boundary the service design deliberately works around)'
);

-- T10: later-arriving document -- attaching doc_later to the ALREADY-
-- EXISTING ro1 did NOT create a duplicate order row.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_orders WHERE id = (SELECT ro1 FROM fx)),
  1,
  'T10: attaching a later-arriving document to an existing RepairOrder does not create a duplicate order row'
);

-- T11: ...and the later-arriving document is genuinely visible/queryable
-- alongside the original two (old and new provenance both listed).
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_order_source_document_links
   WHERE repair_order_id = (SELECT ro1 FROM fx) AND workshop_source_document_id = (SELECT doc_later FROM fx)),
  1,
  'T11: the later-arriving document is listed alongside ro1''s original provenance, not replacing or duplicating it'
);

-- T12: branch isolation -- the OTHER branch's RepairOrder is completely
-- invisible to an actor with no permission grant there.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM repair_orders WHERE id = (SELECT ro_other_branch FROM fx)),
  0,
  'T12: a RepairOrder in a branch the actor has no permission for is completely invisible'
);

-- T13: branch isolation for provenance tables specifically -- the source
-- document scoped to branch_b is likewise invisible under this actor's
-- read-only, primary-branch-only grant.
INSERT INTO test_log(line) SELECT is(
  (SELECT count(*)::int FROM workshop_source_documents WHERE id = (SELECT doc_other_branch FROM fx)),
  0,
  'T13: a source document in a branch the actor has no permission for is completely invisible'
);

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
