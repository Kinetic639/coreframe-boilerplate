-- Migration: repair_orders_materialization_rpc
-- Phase 3: transactional Matcher -> RepairOrder materialization.
--
-- SCOPE OF THIS FIRST PASS (evidence-based, not guessed -- see comments):
--   Materializes RepairOrders + logical lines + source documents/lines +
--   provenance links from wdd_matcher_blocks/wdd_matcher_lines rows that
--   carry a resolved zl_number (block_type IN ('brand_order','direct_order')).
--   wdd_reconciliation blocks are explicitly NOT linked to RepairOrders by
--   this function -- LIVE VERIFIED before writing this migration: 100% of
--   wdd_reconciliation blocks (3,389/3,389) carry neither zl_number nor VIN
--   in their metadata, so there is no safe, non-guessed field-level rule to
--   attribute a WDD document to a specific RepairOrder. This is a genuine,
--   evidenced gap, not an oversight -- a future migration adds WDD-document
--   linking once a product/data decision resolves that mapping.
--
-- Authorization (verified, not copied blindly from existing templates):
--   - p_actor_user_id MUST equal auth.uid() -- rejects any delegated-actor
--     spoofing attempt. (Verified live: neither inventory_finalize_posting
--     nor helpdesk_accept_ticket enforce this -- inventory_finalize_posting
--     trusts p_actor_user_id blindly with no permission check at all, and
--     both are EXECUTE-granted to anon/authenticated by default. This
--     function deliberately does NOT copy that pattern.)
--   - has_branch_permission(...'workshop.repair_orders.manage_own') OR
--     (...'workshop.repair_orders.manage_all') is required for the session's
--     own organization_id/branch_id -- never client-supplied org/branch.
--   - EXECUTE is revoked from PUBLIC and anon; granted only to authenticated.
--
-- Idempotency (verified against real constraints, not assumed):
--   - repair_orders: ON CONFLICT on repair_orders_identity_unique.
--   - workshop_source_documents: ON CONFLICT on the natural key (incl.
--     source_session_id).
--   - repair_order_source_document_links: ON CONFLICT on its composite PK.
--   - workshop_source_document_lines: ON CONFLICT on the new
--     workshop_source_document_lines_matcher_line_unique index (added in a
--     companion migration this same pass).
--   - repair_order_line_source_links: ON CONFLICT on the existing
--     UNIQUE(workshop_source_document_line_id).
--   - repair_order_lines: NOT given a new unique constraint (same SKU on
--     independent lines must remain possible -- explicit architecture rule).
--     Its idempotency is DERIVED, not directly enforced: a repair_order_lines
--     row is only ever created/updated in response to a workshop_source_document_lines
--     row that was genuinely newly inserted this call (detected via the
--     ON CONFLICT ... DO NOTHING RETURNING pattern) -- so a source line that
--     was already materialized on a prior call can never re-trigger logical
--     line creation on a later call. Within ONE call, reusing an existing
--     logical line for the same repair_order_id + product_code is a
--     deliberate reconciliation choice (documented below), not a duplicate-
--     prevention mechanism.
--
-- Locking/concurrency: SELECT ... FOR UPDATE on the wdd_matcher_sessions row
-- is the first statement after validation, so two concurrent calls for the
-- same session serialize on that row lock; the second call (after the first
-- commits) finds all the same natural keys already present and becomes a
-- pure idempotent no-op via the ON CONFLICT paths above.

CREATE OR REPLACE FUNCTION public.materialize_repair_orders_from_session(
  p_actor_user_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_session RECORD;
  v_block RECORD;
  v_line RECORD;

  v_repair_order_id uuid;
  v_document_id uuid;
  v_doc_line_id uuid;
  v_repair_order_line_id uuid;

  v_dcode text;

  v_created_orders int := 0;
  v_reused_orders int := 0;
  v_created_documents int := 0;
  v_reused_documents int := 0;
  v_created_document_lines int := 0;
  v_created_document_links int := 0;
  v_created_line_links int := 0;
  v_created_logical_lines int := 0;
  v_skipped_nonpositive_quantity int := 0;

  v_seen_zl text[] := ARRAY[]::text[];
BEGIN
  -- ---------------------------------------------------------------------
  -- Authorization: actor identity
  -- ---------------------------------------------------------------------
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'p_actor_user_id must match the authenticated caller' USING ERRCODE = '28000';
  END IF;

  -- ---------------------------------------------------------------------
  -- Lock and validate the session (concurrency boundary)
  -- ---------------------------------------------------------------------
  SELECT * INTO v_session FROM public.wdd_matcher_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matcher session not found: %', p_session_id USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'approved' THEN
    RAISE EXCEPTION 'Matcher session is not approved (status=%)', v_session.status USING ERRCODE = '55000';
  END IF;

  IF v_session.branch_id IS NULL THEN
    RAISE EXCEPTION 'Matcher session has no branch_id -- cannot materialize without a branch' USING ERRCODE = '55000';
  END IF;

  -- ---------------------------------------------------------------------
  -- Authorization: branch-scoped permission (org/branch from the LOCKED
  -- session row -- never from a client parameter)
  -- ---------------------------------------------------------------------
  IF NOT (
    public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'workshop.repair_orders.manage_own')
    OR public.has_branch_permission(v_session.organization_id, v_session.branch_id, 'workshop.repair_orders.manage_all')
  ) THEN
    RAISE EXCEPTION 'Not authorized to materialize repair orders for this branch' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Materialize each zl_number-bearing block (brand_order / direct_order)
  -- ---------------------------------------------------------------------
  FOR v_block IN
    SELECT
      b.id AS block_id,
      b.metadata->>'zl_number' AS zl_number,
      b.metadata->>'order_number' AS order_number,
      b.metadata->>'vin' AS vin,
      b.metadata->>'document_brand' AS vehicle_brand,
      b.metadata->>'client_name' AS client_name,
      b.metadata->>'dealer_name' AS dealer_name
    FROM public.wdd_matcher_blocks b
    WHERE b.session_id = p_session_id
      AND b.metadata->>'zl_number' IS NOT NULL
    ORDER BY b.block_index
  LOOP
    v_dcode := (regexp_match(v_block.zl_number, '/(\d{3,4})/BL$'))[1];

    -- Resolve or create the RepairOrder for this zl_number.
    INSERT INTO public.repair_orders (
      organization_id, branch_id, zl_number, order_number, identity_status,
      vin, vehicle_brand, client_name, dealer_name, status, created_by
    )
    VALUES (
      v_session.organization_id, v_session.branch_id, v_block.zl_number, v_block.order_number, 'resolved',
      v_block.vin, v_block.vehicle_brand, v_block.client_name, v_block.dealer_name, 'open', p_actor_user_id
    )
    ON CONFLICT (organization_id, branch_id, zl_number) WHERE zl_number IS NOT NULL AND deleted_at IS NULL
    DO NOTHING
    RETURNING id INTO v_repair_order_id;

    IF v_repair_order_id IS NOT NULL THEN
      IF NOT (v_block.zl_number = ANY (v_seen_zl)) THEN
        v_created_orders := v_created_orders + 1;
      END IF;
    ELSE
      SELECT id INTO v_repair_order_id
      FROM public.repair_orders
      WHERE organization_id = v_session.organization_id
        AND branch_id = v_session.branch_id
        AND zl_number = v_block.zl_number
        AND deleted_at IS NULL;

      IF NOT (v_block.zl_number = ANY (v_seen_zl)) THEN
        v_reused_orders := v_reused_orders + 1;
      END IF;
    END IF;

    v_seen_zl := array_append(v_seen_zl, v_block.zl_number);

    -- Resolve or create the source document for this block (natural key
    -- includes source_session_id -- see Correction 3 final clarification).
    INSERT INTO public.workshop_source_documents (
      organization_id, branch_id, document_type, external_document_number,
      source_session_id, official_warehouse_code, block_id
    )
    VALUES (
      v_session.organization_id, v_session.branch_id, 'zl', v_block.zl_number,
      p_session_id, v_dcode, v_block.block_id
    )
    ON CONFLICT (organization_id, branch_id, document_type, external_document_number, source_session_id)
    DO NOTHING
    RETURNING id INTO v_document_id;

    IF v_document_id IS NOT NULL THEN
      v_created_documents := v_created_documents + 1;
    ELSE
      SELECT id INTO v_document_id
      FROM public.workshop_source_documents
      WHERE organization_id = v_session.organization_id
        AND branch_id = v_session.branch_id
        AND document_type = 'zl'
        AND external_document_number = v_block.zl_number
        AND source_session_id = p_session_id;
      v_reused_documents := v_reused_documents + 1;
    END IF;

    INSERT INTO public.repair_order_source_document_links (repair_order_id, workshop_source_document_id, linked_by)
    VALUES (v_repair_order_id, v_document_id, p_actor_user_id)
    ON CONFLICT (repair_order_id, workshop_source_document_id) DO NOTHING;

    IF FOUND THEN
      v_created_document_links := v_created_document_links + 1;
    END IF;

    -- ---------------------------------------------------------------------
    -- Materialize each source line under this block
    -- ---------------------------------------------------------------------
    FOR v_line IN
      SELECT * FROM public.wdd_matcher_lines WHERE block_id = v_block.block_id
    LOOP
      INSERT INTO public.workshop_source_document_lines (
        workshop_source_document_id, wdd_matcher_line_id, product_code, product_name, quantity, unit, raw_text
      )
      VALUES (
        v_document_id, v_line.id, v_line.product_code, v_line.product_name,
        COALESCE(v_line.quantity, 0), v_line.unit, v_line.raw_text
      )
      ON CONFLICT (workshop_source_document_id, wdd_matcher_line_id) WHERE wdd_matcher_line_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_doc_line_id;

      IF v_doc_line_id IS NULL THEN
        -- Already materialized on a prior call -- idempotent skip. This is
        -- also exactly why a repair_order_lines row can never be
        -- double-created for this source line: we never reach the logical-
        -- line block below for an already-materialized source line.
        CONTINUE;
      END IF;

      v_created_document_lines := v_created_document_lines + 1;

      IF v_line.quantity IS NULL OR v_line.quantity <= 0 THEN
        -- Cannot create a repair_order_line_source_links row: quantity_contribution
        -- requires > 0. Raw provenance (workshop_source_document_lines) is
        -- still preserved above -- only the logical-line linkage is skipped.
        -- Not guessed at: whether a zero/null-quantity source line should
        -- eventually attach to a placeholder logical line is an open product
        -- decision, not resolved here.
        v_skipped_nonpositive_quantity := v_skipped_nonpositive_quantity + 1;
        CONTINUE;
      END IF;

      -- Resolve-or-create the logical line: reuse an existing line under
      -- this repair_order with the same product_code (a newly-arrived source
      -- line for a part already tracked on this order contributes to the
      -- SAME logical line, per Correction 4's many-source-lines-per-logical-
      -- line model); lines with no product_code always get their own new
      -- logical line, since there is no safe key to match them by.
      v_repair_order_line_id := NULL;

      IF v_line.product_code IS NOT NULL THEN
        SELECT id INTO v_repair_order_line_id
        FROM public.repair_order_lines
        WHERE repair_order_id = v_repair_order_id
          AND product_code = v_line.product_code
          AND deleted_at IS NULL
        LIMIT 1;
      END IF;

      IF v_repair_order_line_id IS NULL THEN
        INSERT INTO public.repair_order_lines (
          repair_order_id, variant_id, product_code, product_name, ordered_quantity, unit
        )
        VALUES (
          v_repair_order_id, NULL, v_line.product_code,
          COALESCE(v_line.product_name, v_line.raw_text, 'Unknown part'),
          v_line.quantity, v_line.unit
        )
        RETURNING id INTO v_repair_order_line_id;
        v_created_logical_lines := v_created_logical_lines + 1;
      ELSE
        UPDATE public.repair_order_lines
        SET ordered_quantity = ordered_quantity + v_line.quantity, updated_at = now()
        WHERE id = v_repair_order_line_id;
      END IF;

      INSERT INTO public.repair_order_line_source_links (
        repair_order_line_id, workshop_source_document_line_id, quantity_contribution
      )
      VALUES (v_repair_order_line_id, v_doc_line_id, v_line.quantity)
      ON CONFLICT (workshop_source_document_line_id) DO NOTHING;

      IF FOUND THEN
        v_created_line_links := v_created_line_links + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'created_repair_orders', v_created_orders,
    'reused_repair_orders', v_reused_orders,
    'created_source_documents', v_created_documents,
    'reused_source_documents', v_reused_documents,
    'created_source_document_lines', v_created_document_lines,
    'created_document_links', v_created_document_links,
    'created_logical_lines', v_created_logical_lines,
    'created_line_links', v_created_line_links,
    'skipped_nonpositive_quantity_lines', v_skipped_nonpositive_quantity,
    'already_materialized', (v_created_orders = 0 AND v_created_documents = 0 AND v_created_document_lines = 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.materialize_repair_orders_from_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materialize_repair_orders_from_session(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.materialize_repair_orders_from_session(uuid, uuid) TO authenticated;
