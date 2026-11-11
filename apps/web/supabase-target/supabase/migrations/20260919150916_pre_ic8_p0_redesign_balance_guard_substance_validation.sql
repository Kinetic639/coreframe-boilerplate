-- PRE-IC8 P0 -- defense-in-depth redesign of inventory_guard_balance_
-- write(). The REVOKE in the companion migration is the actual security
-- boundary (an ordinary session can no longer reach this trigger at
-- all); this redesign protects against a hypothetical future bug in
-- already-trusted SECURITY DEFINER code (which DOES still reach this
-- trigger, running as postgres) by validating the SUBSTANCE of every
-- change against the exhaustive set of legitimate delta shapes, rather
-- than trusting `ambra.inventory_movement_engine = 'on'` alone -- the
-- exact GUC-as-authorization anti-pattern IC-7 already redesigned away
-- for the posted-header trigger. The GUC remains a NECESSARY
-- orchestration signal (every legitimate writer still sets it) but is
-- never SUFFICIENT on its own.
--
-- NOTE: this version's own shape-A check additionally required
-- `last_movement_id IS NOT NULL` -- corrected forward in a later
-- migration this same pass (`..._fix_balance_guard_exclude_generated_
-- column.sql`'s own sibling, `..._simplify_balance_guard_drop_movement_
-- reference_check.sql`) after live fixture-compatibility testing showed
-- this sub-check added no real security value beyond the REVOKE.

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
    IF NEW.last_movement_id IS NULL THEN
      RAISE EXCEPTION 'a physical balance change must reference the posting movement' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_reserved_changed AND NOT v_allocated_changed THEN
    RAISE EXCEPTION 'inventory_balances update changes no recognized column' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
