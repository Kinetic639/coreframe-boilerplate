-- Demo QR reset: free the printed QR stickers for the next test run.
-- Not applied by MCP (DELETE): run it in the SQL editor.
--
-- 1. admin_reset_demo_qr_assignments(p_org): removes every QR assignment of the
--    demo organization except the ones to warehouse locations (containers,
--    tickets, tasks -- active and already revoked). QR codes themselves are
--    never touched, so printed labels stay valid and come back as free.
--    Usable on its own, without resetting the demo data.
-- 2. admin_reset_demo_org_data(p_org) calls it instead of only revoking the
--    container assignments. It never deleted QR codes and still does not.

CREATE OR REPLACE FUNCTION public.admin_reset_demo_qr_assignments(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c jsonb;
BEGIN
  IF p_org IS DISTINCT FROM '2c5aa49a-cc3d-4166-8c5f-f6c94307103f'::uuid THEN
    RAISE EXCEPTION 'Only the presentation demo organization can be reset' USING ERRCODE = '42501';
  END IF;

  WITH removed AS (
    DELETE FROM public.qr_assignments
     WHERE organization_id = p_org AND target_type <> 'warehouse.location'
    RETURNING target_type
  )
  SELECT COALESCE(jsonb_object_agg(target_type, n), '{}'::jsonb) INTO c
  FROM (SELECT target_type, count(*) AS n FROM removed GROUP BY target_type) x;

  RETURN jsonb_build_object(
    'removed', c,
    'location_assignments_kept',
      (SELECT count(*) FROM public.qr_assignments
        WHERE organization_id = p_org AND target_type = 'warehouse.location' AND revoked_at IS NULL),
    'qr_codes_free',
      (SELECT count(*) FROM public.qr_codes q
        WHERE q.organization_id = p_org AND q.status = 'active' AND q.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.qr_assignments a
                           WHERE a.qr_code_id = q.id AND a.revoked_at IS NULL))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_reset_demo_qr_assignments(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_demo_org_data(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c jsonb := '{}'::jsonb;
  n integer;
BEGIN
  IF p_org IS DISTINCT FROM '2c5aa49a-cc3d-4166-8c5f-f6c94307103f'::uuid THEN
    RAISE EXCEPTION 'Only the presentation demo organization can be reset' USING ERRCODE = '42501';
  END IF;

  ALTER TABLE public.inventory_balances DISABLE TRIGGER inventory_balances_engine_only;
  ALTER TABLE public.inventory_movement_audit_log DISABLE TRIGGER inventory_audit_log_no_modify;
  ALTER TABLE public.inventory_movement_headers DISABLE TRIGGER inventory_movement_headers_immutable_v2;
  ALTER TABLE public.inventory_movement_lines DISABLE TRIGGER inventory_movement_lines_immutable_v2;
  ALTER TABLE public.inventory_stock_ledger_entries DISABLE TRIGGER inventory_stock_ledger_no_modify;

  -- Notifications: they point at tickets, tasks and orders that are about to disappear
  DELETE FROM public.notifications WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('notifications', n);

  -- Messages: attachment rows of conversations, then conversations (cascade to members and
  -- messages; the last-message link is cleared first so the cascade has no cycle to resolve)
  DELETE FROM public.app_attachments WHERE org_id = p_org AND target_type = 'chat.conversation';
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('chat_attachments', n);
  UPDATE public.chat_conversations SET last_message_id = NULL
   WHERE organization_id = p_org AND last_message_id IS NOT NULL;
  DELETE FROM public.chat_conversations WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('chat_conversations', n);

  -- Comments and attachment rows of tickets and repair orders, then tickets
  DELETE FROM public.app_comment_events
   WHERE org_id = p_org AND target_type IN ('helpdesk.ticket', 'workshop.repair_order');
  UPDATE public.app_comments SET parent_comment_id = NULL
   WHERE org_id = p_org AND target_type IN ('helpdesk.ticket', 'workshop.repair_order')
     AND parent_comment_id IS NOT NULL;
  DELETE FROM public.app_comments
   WHERE org_id = p_org AND target_type IN ('helpdesk.ticket', 'workshop.repair_order');
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('app_comments', n);
  DELETE FROM public.app_attachments
   WHERE org_id = p_org AND target_type IN ('helpdesk.ticket', 'workshop.repair_order');
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('app_attachments', n);
  DELETE FROM public.helpdesk_tickets WHERE org_id = p_org;  -- cascades activity, assignees, ...
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('helpdesk_tickets', n);

  -- Repair orders and Matcher
  DELETE FROM public.repair_orders WHERE organization_id = p_org;  -- cascades lines and links
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('repair_orders', n);
  DELETE FROM public.wdd_matcher_line_matches WHERE organization_id = p_org;
  DELETE FROM public.wdd_matcher_block_matches WHERE organization_id = p_org;
  DELETE FROM public.workshop_source_documents WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('workshop_source_documents', n);
  DELETE FROM public.wdd_matcher_sessions WHERE organization_id = p_org;  -- files, blocks, lines
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('wdd_matcher_sessions', n);

  -- Commitments and containers. QR stickers other than locations are freed, codes kept.
  c := c || jsonb_build_object('qr', public.admin_reset_demo_qr_assignments(p_org));
  DELETE FROM public.inventory_allocation_container_links WHERE organization_id = p_org;
  DELETE FROM public.inventory_container_lines WHERE organization_id = p_org;
  DELETE FROM public.inventory_allocations WHERE organization_id = p_org;  -- cascades lines
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_allocations', n);
  DELETE FROM public.inventory_reservations WHERE organization_id = p_org;  -- cascades lines and history
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_reservations', n);
  DELETE FROM public.inventory_stock_blocks WHERE organization_id = p_org;  -- cascades lines and history
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_stock_blocks', n);

  -- Stock: balances, ledger, audit, corrections, movements
  DELETE FROM public.inventory_balances WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_balances', n);
  DELETE FROM public.inventory_stock_ledger_entries WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_stock_ledger_entries', n);
  DELETE FROM public.inventory_movement_correction_lines WHERE organization_id = p_org;
  DELETE FROM public.inventory_movement_audit_log WHERE organization_id = p_org;
  DELETE FROM public.inventory_movement_lines WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_movement_lines', n);
  UPDATE public.inventory_movement_headers
     SET original_movement_id = NULL, reversal_movement_id = NULL
   WHERE organization_id = p_org
     AND (original_movement_id IS NOT NULL OR reversal_movement_id IS NOT NULL);
  DELETE FROM public.inventory_movement_headers WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_movement_headers', n);
  DELETE FROM public.inventory_containers WHERE organization_id = p_org;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_containers', n);

  -- Stock counts (inventory sessions reference variants)
  DELETE FROM public.inventory_count_sessions WHERE organization_id = p_org;  -- cascades lines
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_count_sessions', n);

  -- Product catalogue (suppliers themselves are kept)
  DELETE FROM public.inventory_product_branch_settings WHERE organization_id = p_org;
  DELETE FROM public.warehouse_item_suppliers WHERE organization_id = p_org;
  DELETE FROM public.inventory_variant_costs WHERE organization_id = p_org;
  DELETE FROM public.inventory_products WHERE organization_id = p_org;  -- cascades variants
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_products', n);

  -- Numbering and activity log
  UPDATE public.inventory_document_sequences SET next_number = 1 WHERE organization_id = p_org;
  -- REZ/ and KON/ numbers are counted in inventory_settings, not in the document sequences;
  -- its write guard lets the engine change the counters only.
  PERFORM set_config('ambra.inventory_movement_engine', 'on', true);
  UPDATE public.inventory_settings SET reservation_number_next = 1, allocation_number_next = 1
   WHERE organization_id = p_org;
  UPDATE public.organization_counters SET next_value = 1, updated_at = now()
   WHERE organization_id = p_org AND counter_key = 'helpdesk.ticket';
  DELETE FROM public.platform_events
   WHERE organization_id = p_org
     AND module_slug IN ('warehouse', 'workshop', 'help-desk', 'helpdesk', 'tools');
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('platform_events', n);

  ALTER TABLE public.inventory_balances ENABLE TRIGGER inventory_balances_engine_only;
  ALTER TABLE public.inventory_movement_audit_log ENABLE TRIGGER inventory_audit_log_no_modify;
  ALTER TABLE public.inventory_movement_headers ENABLE TRIGGER inventory_movement_headers_immutable_v2;
  ALTER TABLE public.inventory_movement_lines ENABLE TRIGGER inventory_movement_lines_immutable_v2;
  ALTER TABLE public.inventory_stock_ledger_entries ENABLE TRIGGER inventory_stock_ledger_no_modify;

  RETURN c;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_reset_demo_org_data(uuid) FROM PUBLIC, anon, authenticated;
