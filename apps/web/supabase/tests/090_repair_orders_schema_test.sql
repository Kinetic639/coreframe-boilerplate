-- ============================================================================
-- TEST: Zone 3 RepairOrder schema -- constraints, RLS, FORCE RLS
-- ============================================================================
-- Verifies the schema created by
-- apps/web/supabase-target/supabase/migrations/20260910061711_repair_orders_core_schema.sql,
-- 20260910071755_repair_orders_status_archived.sql, and
-- 20260910074716_repair_orders_archive_rls_restriction.sql.
--
-- Executed against supabase-target via Supabase MCP (pgtap extension
-- installed via 20260910071815_enable_pgtap_extension.sql). Last run:
-- 2026-09-10, 26/26 passing. Wrapped in BEGIN/ROLLBACK -- inserts test rows
-- to exercise constraints, then rolls back, leaving no residual data
-- (verified: 0 PGTAP-TEST rows remain live after each run).
--
-- These are schema/constraint/policy-DEFINITION tests (static verification
-- that constraints and RLS policies exist and are worded exactly as
-- designed), run as the table owner/service role via MCP. They do NOT
-- exercise RLS BEHAVIORALLY as an authenticated non-owner session would
-- (e.g. an actual cross-branch SELECT denial as a real branch-scoped user).
-- That class of test is the SetupClient/RlsClient live-DB integration
-- pattern, explicitly scoped to Phase 15 (Pilot hardening) in the
-- implementation plan, not claimed as covered here.

BEGIN;

SELECT plan(26);

-- ============================================================================
-- FORCE RLS on all 7 PITCH tables
-- ============================================================================

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'repair_orders'),
  'repair_orders has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'repair_order_lines'),
  'repair_order_lines has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'workshop_source_documents'),
  'workshop_source_documents has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'repair_order_source_document_links'),
  'repair_order_source_document_links has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'workshop_source_document_lines'),
  'workshop_source_document_lines has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'repair_order_line_source_links'),
  'repair_order_line_source_links has FORCE RLS enabled'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'repair_order_line_movement_links'),
  'repair_order_line_movement_links has FORCE RLS enabled'
);

-- ============================================================================
-- Business identity: repair_orders_identity_unique partial unique index
-- ============================================================================

SELECT ok(
  (SELECT indexdef FROM pg_indexes WHERE indexname = 'repair_orders_identity_unique')
    = 'CREATE UNIQUE INDEX repair_orders_identity_unique ON public.repair_orders USING btree (organization_id, branch_id, zl_number) WHERE ((zl_number IS NOT NULL) AND (deleted_at IS NULL))',
  'repair_orders_identity_unique is exactly organization_id+branch_id+zl_number, partial on non-null zl_number and non-deleted'
);

-- Seed one row to duplicate against (public.branches has both organization_id
-- and its own id -- public.organizations alone does NOT have branch_id).
DO $do$
DECLARE
  v_org_id UUID;
  v_branch_id UUID;
BEGIN
  SELECT organization_id, id INTO v_org_id, v_branch_id FROM public.branches LIMIT 1;
  INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status)
  VALUES (v_org_id, v_branch_id, 'PGTAP-TEST-ZL-DUP', 'resolved');
END $do$;

SELECT throws_ok(
  $$INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status)
    SELECT organization_id, id, 'PGTAP-TEST-ZL-DUP', 'resolved' FROM public.branches LIMIT 1$$,
  '23505',
  NULL,
  'duplicate organization_id+branch_id+zl_number is rejected by repair_orders_identity_unique'
);

-- ============================================================================
-- repair_orders_resolved_requires_zl_number CHECK
-- ============================================================================

SELECT throws_ok(
  $$INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status)
    SELECT organization_id, id, NULL, 'resolved' FROM public.branches LIMIT 1$$,
  '23514',
  NULL,
  'a resolved repair_order without zl_number is rejected (repair_orders_resolved_requires_zl_number)'
);

-- An unresolved order with no zl_number is fine.
SELECT lives_ok(
  $$INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status)
    SELECT organization_id, id, NULL, 'unresolved' FROM public.branches LIMIT 1$$,
  'an unresolved repair_order with no zl_number is accepted'
);

-- ============================================================================
-- repair_orders.status CHECK now includes archived (2026-09-10 correction)
-- ============================================================================

SELECT ok(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'repair_orders_status_check')
    = 'CHECK ((status = ANY (ARRAY[''open''::text, ''closed''::text, ''archived''::text])))',
  'repair_orders_status_check allows exactly open/closed/archived'
);

SELECT throws_ok(
  $$INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status, status)
    SELECT organization_id, id, NULL, 'unresolved', 'in_progress' FROM public.branches LIMIT 1$$,
  '23514',
  NULL,
  'status = in_progress is rejected -- not an accepted RepairOrder status'
);

SELECT lives_ok(
  $$INSERT INTO public.repair_orders (organization_id, branch_id, zl_number, identity_status, status)
    SELECT organization_id, id, NULL, 'unresolved', 'archived' FROM public.branches LIMIT 1$$,
  'status = archived is accepted'
);

-- ============================================================================
-- workshop_source_documents natural key (final clarification pass correction)
-- ============================================================================

SELECT ok(
  (SELECT indexdef FROM pg_indexes WHERE indexname = 'workshop_source_documents_natural_key')
    = 'CREATE UNIQUE INDEX workshop_source_documents_natural_key ON public.workshop_source_documents USING btree (organization_id, branch_id, document_type, external_document_number, source_session_id)',
  'workshop_source_documents_natural_key is exactly org+branch+document_type+external_document_number+source_session_id'
);

-- ============================================================================
-- Link-table uniqueness constraints
-- ============================================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.repair_order_line_source_links'::regclass
      AND conname = 'repair_order_line_source_links_source_line_unique'
  ),
  'repair_order_line_source_links enforces one source line -> at most one logical line'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.repair_order_line_movement_links'::regclass
      AND conname = 'repair_order_line_movement_links_unique'
      AND pg_get_constraintdef(oid) = 'UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)'
  ),
  'repair_order_line_movement_links prevents double-applying the same movement line under the same relation_type'
);

-- ============================================================================
-- crm_contacts / crm_party_roles advisor-model extension (Correction 2)
-- ============================================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'crm_contacts_org_linked_user_unique'
      AND indexdef LIKE '%(organization_id, linked_user_id)%'
      AND indexdef LIKE '%WHERE%linked_user_id IS NOT NULL%'
  ),
  'crm_contacts_org_linked_user_unique enforces unambiguous advisor identity'
);

SELECT ok(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'crm_party_roles_role_check') LIKE '%employee%',
  'crm_party_roles.role CHECK constraint now allows employee'
);

-- ============================================================================
-- DELETE-deny policies (soft-delete-only convention)
-- ============================================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'repair_orders' AND policyname = 'repair_orders_delete_deny' AND cmd = 'DELETE' AND qual = 'false'
  ),
  'repair_orders denies hard DELETE'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workshop_source_documents' AND policyname = 'workshop_source_documents_delete_deny' AND cmd = 'DELETE' AND qual = 'false'
  ),
  'workshop_source_documents denies hard DELETE (immutable Matcher provenance)'
);

-- ============================================================================
-- Archive permission restriction (2026-09-10 fix -- manage_own must never be
-- able to write status = 'archived', even directly bypassing the service
-- layer; only manage_all may archive). Static policy-definition check: the
-- previous UPDATE policy allowed manage_own+ownership to write ANY column
-- value including status='archived' -- this proves the fix is live.
-- Full authenticated-session behavioral proof (a real manage_own JWT actually
-- being rejected mid-flight) is deferred to Phase 7/15's SetupClient/RlsClient
-- live-DB integration tests, per the same scope note as above.
-- ============================================================================

SELECT ok(
  (SELECT with_check FROM pg_policies WHERE tablename = 'repair_orders' AND policyname = 'repair_orders_update')
    = $wc$(has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all'::text) OR (has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own'::text) AND (advisor_contact_id IN ( SELECT crm_contacts.id
   FROM crm_contacts
  WHERE (crm_contacts.linked_user_id = ( SELECT auth.uid() AS uid)))) AND (status <> 'archived'::text)))$wc$,
  'repair_orders_update WITH CHECK restricts manage_own from ever writing status=archived, while leaving manage_all unrestricted'
);

-- ============================================================================
-- RLS policy definition checks (static -- see file header re: behavioral scope)
-- ============================================================================

SELECT ok(
  (SELECT count(*) FROM pg_policies WHERE tablename = 'repair_orders' AND cmd = 'SELECT') = 1,
  'repair_orders has exactly one SELECT policy'
);

SELECT ok(
  (SELECT qual FROM pg_policies WHERE tablename = 'repair_orders' AND cmd = 'SELECT')
    LIKE '%has_branch_permission(organization_id, branch_id, ''workshop.repair_orders.read''::text)%',
  'repair_orders SELECT policy is gated by has_branch_permission, not the org-only has_permission'
);

-- ============================================================================
-- Zone 3 permission rows seeded
-- ============================================================================

SELECT ok(
  (SELECT count(*) FROM public.permissions WHERE slug IN (
    'workshop.repair_orders.read', 'workshop.repair_orders.manage_own', 'workshop.repair_orders.manage_all'
  )) = 3,
  'all 3 Zone 3 permission slugs are seeded'
);

-- ============================================================================
-- inventory_variants FK sanity (plain FK, not composite -- documented
-- deliberate exception per the migration header note)
-- ============================================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.repair_order_lines'::regclass
      AND confrelid = 'public.inventory_variants'::regclass
  ),
  'repair_order_lines.variant_id has a real FK to inventory_variants'
);

SELECT * FROM finish();

ROLLBACK;
