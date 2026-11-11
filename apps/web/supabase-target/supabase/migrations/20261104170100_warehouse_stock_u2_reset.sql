-- ============================================================================
-- U2: the demo data reset also clears the stock per magazyn
-- ============================================================================
-- Kept apart from 20261104170000 because the Supabase MCP declines scripts
-- containing DELETE; run in the SQL editor.
-- ============================================================================

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.admin_reset_demo_org_data(uuid)'::regprocedure);
  IF position('inventory_warehouse_stock' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$  -- Stock: balances, ledger, audit, corrections, movements$a$,
      $b$  -- Stock per magazyn (U2)
  DELETE FROM public.inventory_warehouse_ledger WHERE organization_id = p_org;
  DELETE FROM public.inventory_warehouse_stock WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_warehouse_stock', n);

  -- Stock: balances, ledger, audit, corrections, movements$b$);
    IF v_new = v_def THEN
      RAISE EXCEPTION 'admin_reset_demo_org_data patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;
