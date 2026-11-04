-- ============================================================================
-- Demo reset: also the "Ambra – testy" organization
-- ============================================================================
-- admin_reset_demo_org_data and its helper admin_reset_demo_qr_assignments
-- were locked to the presentation demo organization only. The test
-- organization "Ambra – testy" (50dc463a-…) is now where Ambra is tried out,
-- so it may be reset the same way. Every other organization stays refused.
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
    CONTINUE WHEN position('50dc463a-0164-4ccb-b9aa-5e5511975bb9' IN v_def) > 0;  -- already applied
    v_new := replace(v_def,
      $a$IF p_org IS DISTINCT FROM '2c5aa49a-cc3d-4166-8c5f-f6c94307103f'::uuid THEN$a$,
      $b$IF p_org IS NULL OR p_org NOT IN (
       '2c5aa49a-cc3d-4166-8c5f-f6c94307103f'::uuid,  -- presentation demo (CNP)
       '50dc463a-0164-4ccb-b9aa-5e5511975bb9'::uuid   -- Ambra – testy
     ) THEN$b$);
    IF v_new = v_def THEN
      RAISE EXCEPTION '% patch did not apply', v_fn;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$do$;
