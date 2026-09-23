-- PRE-IC8 P0 -- defense-in-depth redesign of inventory_guard_settings_
-- write(). As with the balance guard, the REVOKE in the companion
-- migration is the real security boundary; this redesign additionally
-- ensures that even a caller reaching this trigger with the GUC set
-- (e.g. a future SECURITY DEFINER function with a bug) can NEVER touch
-- a user-managed settings column merely by setting the GUC -- only the
-- exact internal numbering-counter columns every live engine RPC
-- actually touches.
--
-- Column ownership classification, derived from a live, exhaustive
-- prosrc search across every function that UPDATEs inventory_settings
-- (not from function names or assumptions):
--   SYSTEM-MANAGED COUNTERS (may change via the engine-GUC path):
--     reservation_number_next (inventory_create_reservation),
--     allocation_number_next (inventory_create_allocation),
--     purchase_order_number_next (inventory_create_purchase_order),
--     branch_transfer_number_next (inventory_create_branch_transfer),
--     draft_number_next (inventory_create_draft), sku_next (inventory_
--     create_product_with_default_variant) -- plus updated_by/
--     updated_at, touched alongside every one of the above.
--   USER-MANAGED (requires warehouse.settings.manage; not currently
--     writable by ANY live function -- zero direct TypeScript writers
--     found this pass, live-verified by full-repo grep -- but the
--     column-ownership contract is enforced regardless, for whenever a
--     settings-management UI is built): allow_negative_stock,
--     default_currency, cost_method, rounding_precision, sku_generation_
--     enabled, sku_prefix, expiry_enforcement_enabled, reservation_
--     number_prefix, allocation_number_prefix, purchase_order_number_
--     prefix, sku_pattern, sku_sequence_padding, low_stock_threshold,
--     overstock_threshold, branch_transfer_number_prefix, draft_number_
--     prefix.
--   IMMUTABLE/OTHER (never legitimately changes after creation):
--     id, organization_id, created_by, created_at, deleted_at.
--
-- A real settings-manager caller (has_permission(org, 'warehouse.
-- settings.manage')) retains full write authority over any column, as
-- before -- this migration does not make inventory_settings more
-- restrictive for that caller, only closes the non-manager engine-GUC
-- bypass.

CREATE OR REPLACE FUNCTION public.inventory_guard_settings_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_other_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_settings rows cannot be deleted' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF public.has_permission(NEW.organization_id, 'warehouse.settings.manage') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(current_setting('ambra.inventory_movement_engine', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'inventory_settings can only be updated by settings managers or the inventory engine' USING ERRCODE = '42501';
  END IF;

  v_other_changed := (to_jsonb(NEW) - ARRAY[
    'reservation_number_next', 'allocation_number_next', 'purchase_order_number_next',
    'branch_transfer_number_next', 'draft_number_next', 'sku_next',
    'updated_by', 'updated_at'
  ]) <> (to_jsonb(OLD) - ARRAY[
    'reservation_number_next', 'allocation_number_next', 'purchase_order_number_next',
    'branch_transfer_number_next', 'draft_number_next', 'sku_next',
    'updated_by', 'updated_at'
  ]);

  IF v_other_changed THEN
    RAISE EXCEPTION 'inventory_settings engine updates may only change numbering counters, not user-managed settings' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
