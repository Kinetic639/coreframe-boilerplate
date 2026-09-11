-- =============================================================================
-- Migration: repair_orders_core_schema -- Zone 3 RepairOrder domain (PITCH scope)
-- Date:      2026-09-10
-- =============================================================================
-- Scope (per docs/mvp/zones/03-repair-orders.md → Product clarification and
-- final design, and docs/mvp/zones/03-repair-orders-implementation-plan.md
-- Phase 2):
--   1. Seven PITCH-scope Zone 3 tables:
--        repair_orders
--        repair_order_lines
--        workshop_source_documents
--        repair_order_source_document_links
--        workshop_source_document_lines
--        repair_order_line_source_links
--        repair_order_line_movement_links
--      (repair_order_legacy_records is PILOT-scope, deferred to Phase 14.)
--   2. RepairOrder business identity: organization_id + branch_id + zl_number
--      (partial unique index; order_number is descriptive-only, never identity).
--   3. workshop_source_documents natural key: organization_id + branch_id +
--      document_type + external_document_number + source_session_id.
--   4. crm_contacts unique constraint + crm_party_roles 'employee' role value,
--      required for the CRM-based advisor model (repair_orders.advisor_contact_id).
--   5. Zone 3 permission rows (workshop.repair_orders.read / manage_own / manage_all)
--      + role-permission seeding, following the workshop_module.sql pattern.
--   6. RLS: FORCE RLS + direct organization_id/branch_id columns on
--      repair_orders and workshop_source_documents (Tier 1, primary entities).
--      Join-derived scope (via parent FK, no duplicated columns) on
--      repair_order_lines, workshop_source_document_lines, and all three
--      link tables (Tier 1, pure children/link tables).
--
-- Explicitly NOT in this migration (see implementation plan for phase):
--   - Materialization RPC (Phase 3)
--   - Matcher approveSession wiring (Phase 4)
--   - repair_order_legacy_records (PILOT, Phase 14)
--
-- Verified live via Supabase MCP before writing (2026-09-10):
--   - crm_contacts.linked_user_id has no unique constraint today (confirmed).
--   - crm_party_roles.role is a plain text CHECK, not an enum (confirmed).
--   - inventory_movement_lines has no line-level reference column (confirmed).
--   - inventory_variants PRIMARY KEY (id) -- plain FK reference is valid; this
--     migration intentionally does NOT duplicate organization_id onto
--     repair_order_lines to support a composite FK (would reintroduce the
--     write-time consistency risk the architecture doc explicitly rejected
--     for child tables) -- cross-org variant assignment is guarded by RLS via
--     the repair_order_lines -> repair_orders join and by service-layer checks,
--     not by a composite FK on this nullable column.
--   - has_branch_permission(p_org_id uuid, p_branch_id uuid, p_permission_slug text)
--     and can_access_comment_target(...) signatures confirmed live.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Zone 3 permission rows + role-permission seeding
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('workshop.repair_orders.read',        'Repair Orders Read',        'workshop', 'read'),
  ('workshop.repair_orders.manage_own',  'Repair Orders Manage Own',  'workshop', 'manage_own'),
  ('workshop.repair_orders.manage_all',  'Repair Orders Manage All',  'workshop', 'manage_all')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_owner_id UUID;
  v_perm_id  UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE name = 'org_owner' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'org_owner basic role not found';
  END IF;

  -- org_owner already holds workshop.* wildcard (seeded in workshop_module.sql),
  -- which covers workshop.repair_orders.* via the compiler's wildcard expansion.
  -- No explicit granular grant needed here -- mirrors the documented pattern of
  -- NOT double-granting wildcard + concrete slugs to the same role.
END $$;

-- ---------------------------------------------------------------------------
-- PART 2: CRM extension required for the advisor model (Correction 2)
-- ---------------------------------------------------------------------------

-- crm_contacts: an internal advisor's linked user must be unambiguous.
-- Additive; does not affect existing unlinked (pure external) contacts.
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_org_linked_user_unique
  ON public.crm_contacts (organization_id, linked_user_id)
  WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL;

-- crm_party_roles: add 'employee' as an allowed role value (plain text CHECK,
-- not an enum type -- confirmed live before writing this migration).
ALTER TABLE public.crm_party_roles DROP CONSTRAINT IF EXISTS crm_party_roles_role_check;
ALTER TABLE public.crm_party_roles ADD CONSTRAINT crm_party_roles_role_check
  CHECK (role = ANY (ARRAY['supplier','client','contractor','vendor','partner','receiver','payer','other','employee']));

-- ---------------------------------------------------------------------------
-- PART 3: repair_orders (header -- Tier 1, FORCE RLS, direct org/branch columns)
-- ---------------------------------------------------------------------------
CREATE TABLE public.repair_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id            UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  -- Business identity (Correction 1, final clarification pass): zl_number is
  -- the verified per-vehicle identifier. order_number is descriptive only.
  zl_number            TEXT,
  order_number         TEXT,
  identity_status      TEXT NOT NULL DEFAULT 'unresolved'
                         CHECK (identity_status IN ('resolved', 'unresolved')),

  advisor_contact_id   UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,

  status               TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'closed')),

  -- Descriptive vehicle/customer fields, never part of uniqueness.
  vin                  TEXT,
  vehicle_brand        TEXT,
  client_name          TEXT,
  dealer_name          TEXT,

  created_by           UUID REFERENCES public.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,

  -- A 'resolved' order must carry the zl_number that makes it resolved.
  CONSTRAINT repair_orders_resolved_requires_zl_number
    CHECK (identity_status <> 'resolved' OR zl_number IS NOT NULL)
);

-- Business identity uniqueness (Correction 1 Option B): scoped to org+branch,
-- only enforced once an order has a resolved zl_number.
CREATE UNIQUE INDEX repair_orders_identity_unique
  ON public.repair_orders (organization_id, branch_id, zl_number)
  WHERE zl_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX repair_orders_org_branch_idx ON public.repair_orders (organization_id, branch_id) WHERE deleted_at IS NULL;
CREATE INDEX repair_orders_order_number_idx ON public.repair_orders (order_number) WHERE deleted_at IS NULL;
CREATE INDEX repair_orders_vin_idx ON public.repair_orders (vin) WHERE deleted_at IS NULL;
CREATE INDEX repair_orders_advisor_contact_idx ON public.repair_orders (advisor_contact_id) WHERE deleted_at IS NULL;

ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_orders_select ON public.repair_orders
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read')
  );

CREATE POLICY repair_orders_insert ON public.repair_orders
  FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
    OR public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
  );

CREATE POLICY repair_orders_update ON public.repair_orders
  FOR UPDATE
  USING (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    OR (
      public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      AND advisor_contact_id IN (
        SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
    OR (
      public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
      AND advisor_contact_id IN (
        SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid())
      )
    )
  );

-- No DELETE policy: hard delete is denied by default (RLS with no matching
-- policy denies the command entirely) -- mirrors the repo's established
-- "DELETE ... USING (false)" soft-delete-only convention.
CREATE POLICY repair_orders_delete_deny ON public.repair_orders
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- PART 4: repair_order_lines (child -- Tier 1, join-derived scope, no
-- duplicated organization_id/branch_id columns)
-- ---------------------------------------------------------------------------
CREATE TABLE public.repair_order_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id   UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,

  -- Nullable: manual lines may exist with no catalog match yet.
  -- Plain FK (not composite with organization_id) -- see migration header note.
  variant_id        UUID REFERENCES public.inventory_variants(id),

  product_code      TEXT,
  product_name      TEXT NOT NULL,
  ordered_quantity  NUMERIC NOT NULL DEFAULT 0 CHECK (ordered_quantity >= 0),
  unit              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'partially_received', 'received', 'closed')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX repair_order_lines_repair_order_idx ON public.repair_order_lines (repair_order_id) WHERE deleted_at IS NULL;
CREATE INDEX repair_order_lines_variant_idx ON public.repair_order_lines (variant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.repair_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_order_lines_select ON public.repair_order_lines
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_lines.repair_order_id
        AND ro.deleted_at IS NULL
        AND public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.read')
    )
  );

CREATE POLICY repair_order_lines_insert ON public.repair_order_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_lines.repair_order_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
          OR (
            public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
            AND ro.advisor_contact_id IN (SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid()))
          )
        )
    )
  );

CREATE POLICY repair_order_lines_update ON public.repair_order_lines
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_lines.repair_order_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
          OR (
            public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
            AND ro.advisor_contact_id IN (SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid()))
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_lines.repair_order_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
          OR (
            public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
            AND ro.advisor_contact_id IN (SELECT id FROM public.crm_contacts WHERE linked_user_id = (SELECT auth.uid()))
          )
        )
    )
  );

CREATE POLICY repair_order_lines_delete_deny ON public.repair_order_lines
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- PART 5: workshop_source_documents (Tier 1, FORCE RLS, direct columns --
-- Correction 3: many-to-many source-document identity)
-- ---------------------------------------------------------------------------
CREATE TABLE public.workshop_source_documents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id                 UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  document_type             TEXT NOT NULL CHECK (document_type IN ('zl', 'zw', 'wdd')),
  external_document_number  TEXT NOT NULL,
  source_session_id         UUID NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  official_warehouse_code   TEXT,
  block_id                  UUID REFERENCES public.wdd_matcher_blocks(id) ON DELETE SET NULL,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Corrected natural key (final clarification pass): includes source_session_id
-- because content legitimately varies 37-51% of the time across sessions
-- sharing the same external_document_number (LIVE VERIFIED, see architecture doc).
CREATE UNIQUE INDEX workshop_source_documents_natural_key
  ON public.workshop_source_documents (organization_id, branch_id, document_type, external_document_number, source_session_id);

CREATE INDEX workshop_source_documents_org_branch_idx ON public.workshop_source_documents (organization_id, branch_id);
CREATE INDEX workshop_source_documents_session_idx ON public.workshop_source_documents (source_session_id);

ALTER TABLE public.workshop_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_source_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY workshop_source_documents_select ON public.workshop_source_documents
  FOR SELECT
  USING (public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.read'));

CREATE POLICY workshop_source_documents_insert ON public.workshop_source_documents
  FOR INSERT
  WITH CHECK (
    public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_own')
    OR public.has_branch_permission(organization_id, branch_id, 'workshop.repair_orders.manage_all')
  );

-- No UPDATE policy: source documents are immutable once created (Matcher
-- provenance rule -- corrections go through an explicit reconcile action in a
-- later phase, never an UPDATE on this table).
CREATE POLICY workshop_source_documents_delete_deny ON public.workshop_source_documents
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- PART 6: repair_order_source_document_links (link table, join-derived scope)
-- ---------------------------------------------------------------------------
CREATE TABLE public.repair_order_source_document_links (
  repair_order_id            UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  workshop_source_document_id UUID NOT NULL REFERENCES public.workshop_source_documents(id) ON DELETE CASCADE,
  linked_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by                  UUID REFERENCES public.users(id),

  PRIMARY KEY (repair_order_id, workshop_source_document_id)
);

CREATE INDEX repair_order_source_document_links_document_idx
  ON public.repair_order_source_document_links (workshop_source_document_id);

ALTER TABLE public.repair_order_source_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_source_document_links FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_order_source_document_links_select ON public.repair_order_source_document_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_source_document_links.repair_order_id
        AND ro.deleted_at IS NULL
        AND public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.read')
    )
  );

CREATE POLICY repair_order_source_document_links_insert ON public.repair_order_source_document_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_source_document_links.repair_order_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
          OR public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
        )
    )
  );

CREATE POLICY repair_order_source_document_links_delete ON public.repair_order_source_document_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_orders ro
      WHERE ro.id = repair_order_source_document_links.repair_order_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
          OR public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- PART 7: workshop_source_document_lines (child of workshop_source_documents,
-- join-derived scope -- Correction 4: durable source-line provenance)
-- ---------------------------------------------------------------------------
CREATE TABLE public.workshop_source_document_lines (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_source_document_id UUID NOT NULL REFERENCES public.workshop_source_documents(id) ON DELETE CASCADE,
  wdd_matcher_line_id         UUID REFERENCES public.wdd_matcher_lines(id) ON DELETE SET NULL,

  product_code                TEXT,
  product_name                TEXT,
  quantity                    NUMERIC NOT NULL CHECK (quantity > 0),
  unit                        TEXT,
  raw_text                    TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workshop_source_document_lines_document_idx
  ON public.workshop_source_document_lines (workshop_source_document_id);
CREATE INDEX workshop_source_document_lines_matcher_line_idx
  ON public.workshop_source_document_lines (wdd_matcher_line_id);

ALTER TABLE public.workshop_source_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_source_document_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY workshop_source_document_lines_select ON public.workshop_source_document_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workshop_source_documents wsd
      WHERE wsd.id = workshop_source_document_lines.workshop_source_document_id
        AND public.has_branch_permission(wsd.organization_id, wsd.branch_id, 'workshop.repair_orders.read')
    )
  );

CREATE POLICY workshop_source_document_lines_insert ON public.workshop_source_document_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workshop_source_documents wsd
      WHERE wsd.id = workshop_source_document_lines.workshop_source_document_id
        AND (
          public.has_branch_permission(wsd.organization_id, wsd.branch_id, 'workshop.repair_orders.manage_own')
          OR public.has_branch_permission(wsd.organization_id, wsd.branch_id, 'workshop.repair_orders.manage_all')
        )
    )
  );

CREATE POLICY workshop_source_document_lines_delete_deny ON public.workshop_source_document_lines
  FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- PART 8: repair_order_line_source_links (link table, join-derived scope)
-- ---------------------------------------------------------------------------
CREATE TABLE public.repair_order_line_source_links (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_line_id            UUID NOT NULL REFERENCES public.repair_order_lines(id) ON DELETE CASCADE,
  workshop_source_document_line_id UUID NOT NULL REFERENCES public.workshop_source_document_lines(id) ON DELETE CASCADE,
  quantity_contribution           NUMERIC NOT NULL CHECK (quantity_contribution > 0),
  linked_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Default policy (architecture doc Correction 4): a given source line links
  -- to exactly one logical line. Revisit only if a concrete counter-example
  -- requires a source line to split across logical lines.
  CONSTRAINT repair_order_line_source_links_source_line_unique UNIQUE (workshop_source_document_line_id)
);

CREATE INDEX repair_order_line_source_links_line_idx ON public.repair_order_line_source_links (repair_order_line_id);

ALTER TABLE public.repair_order_line_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_line_source_links FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_order_line_source_links_select ON public.repair_order_line_source_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = repair_order_line_source_links.repair_order_line_id
        AND public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.read')
    )
  );

CREATE POLICY repair_order_line_source_links_insert ON public.repair_order_line_source_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = repair_order_line_source_links.repair_order_line_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
          OR public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
        )
    )
  );

CREATE POLICY repair_order_line_source_links_delete ON public.repair_order_line_source_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = repair_order_line_source_links.repair_order_line_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_own')
          OR public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.manage_all')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- PART 9: repair_order_line_movement_links (link table, join-derived scope --
-- Correction 5: durable line-level movement linkage)
-- ---------------------------------------------------------------------------
CREATE TABLE public.repair_order_line_movement_links (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_line_id      UUID NOT NULL REFERENCES public.repair_order_lines(id) ON DELETE CASCADE,
  inventory_movement_line_id UUID NOT NULL REFERENCES public.inventory_movement_lines(id) ON DELETE CASCADE,
  applied_quantity          NUMERIC NOT NULL CHECK (applied_quantity > 0),
  relation_type             TEXT NOT NULL CHECK (relation_type IN ('receipt', 'issue', 'reversal')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT repair_order_line_movement_links_unique
    UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)
);

CREATE INDEX repair_order_line_movement_links_line_idx ON public.repair_order_line_movement_links (repair_order_line_id);
CREATE INDEX repair_order_line_movement_links_movement_line_idx ON public.repair_order_line_movement_links (inventory_movement_line_id);

ALTER TABLE public.repair_order_line_movement_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_line_movement_links FORCE ROW LEVEL SECURITY;

CREATE POLICY repair_order_line_movement_links_select ON public.repair_order_line_movement_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = repair_order_line_movement_links.repair_order_line_id
        AND public.has_branch_permission(ro.organization_id, ro.branch_id, 'workshop.repair_orders.read')
    )
  );

-- INSERT is gated by warehouse permissions, not workshop ownership -- receiving
-- and issuing against a RepairOrderLine is an inventory-side action performed
-- by warehouse staff, distinct from advisor ownership of the order itself
-- (architecture doc: "advisor ownership never implies warehouse permissions").
CREATE POLICY repair_order_line_movement_links_insert ON public.repair_order_line_movement_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repair_order_lines rol
      JOIN public.repair_orders ro ON ro.id = rol.repair_order_id
      WHERE rol.id = repair_order_line_movement_links.repair_order_line_id
        AND (
          public.has_branch_permission(ro.organization_id, ro.branch_id, 'warehouse.inventory.operate')
          OR public.has_branch_permission(ro.organization_id, ro.branch_id, 'warehouse.inventory.adjust')
        )
    )
  );

CREATE POLICY repair_order_line_movement_links_delete_deny ON public.repair_order_line_movement_links
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.repair_orders IS 'Zone 3 RepairOrder header. Business identity = organization_id+branch_id+zl_number (see repair_orders_identity_unique). order_number is descriptive only.';
COMMENT ON TABLE public.workshop_source_documents IS 'Zone 3: one row per distinct source-document occurrence (ZL/ZW/WDD, session-scoped). Natural key includes source_session_id -- see workshop_source_documents_natural_key.';
COMMENT ON TABLE public.repair_order_line_movement_links IS 'Zone 3: durable line-level linkage to inventory_movement_lines. received/issued/outstanding/available quantities MUST be derived via SUM(applied_quantity) GROUP BY relation_type, never stored as mutable counters.';
