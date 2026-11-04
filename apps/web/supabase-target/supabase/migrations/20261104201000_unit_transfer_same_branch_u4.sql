-- ============================================================================
-- U4 fix: an MMJ within one branch passes the transfers' branch check
-- ============================================================================
-- inventory_branch_transfers had CHECK (source_branch_id <> destination_branch_id).
-- An MMJ between jednostki of one branch is allowed when it names both
-- magazyny, so:
--  1. the transfer row is inserted with its magazyny (the wrapper hands them
--     to inventory_create_branch_transfer for the insert), and
--  2. the check allows one branch when both magazyny are named
--     (20261104201100, run in the SQL editor: it drops the old constraint).
-- ============================================================================

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef(
    'public.inventory_create_branch_transfer(uuid,uuid,uuid,jsonb,text,uuid)'::regprocedure);
  IF position('ambra.unit_transfer_source_warehouse' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$    status,
    notes
  )
  VALUES ($a$,
      $b$    status,
    notes,
    source_warehouse_id,
    destination_warehouse_id
  )
  VALUES ($b$);
    v_new := replace(v_new,
      $a$    'prepared',
    p_notes
  )$a$,
      $b$    'prepared',
    p_notes,
    NULLIF(current_setting('ambra.unit_transfer_source_warehouse', true), '')::uuid,
    NULLIF(current_setting('ambra.unit_transfer_destination_warehouse', true), '')::uuid
  )$b$);
    IF position('ambra.unit_transfer_source_warehouse' IN v_new) = 0
       OR position(E'notes,\n    source_warehouse_id' IN v_new) = 0 THEN
      RAISE EXCEPTION 'inventory_create_branch_transfer patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;

  v_def := pg_get_functiondef(
    'public.inventory_create_unit_transfer(uuid,uuid,uuid,uuid,jsonb,text,uuid)'::regprocedure);
  IF position('ambra.unit_transfer_source_warehouse' IN v_def) = 0 THEN
    v_new := replace(v_def,
      $a$  PERFORM set_config('ambra.unit_transfer', 'on', true);$a$,
      $b$  PERFORM set_config('ambra.unit_transfer', 'on', true);
  PERFORM set_config('ambra.unit_transfer_source_warehouse', v_src.id::text, true);
  PERFORM set_config('ambra.unit_transfer_destination_warehouse', v_dst.id::text, true);$b$);
    v_new := replace(v_new,
      $a$  PERFORM set_config('ambra.unit_transfer', '', true);$a$,
      $b$  PERFORM set_config('ambra.unit_transfer', '', true);
  PERFORM set_config('ambra.unit_transfer_source_warehouse', '', true);
  PERFORM set_config('ambra.unit_transfer_destination_warehouse', '', true);$b$);
    IF position('ambra.unit_transfer_destination_warehouse' IN v_new) = 0 THEN
      RAISE EXCEPTION 'inventory_create_unit_transfer patch did not apply';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;
