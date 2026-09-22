-- IC-7 CRITICAL FIX -- the posted-movement immutability trigger only ever
-- checked that the session GUC ambra.inventory_movement_engine='on' --
-- never WHICH columns changed, never WHO the caller is. Any authenticated
-- actor holding warehouse.inventory.operate/.adjust/.reverse could set
-- that ordinary, caller-settable session GUC themselves and then raw-
-- UPDATE ANY column (document_number, movement_type_code, quantities,
-- organization_id, etc.) of ANY posted header. This has been a known,
-- disclosed, pre-existing gap since before IC-2 (see inventory-core-
-- architecture.md §9's own row for inventory_movement_headers/_lines).
--
-- Fix: the GUC is REMOVED ENTIRELY as an authorization signal for this
-- trigger (a caller-settable GUC is never a security boundary -- IC-7's
-- own explicit instruction). Authorization is now based purely on the
-- SUBSTANCE of the change: once a header is posted/cancelled/reversed,
-- the ONLY value-changing transition ever permitted is EXACTLY the
-- accepted reversal lifecycle (status posted->reversed, reversal_
-- movement_id/reversed_by/reversed_at going from NULL to real values,
-- every other column byte-identical to OLD) AND the new reversal_
-- movement_id must genuinely double-link back to a real row that (a)
-- actually has original_movement_id = this row's own id, and (b) is
-- movement_type_code = '900' (the system reversal type, which cannot be
-- manually created -- inventory_create_draft rejects allows_manual_
-- entry=false types, IC-7A's own closed contract). Since a '900'-type
-- row with the correct original_movement_id linkage can only ever exist
-- as a byproduct of inventory_reverse_movement's own real work (verified
-- live against its current body: it INSERTs the reversal row FIRST, with
-- original_movement_id already set, then finalizes it, THEN performs
-- this exact narrow UPDATE on the original -- in that order, in the same
-- transaction), this closes the forgery surface completely: an attacker
-- can no longer even forge a FAKE "already reversed" state pointing at an
-- arbitrary/unrelated movement id.
--
-- The full-row-equality check uses to_jsonb(NEW)/to_jsonb(OLD) minus the
-- allowed-to-change key set, rather than hand-enumerating all 40 columns
-- of inventory_movement_headers -- this is robust against future column
-- additions (a new column is automatically protected, never silently
-- exempted) and was checked against the table's own live column list
-- before being written.
CREATE OR REPLACE FUNCTION public.inventory_prevent_header_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'cancelled', 'reversed') THEN
      RAISE EXCEPTION 'Cannot delete a finalized movement (status=%)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('posted', 'cancelled', 'reversed') THEN
    IF NOT (
      OLD.status = 'posted'
      AND NEW.status = 'reversed'
      AND OLD.reversal_movement_id IS NULL
      AND NEW.reversal_movement_id IS NOT NULL
      AND NEW.reversed_by IS NOT NULL
      AND NEW.reversed_at IS NOT NULL
      AND (to_jsonb(NEW) - ARRAY['status', 'reversal_movement_id', 'reversed_by', 'reversed_at', 'updated_at'])
          = (to_jsonb(OLD) - ARRAY['status', 'reversal_movement_id', 'reversed_by', 'reversed_at', 'updated_at'])
      AND EXISTS (
        SELECT 1 FROM inventory_movement_headers r
        WHERE r.id = NEW.reversal_movement_id
          AND r.original_movement_id = OLD.id
          AND r.movement_type_code = '900'
      )
    ) THEN
      RAISE EXCEPTION 'Cannot modify a finalized movement (status=%) -- only the reversal lifecycle transition is permitted', OLD.status
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- inventory_movement_lines: NO legitimate write path EVER updates or
-- deletes an existing line once its own header is posted/cancelled/
-- reversed (inventory_reverse_movement only INSERTs new lines into a
-- brand-new reversal movement; the finalize-time snapshot-freezing UPDATE
-- happens while the header is still 'draft', confirmed live against
-- inventory_finalize_posting_internal's own body). The GUC-gated
-- exception is therefore removed entirely -- unconditional denial.
CREATE OR REPLACE FUNCTION public.inventory_prevent_line_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM inventory_movement_headers
  WHERE id = OLD.movement_id;

  IF v_status IN ('posted', 'cancelled', 'reversed') THEN
    RAISE EXCEPTION 'Cannot modify or delete lines of a finalized movement (status=%)', v_status
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
