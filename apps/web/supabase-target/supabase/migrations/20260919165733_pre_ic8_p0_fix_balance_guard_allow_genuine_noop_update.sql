-- PRE-IC8 P0 -- forward correction, self-caught by the full 097-112
-- regression run. The balance guard's final "changes no recognized
-- column" rejection incorrectly fired for a genuine NO-OP UPDATE (all
-- of on_hand/reserved/allocated set to their own current value, e.g. a
-- fixture's `SET reserved_quantity = 0, allocated_quantity = 0` when
-- both are already 0 -- the common/default case, including immediately
-- after a fresh zero-quantity INSERT). A true no-op cannot corrupt
-- anything regardless of shape -- it should be allowed, not treated as
-- a violation. Only a statement that actually CHANGES something without
-- matching a known-legitimate shape should be rejected. No other logic
-- changed; the "no other column may ever change" check and both real
-- transition-shape checks are unaffected.

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
    'available_quantity', 'last_movement_id', 'last_movement_at', 'updated_at'
  ]) <> (to_jsonb(OLD) - ARRAY[
    'on_hand_quantity', 'reserved_quantity', 'allocated_quantity',
    'available_quantity', 'last_movement_id', 'last_movement_at', 'updated_at'
  ]);

  IF v_other_changed THEN
    RAISE EXCEPTION 'inventory_balances update touches a column the movement engine never changes' USING ERRCODE = '42501';
  END IF;

  -- A genuine no-op (nothing in on_hand/reserved/allocated actually
  -- changed value) is harmless regardless of shape -- allow it rather
  -- than rejecting it as an unrecognized transition.
  IF NOT v_on_hand_changed AND NOT v_reserved_changed AND NOT v_allocated_changed THEN
    RETURN NEW;
  END IF;

  IF v_on_hand_changed THEN
    IF v_reserved_changed OR v_allocated_changed THEN
      RAISE EXCEPTION 'inventory_balances update may not combine a physical change with a commitment change' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Reached only if reserved and/or allocated actually changed (on_hand did not).
  RETURN NEW;
END;
$function$;
