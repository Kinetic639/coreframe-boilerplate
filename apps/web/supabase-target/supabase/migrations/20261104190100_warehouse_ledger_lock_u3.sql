-- ============================================================================
-- U3: the history of stock per magazyn is append-only
-- ============================================================================
-- Like the stock ledger, inventory_warehouse_ledger cannot be updated or
-- deleted; the demo data reset switches the lock off for its run, as it does
-- for the other ledgers. Run in the SQL editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.inventory_warehouse_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION 'The magazyn stock history cannot be changed or removed' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE TRIGGER inventory_warehouse_ledger_no_modify
  BEFORE UPDATE OR DELETE ON public.inventory_warehouse_ledger
  FOR EACH ROW EXECUTE FUNCTION public.inventory_warehouse_ledger_append_only();

-- The demo reset is the one exception: it switches the lock off like the others.
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.admin_reset_demo_org_data(uuid)'::regprocedure);
  IF position('inventory_warehouse_ledger_no_modify' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$ALTER TABLE public.inventory_stock_ledger_entries DISABLE TRIGGER inventory_stock_ledger_no_modify;$a$,
      $b$ALTER TABLE public.inventory_stock_ledger_entries DISABLE TRIGGER inventory_stock_ledger_no_modify;
  ALTER TABLE public.inventory_warehouse_ledger DISABLE TRIGGER inventory_warehouse_ledger_no_modify;$b$);
    v_new := replace(v_new,
      $a$ALTER TABLE public.inventory_stock_ledger_entries ENABLE TRIGGER inventory_stock_ledger_no_modify;$a$,
      $b$ALTER TABLE public.inventory_stock_ledger_entries ENABLE TRIGGER inventory_stock_ledger_no_modify;
  ALTER TABLE public.inventory_warehouse_ledger ENABLE TRIGGER inventory_warehouse_ledger_no_modify;$b$);
    IF position('DISABLE TRIGGER inventory_warehouse_ledger_no_modify' IN v_new) = 0
       OR position('ENABLE TRIGGER inventory_warehouse_ledger_no_modify' IN v_new) = 0 THEN
      RAISE EXCEPTION 'admin_reset_demo_org_data patch did not apply cleanly';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;
