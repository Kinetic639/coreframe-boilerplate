-- PRE-IC8 P0 -- forward correction. Self-caught bug in the balance guard
-- applied earlier this same pass: `available_quantity` is a Postgres
-- GENERATED ALWAYS column (`on_hand_quantity - reserved_quantity -
-- allocated_quantity`) that automatically changes its own value
-- whenever any of those 3 base columns change -- it was NOT included in
-- the "no other column may change" exclusion list, so the very first
-- live test of a legitimate on_hand-changing UPDATE (via
-- inventory_finalize_posting_internal) was incorrectly rejected. Live-
-- caught by testing the full legitimate-writer suite before considering
-- the fix complete, exactly the discipline this project has followed
-- throughout. No other logic changes.

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
