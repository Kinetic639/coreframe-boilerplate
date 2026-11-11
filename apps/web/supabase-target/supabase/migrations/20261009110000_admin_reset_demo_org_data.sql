-- Presentation demo reset: wipe the operational data of the demo organization
-- "Grupa Cichy-Zasada – CNP" (2c5aa49a-cc3d-4166-8c5f-f6c94307103f) and keep its setup.
--
-- Deleted: product catalogue (products, variants, branch settings, supplier links), every stock
-- movement with its ledger, balances and audit log, stock counts, reservations, allocations, containers,
-- repair orders with lines and source documents, Matcher sessions, Help Desk tickets with
-- comments / activity / attachment rows, warehouse/workshop/help-desk events in the activity log.
-- Kept: organization, branches, members, roles and permissions, invitations, branch DMS
-- warehouses, suppliers, locations, QR codes and location QR assignments (container assignments
-- are revoked so the stickers can be reused), Help Desk ticket types and settings, movement and
-- document types, units, field policies, inventory settings.
-- Numbering restarts at 1: inventory documents (PZ, MM, RW, ...) and Help Desk tickets
-- (per-organization counter, 20261009050336). Storage files of deleted attachments and Matcher
-- PDFs stay in their buckets (removable through the Storage API only).
--
-- The append-only / engine-only guards on movements, ledger, balances and audit log are
-- disabled only inside the call and re-enabled before it returns. It is one transaction: on any
-- error everything is rolled back, guards included. Not callable through the API.

CREATE OR REPLACE FUNCTION public.admin_reset_demo_org_data(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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

  -- Commitments and containers (container QR stickers are released, codes kept)
  UPDATE public.qr_assignments
     SET revoked_at = now(), revocation_reason = 'demo reset'
   WHERE organization_id = p_org AND target_type = 'inventory.container' AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('container_qr_released', n);
  DELETE FROM public.inventory_allocation_container_links WHERE organization_id = p_org;
  DELETE FROM public.inventory_container_lines WHERE organization_id = p_org;
  DELETE FROM public.inventory_allocations WHERE organization_id = p_org;  -- cascades lines
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_allocations', n);
  DELETE FROM public.inventory_reservations WHERE organization_id = p_org;  -- cascades lines
  GET DIAGNOSTICS n = ROW_COUNT; c := c || jsonb_build_object('inventory_reservations', n);

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
$$;

REVOKE ALL ON FUNCTION public.admin_reset_demo_org_data(uuid) FROM PUBLIC, anon, authenticated;
