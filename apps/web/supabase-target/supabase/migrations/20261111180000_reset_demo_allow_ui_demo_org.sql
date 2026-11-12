-- ============================================================================
-- Demo reset: also the "Ambra – UI demo" organization
-- ============================================================================
-- admin_reset_demo_org_data and admin_reset_demo_qr_assignments accept the
-- presentation demo (CNP), "Ambra – testy" and now "Ambra – UI demo"
-- (becca51f-…), the organization for UI tools to test in.
-- ============================================================================

DO $do$
DECLARE
  v_fn regprocedure;
  v_def text;
  v_new text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.admin_reset_demo_org_data(uuid)'::regprocedure,
    'public.admin_reset_demo_qr_assignments(uuid)'::regprocedure
  ] LOOP
    v_def := pg_get_functiondef(v_fn);
    CONTINUE WHEN position('becca51f-ab84-40cd-807f-d8a9dcff27b1' IN v_def) > 0;  -- already applied
    v_new := replace(v_def,
      $a$'50dc463a-0164-4ccb-b9aa-5e5511975bb9'::uuid   -- Ambra – testy$a$,
      $b$'50dc463a-0164-4ccb-b9aa-5e5511975bb9'::uuid,  -- Ambra – testy
       'becca51f-ab84-40cd-807f-d8a9dcff27b1'::uuid   -- Ambra – UI demo$b$);
    IF v_new = v_def THEN
      RAISE EXCEPTION '% patch did not apply', v_fn;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$do$;
