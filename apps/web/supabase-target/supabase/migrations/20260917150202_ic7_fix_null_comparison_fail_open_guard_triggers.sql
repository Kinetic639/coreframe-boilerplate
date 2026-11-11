-- IC-7 CRITICAL FIX -- systemic NULL-comparison fail-open bug. Both guard
-- triggers below used `current_setting('ambra.inventory_movement_engine',
-- true) <> 'on'` as their enforcement condition. When the GUC has never
-- been set at all in the current session (the ORDINARY DEFAULT STATE for
-- any raw client/PostgREST connection -- no GUC-setting trick needed),
-- current_setting(..., true) returns SQL NULL. `NULL <> 'on'` evaluates to
-- NULL, and PL/pgSQL's `IF NULL THEN ... END IF` treats NULL as FALSE --
-- so the RAISE EXCEPTION was silently skipped. The guard failed OPEN, not
-- closed. Live-reproduced before this fix: a raw UPDATE of inventory_
-- balances.on_hand_quantity by an ordinary authenticated actor holding
-- warehouse.inventory.operate succeeded with ZERO GUC manipulation at all
-- -- this is more severe than the already-known GUC-bypass-via-deliberate-
-- SET, since it required no special knowledge whatsoever. This is a
-- SEPARATE, more severe defect from the posted-header GUC bypass fixed in
-- 20260917150029 -- that fix removed the GUC as an authorization signal
-- entirely for movement headers/lines; this fix repairs the GUC-based
-- mechanism itself (COALESCE against NULL) for inventory_balances/
-- inventory_settings, where the mechanism's own design (block writes
-- unless a legitimate RPC has explicitly SET LOCAL ...='on') is correct
-- and sufficient -- it was only the NULL-comparison bug breaking it. Every
-- legitimate canonical RPC already explicitly sets this GUC to 'on' before
-- writing (confirmed live across inventory_finalize_posting_internal,
-- inventory_create_draft, and every other balance-touching primitive), so
-- this fix does not change legitimate behavior at all -- it only closes
-- the "never touch the GUC" bypass for illegitimate raw writes.
CREATE OR REPLACE FUNCTION public.inventory_guard_balance_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'inventory_balances can only be changed by the movement engine';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inventory_guard_settings_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') <> 'on'
     AND NOT public.has_permission(NEW.organization_id, 'warehouse.settings.manage') THEN
    RAISE EXCEPTION 'inventory_settings can only be updated by settings managers or inventory engines';
  END IF;
  RETURN NEW;
END;
$function$;
