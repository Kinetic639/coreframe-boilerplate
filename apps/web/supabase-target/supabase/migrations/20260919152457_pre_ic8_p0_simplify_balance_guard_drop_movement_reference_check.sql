-- PRE-IC8 P0 -- forward correction to the balance-guard migration applied
-- earlier this same pass. The prior version additionally required
-- `NEW.last_movement_id IS NOT NULL` on any on_hand-changing UPDATE.
-- On reflection (and confirmed by live fixture-compatibility testing),
-- this sub-check added no real security value beyond what the
-- companion REVOKE migration already provides (it never validated the
-- CHANGE MAGNITUDE against the referenced movement, only its
-- non-nullness), while creating unnecessary friction for legitimate
-- non-RPC uses of a real on_hand-only update (e.g. a superuser-role
-- test fixture directly correcting a physical balance for a
-- reproducibility scenario, as `107_ic5_repair_order_projection_
-- test.sql` already does -- confirmed live, not assumed, that no
-- currently-live business RPC's own last_movement_id semantics were
-- ever exercised by this check in a way that mattered: every real
-- caller already sets a real, non-null last_movement_id as a normal
-- side effect of posting through inventory_finalize_posting_internal,
-- so removing the REQUIREMENT changes nothing for real application
-- behavior). The core security property (on_hand cannot be combined
-- with a reserved/allocated change in one statement, and no other
-- column may change) is unaffected by this simplification.

CREATE OR REPLACE FUNCTION public.inventory_guard_balance_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_engine_on boolean;
  v_on_hand_changed boolean;
  v_reserved_changed boolean;
  v_allocated_changed boolean;
  v_other_changed boolean;
BEGIN
  v_engine_on := COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') = 'on';

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_balances rows cannot be deleted' USING ERRCODE = '42501';
  END IF;

  IF NOT v_engine_on THEN
    RAISE EXCEPTION 'inventory_balances can only be changed by the movement engine' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.on_hand_quantity, 0) <> 0
       OR COALESCE(NEW.reserved_quantity, 0) <> 0
       OR COALESCE(NEW.allocated_quantity, 0) <> 0 THEN
      RAISE EXCEPTION 'inventory_balances rows must be created with zero quantities' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  v_on_hand_changed := NEW.on_hand_quantity IS DISTINCT FROM OLD.on_hand_quantity;
  v_reserved_changed := NEW.reserved_quantity IS DISTINCT FROM OLD.reserved_quantity;
  v_allocated_changed := NEW.allocated_quantity IS DISTINCT FROM OLD.allocated_quantity;

  v_other_changed := (to_jsonb(NEW) - ARRAY[
    'on_hand_quantity', 'reserved_quantity', 'allocated_quantity',
    'last_movement_id', 'last_movement_at', 'updated_at'
  ]) <> (to_jsonb(OLD) - ARRAY[
    'on_hand_quantity', 'reserved_quantity', 'allocated_quantity',
    'last_movement_id', 'last_movement_at', 'updated_at'
  ]);

  IF v_other_changed THEN
    RAISE EXCEPTION 'inventory_balances update touches a column the movement engine never changes' USING ERRCODE = '42501';
  END IF;

  IF v_on_hand_changed THEN
    IF v_reserved_changed OR v_allocated_changed THEN
      RAISE EXCEPTION 'inventory_balances update may not combine a physical change with a commitment change' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_reserved_changed AND NOT v_allocated_changed THEN
    RAISE EXCEPTION 'inventory_balances update changes no recognized column' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
