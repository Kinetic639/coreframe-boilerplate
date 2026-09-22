-- ============================================================================
-- TEST: PRE-IC8 P0 -- balance/settings GUC authorization bypass closure
-- ============================================================================
-- Closes a CRITICAL, live, currently-exploitable gap the architecture-
-- compression review found and the user confirmed must be closed before
-- IC-8: `inventory_guard_balance_write()`/`inventory_guard_settings_
-- write()` trusted the caller-settable session GUC
-- `ambra.inventory_movement_engine = 'on'` as SUFFICIENT authorization,
-- with no substance/delta validation -- meaning any ordinary operate-
-- permissioned authenticated user could deliberately set the GUC and
-- then raw-write `inventory_balances`/`inventory_settings` directly,
-- bypassing the canonical engine, ledger, audit log, and every IC-1
-- invariant. This directly contradicted the frozen "raw writes are
-- closed" invariant.
--
-- FINAL DESIGN (2 layers):
--   1. STRUCTURAL (the real security boundary): `authenticated`/`anon`
--      no longer hold raw INSERT/UPDATE/DELETE table privileges on
--      either table at all -- Postgres checks base table grants BEFORE
--      RLS and BEFORE any trigger fires, so this closes the exploit
--      regardless of GUC state. Every legitimate writer is a
--      `SECURITY DEFINER` function owned by `postgres` (or same-owner-
--      nested from one), so none are affected.
--   2. SUBSTANCE VALIDATION (defense-in-depth, protects against a
--      hypothetical future bug in already-trusted `SECURITY DEFINER`
--      code, which DOES still reach these triggers running as
--      `postgres`): the balance guard now validates the exact
--      column-delta shape against the 2 legitimate transitions
--      (physical-only, or commitment-only); the settings guard now
--      distinguishes real settings-manager writes (any column) from
--      engine-only writes (numbering counters ONLY), never trusting
--      the GUC alone for either table.
--
-- EXPLICIT PRODUCT DECISION (asked and confirmed): `apps/public-web`'s
-- own still-live container feature (a fork of functions IC-6 already
-- confirmed dead and removed from `apps/web`'s copy) writes
-- `inventory_balances.allocated_quantity` directly, outside any RPC.
-- This is now closed too, by design -- that feature is expected to
-- break until migrated to a canonical RPC (separate, future work).
--
-- Executed live against supabase-target via Supabase MCP.

BEGIN;

SELECT plan(20);

CREATE TEMP TABLE fx (
  org uuid, branch uuid, loc_a uuid, loc_b uuid,
  variant_1 uuid, unit_1 uuid,
  e2e_user uuid, no_perm_user uuid
);
GRANT SELECT ON fx TO authenticated;
INSERT INTO fx SELECT
  '9f98fe91-63b8-4986-a2b3-65bdd47684c9'::uuid,
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  'fe364ce2-1f72-4df5-ab92-6361ec95e0da'::uuid,
  '571dfd6c-eba2-42c2-8ad9-f39a2d103b6d'::uuid,
  'c4a24371-42db-4bb8-ab5e-379ebbf7d9c4'::uuid,
  gen_random_uuid();

CREATE TEMP TABLE test_log (seq serial, line text);
GRANT INSERT, SELECT ON test_log TO authenticated;
GRANT USAGE ON SEQUENCE test_log_seq_seq TO authenticated;

INSERT INTO branches (id, organization_id, name, branch_number)
SELECT branch, org, '112-pre-ic8-p0-branch', 850 FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory, purpose)
SELECT loc_a, org, branch, '112-loc-a-receiving', true, 'receiving' FROM fx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT loc_b, org, branch, '112-loc-b', true FROM fx;

-- Seed a real balance row through the canonical get-or-create shape
-- (zero-quantity insert), then a real receipt to give it real on_hand
-- stock to test against.
SET LOCAL ambra.inventory_movement_engine = 'on';
INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
SELECT org, branch, loc_a, variant_1, 0, 0, 0 FROM fx
ON CONFLICT (organization_id, branch_id, location_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(serial_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO NOTHING;

-- Strip warehouse.settings.manage from e2e_user for the adversarial
-- settings scenarios below (they already hold it natively; the exact
-- row is saved and restored later in this same transaction for the
-- legitimate-settings-manager scenario -- the whole file rolls back
-- regardless).
CREATE TEMP TABLE saved_settings_manage_row AS
SELECT * FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact = 'warehouse.settings.manage';
DELETE FROM user_effective_permissions
WHERE user_id = (SELECT e2e_user FROM fx) AND organization_id = (SELECT org FROM fx)
  AND permission_slug_exact = 'warehouse.settings.manage';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

-- A real receipt via the canonical engine, establishing real on_hand
-- stock to attack in the adversarial scenarios below.
SELECT inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 50, 'destination_location_id', (SELECT loc_a FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
);

CREATE TEMP TABLE bal AS
SELECT id, on_hand_quantity FROM inventory_balances
WHERE organization_id = (SELECT org FROM fx) AND branch_id = (SELECT branch FROM fx)
  AND location_id = (SELECT loc_a FROM fx) AND variant_id = (SELECT variant_1 FROM fx);
GRANT SELECT ON bal TO authenticated;
INSERT INTO test_log(line) SELECT is(on_hand_quantity, 50::numeric, '0: real receipt establishes on_hand=50 (setup, not a scored scenario)') FROM bal;

-- ===========================================================================
-- ADVERSARIAL: self-set GUC, ordinary operate-permissioned user (e2e_user,
-- real, no settings.manage at this point) -- all must remain denied.
-- ===========================================================================
SELECT set_config('ambra.inventory_movement_engine', 'on', true);

DO $$
BEGIN
  BEGIN
    UPDATE inventory_balances SET on_hand_quantity = 999999 WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('A: raw on_hand UPDATE after self-setting GUC expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'A: self-set GUC cannot change on_hand_quantity');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE inventory_balances SET reserved_quantity = 999999 WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('B: raw reserved UPDATE after self-setting GUC expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'B: self-set GUC cannot change reserved_quantity arbitrarily');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE inventory_balances SET allocated_quantity = 999999 WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('C: raw allocated UPDATE after self-setting GUC expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'C: self-set GUC cannot change allocated_quantity arbitrarily');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE inventory_balances SET on_hand_quantity = 999999, reserved_quantity = 999999, allocated_quantity = 999999 WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('D: raw multi-quantity UPDATE after self-setting GUC expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'D: self-set GUC cannot change multiple quantities arbitrarily');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_balances (organization_id, branch_id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity)
    SELECT org, branch, loc_b, variant_1, 500, 0, 0 FROM fx;
    INSERT INTO test_log(line) SELECT fail('E: fabricated non-zero balance INSERT expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'E: self-set GUC cannot INSERT a fabricated non-zero balance row');
  END;
END $$;

DO $$
BEGIN
  BEGIN
    DELETE FROM inventory_balances WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('F: balance DELETE expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'F: a balance row cannot be deleted, even with the GUC set');
  END;
END $$;

-- ===========================================================================
-- SETTINGS: adversarial (operator, no settings.manage) then legitimate
-- (real settings manager).
-- ===========================================================================
CREATE TEMP TABLE settings_before AS SELECT allow_negative_stock FROM inventory_settings WHERE organization_id = (SELECT org FROM fx);
GRANT SELECT ON settings_before TO authenticated;

DO $$
BEGIN
  BEGIN
    UPDATE inventory_settings SET allow_negative_stock = NOT (SELECT allow_negative_stock FROM settings_before) WHERE organization_id = (SELECT org FROM fx);
    INSERT INTO test_log(line) SELECT fail('G: operator (no settings.manage) self-set GUC editing user-managed setting expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'G: self-set GUC cannot let an ordinary operator edit a user-managed setting');
  END;
END $$;

RESET ROLE;
-- Restore the exact saved row (it was only stripped for the scenario
-- above -- transaction-scoped, would roll back anyway).
INSERT INTO user_effective_permissions SELECT * FROM saved_settings_manage_row;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

DO $$
DECLARE v_after boolean;
BEGIN
  UPDATE inventory_settings SET allow_negative_stock = NOT (SELECT allow_negative_stock FROM settings_before) WHERE organization_id = (SELECT org FROM fx);
  SELECT allow_negative_stock INTO v_after FROM inventory_settings WHERE organization_id = (SELECT org FROM fx);
  INSERT INTO test_log(line) SELECT is(v_after, NOT (SELECT allow_negative_stock FROM settings_before), 'H: a real settings manager can still edit a user-managed setting through the accepted path');
END $$;

-- ===========================================================================
-- LEGITIMATE CANONICAL WRITERS -- all must still succeed end to end.
-- ===========================================================================

-- I: generic issue (decrease, type 402) succeeds.
DO $$
DECLARE v_before numeric; v_after numeric;
BEGIN
  SELECT on_hand_quantity INTO v_before FROM inventory_balances WHERE id = (SELECT id FROM bal);
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '402',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5, 'source_location_id', (SELECT loc_a FROM fx))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
  );
  SELECT on_hand_quantity INTO v_after FROM inventory_balances WHERE id = (SELECT id FROM bal);
  INSERT INTO test_log(line) SELECT is(v_after, v_before - 5, 'I: legitimate generic issue (type 402) succeeds, on_hand decreases by 5');
END $$;

-- J: relocation (type 801) succeeds.
DO $$
DECLARE v_before numeric; v_dest_after numeric;
BEGIN
  SELECT on_hand_quantity INTO v_before FROM inventory_balances WHERE id = (SELECT id FROM bal);
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '801',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 5, 'source_location_id', (SELECT loc_a FROM fx), 'destination_location_id', (SELECT loc_b FROM fx))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
  );
  SELECT on_hand_quantity INTO v_dest_after FROM inventory_balances WHERE organization_id=(SELECT org FROM fx) AND branch_id=(SELECT branch FROM fx) AND location_id=(SELECT loc_b FROM fx) AND variant_id=(SELECT variant_1 FROM fx);
  INSERT INTO test_log(line) SELECT is(v_dest_after, 5::numeric, 'J: legitimate relocation (type 801) succeeds, destination on_hand=5');
END $$;

-- K/L: reservation create + release succeed.
CREATE TEMP TABLE resv AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 10)),
  'test', gen_random_uuid(), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'K: legitimate reservation create succeeds') FROM resv;

DO $$
DECLARE v_reserved numeric;
BEGIN
  PERFORM inventory_release_reservation(((SELECT result FROM resv) ->> 'reservation_id')::uuid, (SELECT e2e_user FROM fx), true);
  SELECT reserved_quantity INTO v_reserved FROM inventory_balances WHERE id = (SELECT id FROM bal);
  INSERT INTO test_log(line) SELECT is(v_reserved, 0::numeric, 'L: legitimate reservation release succeeds, reserved back to 0');
END $$;

-- M/N: allocation create + release succeed.
CREATE TEMP TABLE resv2 AS
SELECT (inventory_create_reservation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 8)),
  'test', gen_random_uuid(), null, null, null, (SELECT e2e_user FROM fx)
)) AS result;
CREATE TEMP TABLE resvline2 AS
SELECT id FROM inventory_reservation_lines WHERE reservation_id = ((SELECT result FROM resv2) ->> 'reservation_id')::uuid;

CREATE TEMP TABLE alloc AS
SELECT (inventory_create_allocation(
  (SELECT org FROM fx), (SELECT branch FROM fx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 8, 'reservation_line_id', (SELECT id FROM resvline2))),
  ((SELECT result FROM resv2) ->> 'reservation_id')::uuid, 'test', gen_random_uuid(), null, (SELECT e2e_user FROM fx)
)) AS result;
INSERT INTO test_log(line) SELECT is((result ->> 'status'), 'active', 'M: legitimate allocation create succeeds') FROM alloc;

DO $$
DECLARE v_allocated numeric;
BEGIN
  PERFORM inventory_release_allocation(((SELECT result FROM alloc) ->> 'allocation_id')::uuid, (SELECT e2e_user FROM fx));
  SELECT allocated_quantity INTO v_allocated FROM inventory_balances WHERE id = (SELECT id FROM bal);
  INSERT INTO test_log(line) SELECT is(v_allocated, 0::numeric, 'N: legitimate allocation release succeeds, allocated back to 0');
END $$;

-- O: opening-stock-style 401 (destination-only increase) succeeds.
DO $$
DECLARE v_before numeric; v_after numeric;
BEGIN
  SELECT on_hand_quantity INTO v_before FROM inventory_balances WHERE id = (SELECT id FROM bal);
  PERFORM inventory_create_and_finalize(
    (SELECT org FROM fx), (SELECT branch FROM fx), '401',
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 3, 'destination_location_id', (SELECT loc_a FROM fx))),
    NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
  );
  SELECT on_hand_quantity INTO v_after FROM inventory_balances WHERE id = (SELECT id FROM bal);
  INSERT INTO test_log(line) SELECT is(v_after, v_before + 3, 'O: legitimate opening-stock-style 401 (destination-only increase) succeeds');
END $$;

-- P: transfer send succeeds (create -> send lifecycle).
CREATE TEMP TABLE xferfx (dst_branch uuid, dst_loc uuid);
INSERT INTO xferfx SELECT gen_random_uuid(), gen_random_uuid();
RESET ROLE;
INSERT INTO branches (id, organization_id, name, branch_number)
SELECT dst_branch, (SELECT org FROM fx), '112-xfer-dst-branch', 851 FROM xferfx;
INSERT INTO warehouse_locations (id, organization_id, branch_id, name, can_store_inventory)
SELECT dst_loc, (SELECT org FROM fx), dst_branch, '112-xfer-dst-loc', true FROM xferfx;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT e2e_user FROM fx)::text, 'role', 'authenticated')::text, true);

CREATE TEMP TABLE xfer AS
SELECT (inventory_create_branch_transfer(
  (SELECT org FROM fx), (SELECT branch FROM fx), (SELECT dst_branch FROM xferfx),
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'source_location_id', (SELECT loc_a FROM fx), 'lot_id', NULL, 'serial_id', NULL, 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 4)),
  'scenario P', (SELECT e2e_user FROM fx)
)) AS result;

DO $$
DECLARE v_before numeric; v_after numeric;
BEGIN
  SELECT on_hand_quantity INTO v_before FROM inventory_balances WHERE id = (SELECT id FROM bal);
  PERFORM inventory_send_branch_transfer(((SELECT result FROM xfer) ->> 'transfer_id')::uuid, (SELECT e2e_user FROM fx));
  SELECT on_hand_quantity INTO v_after FROM inventory_balances WHERE id = (SELECT id FROM bal);
  INSERT INTO test_log(line) SELECT is(v_after, v_before - 4, 'P: legitimate branch-transfer send succeeds, source on_hand decreases by 4');
END $$;

-- Q: reversal succeeds. Uses a SEPARATE, dedicated 20-unit receipt at
-- loc_b (untouched by any other scenario in this file) rather than the
-- original 50-unit receipt, which by this point has been partially
-- consumed by scenarios I/J/O/P -- reversing it here would correctly
-- trip IC-1's own P0003 strand check (self-caught during live testing,
-- same class of test-design issue already documented in 110's own
-- Scenario C fix during IC-7).
CREATE TEMP TABLE q_receipt AS
SELECT (inventory_create_and_finalize(
  (SELECT org FROM fx), (SELECT branch FROM fx), '101',
  jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', 20, 'destination_location_id', (SELECT loc_b FROM fx))),
  NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
)) AS result;
CREATE TEMP TABLE orig_movement AS
SELECT ((SELECT result FROM q_receipt) ->> 'movement_id')::uuid AS id;

DO $$
DECLARE v_status text;
BEGIN
  PERFORM inventory_reverse_movement((SELECT id FROM orig_movement), (SELECT e2e_user FROM fx), 'test reversal');
  SELECT status INTO v_status FROM inventory_movement_headers WHERE id = (SELECT id FROM orig_movement);
  INSERT INTO test_log(line) SELECT is(v_status, 'reversed', 'Q: legitimate reversal succeeds, original movement status=reversed');
END $$;

-- ===========================================================================
-- IC-1 INVARIANT REMAINS ENFORCED
-- ===========================================================================

-- R: raw attempt to strand committed stock (drop on_hand below the
-- committed total) remains denied -- cannot be bypassed by GUC self-set.
DO $$
DECLARE v_reserved numeric; v_allocated numeric;
BEGIN
  -- Create a fresh, deterministic commitment so we know the exact floor.
  PERFORM inventory_create_reservation(
    (SELECT org FROM fx), (SELECT branch FROM fx),
    jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'location_id', (SELECT loc_a FROM fx), 'quantity', 2)),
    'test', gen_random_uuid(), null, null, null, (SELECT e2e_user FROM fx)
  );
  SELECT reserved_quantity, allocated_quantity INTO v_reserved, v_allocated FROM inventory_balances WHERE id = (SELECT id FROM bal);

  BEGIN
    UPDATE inventory_balances SET on_hand_quantity = 0 WHERE id = (SELECT id FROM bal);
    INSERT INTO test_log(line) SELECT fail('R: raw UPDATE stranding committed stock expected denial, succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, '42501', 'R: raw balance write remains denied even when it would strand committed stock (closed at the guard layer before IC-1''s own P0003 is ever reached)');
  END;
END $$;

-- S: the canonical engine itself still raises the same IC-1 P0003 when a
-- legitimate posting attempt would strand committed stock (unchanged
-- behavior, re-confirmed after this pass's own guard changes).
DO $$
DECLARE v_onhand numeric;
BEGIN
  SELECT on_hand_quantity INTO v_onhand FROM inventory_balances WHERE id = (SELECT id FROM bal);
  BEGIN
    PERFORM inventory_create_and_finalize(
      (SELECT org FROM fx), (SELECT branch FROM fx), '402',
      jsonb_build_array(jsonb_build_object('variant_id', (SELECT variant_1 FROM fx), 'unit_id', (SELECT unit_1 FROM fx), 'quantity', v_onhand, 'source_location_id', (SELECT loc_a FROM fx))),
      NULL, NULL, NULL, NULL, NULL, NULL, (SELECT e2e_user FROM fx)
    );
    INSERT INTO test_log(line) SELECT fail('S: expected P0003 (would strand committed stock), canonical posting succeeded instead');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_log(line) SELECT is(SQLSTATE, 'P0003', 'S: canonical engine still raises IC-1''s own P0003 when a legitimate posting would strand committed stock -- unchanged by this pass');
  END;
END $$;

RESET ROLE;

SELECT line FROM test_log ORDER BY seq;

ROLLBACK;
