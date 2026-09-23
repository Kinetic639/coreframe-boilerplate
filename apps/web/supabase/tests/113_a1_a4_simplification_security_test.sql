-- ============================================================================
-- TEST: INVENTORY CORE A1/A4 SIMPLIFICATION PASS -- DB-level proof
-- ============================================================================
-- Permanent regression coverage for the two live DB changes this pass made:
--
-- A1: inventory_convert_quantity (confirmed dead -- zero SQL/TS callers,
--     see docs/inventory/reviews/inventory-a1-a6-simplification-review/)
--     was DROP'd entirely (migration a1_drop_dead_inventory_convert_
--     quantity). Proven here: the function no longer exists for ANY role
--     (not just anon -- a strictly stronger closure than the IC-7 closing
--     pass's own grant hardening, which this supersedes for this one
--     function; see 111_ic7_closing_security_test.sql's own corrected
--     scenario A8).
--
-- A4: inventory_get_or_create_balance_for_update's lingering `authenticated`
--     EXECUTE grant was revoked (migration a4_revoke_authenticated_
--     balance_lock_helper) -- the exact residual item the architecture
--     compression review disclosed and deferred to this pass. Live-
--     confirmed pre-migration: 6 real callers, all SECURITY DEFINER owned
--     by postgres (same-owner nesting, unaffected by this REVOKE), zero
--     real TS/direct-application callers. Proven here: a direct
--     authenticated call is now denied at the grant layer (before RLS or
--     any function-body logic runs), while a representative canonical
--     caller (inventory_create_reservation) still succeeds end-to-end for
--     a real, permissioned authenticated user.
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(7);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, variant_1 uuid, unit_1 uuid, e2e_user uuid, loc uuid
);
GRANT SELECT ON fx TO authenticated, anon;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  'e39b15da-0a8d-4056-b5a2-80eb1da868a6'::uuid,
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated, anon;

INSERT INTO warehouse_locations (id, organization_id, branch_id, name, code, can_store_inventory)
SELECT loc, org, branch, '113-a4-probe-loc', '113-A4-PROBE', true FROM fx;

SELECT set_config('ambra.inventory_movement_engine', 'on', true);
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, loc, variant_1, 0, 0, 0 FROM fx;
UPDATE inventory_balances b SET on_hand_quantity = 50
FROM fx WHERE b.organization_id = fx.org AND b.branch_id = fx.branch AND b.location_id = fx.loc AND b.variant_id = fx.variant_1;

-- ===========================================================================
-- A1: inventory_convert_quantity no longer exists, for any role
-- ===========================================================================
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.inventory_convert_quantity(
      (SELECT org FROM fx), gen_random_uuid(), (SELECT unit_1 FROM fx), (SELECT unit_1 FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('A1: anon convert_quantity expected 42883 undefined_function, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42883', 'A1: inventory_convert_quantity no longer exists for anon (dropped as dead code)');
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN
    PERFORM public.inventory_convert_quantity(
      (SELECT org FROM fx), gen_random_uuid(), (SELECT unit_1 FROM fx), (SELECT unit_1 FROM fx), 1
    );
    INSERT INTO test_log(line) SELECT fail('A2: authenticated convert_quantity expected 42883 undefined_function, call succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42883', 'A2: inventory_convert_quantity no longer exists for authenticated either (dropped as dead code, not merely re-gated)');
  END;
END $$;
RESET ROLE;

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'inventory_convert_quantity'),
  0::bigint,
  'A3: inventory_convert_quantity has zero rows in pg_proc -- fully removed, not just re-permissioned'
);

-- ===========================================================================
-- A4: inventory_get_or_create_balance_for_update -- authenticated direct
-- call denied, canonical caller still works, anon still denied (unchanged)
-- ===========================================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN
    PERFORM public.inventory_get_or_create_balance_for_update(
      (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT loc FROM fx), (SELECT variant_1 FROM fx),
      NULL, NULL, NULL
    );
    INSERT INTO test_log(line) SELECT fail('B1: authenticated direct call to the internal balance-lock helper expected 42501, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'B1: authenticated can no longer directly call inventory_get_or_create_balance_for_update (A4 REVOKE)');
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.inventory_get_or_create_balance_for_update(
      (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT loc FROM fx), (SELECT variant_1 FROM fx),
      NULL, NULL, NULL
    );
    INSERT INTO test_log(line) SELECT fail('B2: anon direct call to the internal balance-lock helper expected 42501, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'B2: anon was already denied pre-pass and remains denied (unaffected by this pass, re-confirmed)');
  END;
END $$;
RESET ROLE;

-- B3: a representative canonical caller (inventory_create_reservation,
-- SECURITY DEFINER owned by postgres, nests a call to the now-restricted
-- helper) still succeeds end-to-end for a real, permissioned authenticated
-- user -- proving same-owner nesting is genuinely unaffected by the REVOKE.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT public.inventory_create_reservation(
    (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object(
      'variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx),
      'location_id', (SELECT loc FROM fx), 'quantity', 5
    )),
    'generic', NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
  ) INTO v_result;
  INSERT INTO test_log(line) SELECT is(
    (v_result ->> 'status'), 'active',
    'B3: canonical caller inventory_create_reservation still succeeds end-to-end after A4 REVOKE (same-owner nesting unaffected)'
  );
END $$;
RESET ROLE;

INSERT INTO test_log(line) SELECT is(
  (SELECT count(*) FROM pg_proc WHERE proname = 'inventory_get_or_create_balance_for_update'),
  1::bigint,
  'B4: inventory_get_or_create_balance_for_update still has exactly 1 overload -- grant-only change, function itself untouched'
);

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
