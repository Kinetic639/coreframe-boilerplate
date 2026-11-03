-- ============================================================================
-- PZ from a Matcher session: a ZW line only partly for its repair order
-- ============================================================================
-- A ZW line delivered beyond what its repair order still needs is received
-- twice: the order's share (receipt row naming the repair-order line) and
-- the rest under the ZW alone (receipt row without one). Both rows have the
-- same ZW line, PZ line and relation, so the second broke the unique key.
-- inventory_attribute_receipt_to_repair_orders caught it per line, which
-- rolled the line back together with the repair order's REZ document made
-- for it, while the function kept that document's id: the next line of the
-- same order failed "Reservation not found" and the PZ could not be posted.
--
-- * The unique key of the receipt rows includes the repair-order line (NULL
--   counts as a value), so both shares fit.
-- * A unique violation caught for a line drops the REZ documents rolled back
--   with it, so later lines start new ones; only "already attributed" (the
--   repair-order link) is skipped that way, any other violation stops the
--   PZ with its real cause instead of leaving parts silently free.
-- ============================================================================

ALTER TABLE public.internal_order_line_movement_links
  DROP CONSTRAINT IF EXISTS internal_order_line_movement_links_unique;
ALTER TABLE public.internal_order_line_movement_links
  ADD CONSTRAINT internal_order_line_movement_links_unique
  UNIQUE NULLS NOT DISTINCT (internal_order_line_id, inventory_movement_line_id, relation_type, repair_order_line_id);

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.inventory_attribute_receipt_to_repair_orders(uuid,uuid,jsonb)'::regprocedure);
  IF position('v_constraint' IN v_def) > 0 THEN
    RETURN;
  END IF;

  v_new := replace(v_def,
    $a$  v_zw_docs jsonb := '{}'::jsonb;
BEGIN$a$,
    $b$  v_zw_docs jsonb := '{}'::jsonb;
  v_constraint text;
BEGIN$b$);

  v_new := replace(v_new,
    $a$    EXCEPTION WHEN unique_violation THEN
$a$,
    $b$    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      -- "Already attributed" comes from the repair-order link (raised by
      -- its writer, or its key); anything else is a real fault.
      IF COALESCE(v_constraint, '') NOT IN ('', 'repair_order_line_movement_links_unique') THEN
        RAISE;
      END IF;
      -- REZ documents made for this line were rolled back with it.
      v_docs := COALESCE((
        SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(v_docs) e
        WHERE EXISTS (SELECT 1 FROM public.inventory_reservations r WHERE r.id = (e.value->>'id')::uuid)
      ), '{}'::jsonb);
      v_zw_docs := COALESCE((
        SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(v_zw_docs) e
        WHERE EXISTS (SELECT 1 FROM public.inventory_reservations r WHERE r.id = (e.value->>'id')::uuid)
      ), '{}'::jsonb);
$b$);

  IF v_new = v_def OR position('v_constraint text;' IN v_new) = 0
     OR position('GET STACKED DIAGNOSTICS v_constraint' IN v_new) = 0 THEN
    RAISE EXCEPTION 'attribution patch did not apply';
  END IF;
  EXECUTE v_new;
END
$do$;
