-- =============================================================================
-- Migration: SVWMS WDD Matcher — tables, RLS, permissions, tools_catalog seed
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- =============================================================================
-- Schema overview:
--   wdd_matcher_sessions
--     └── wdd_matcher_session_files   (1 BC + 0..N brand + 0..M wdd per session)
--           └── wdd_matcher_blocks    (one per logical order block inside a file)
--                 └── wdd_matcher_lines  (one per product row inside a block)
--   wdd_matcher_block_matches         (block-level match; FK → sessions + two blocks)
--     └── wdd_matcher_line_matches    (line-level match; FK → block_match + two lines)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: Permission rows
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('wdd_matcher.read',    'WDD Matcher Read',    'wdd_matcher', 'read'),
  ('wdd_matcher.upload',  'WDD Matcher Upload',  'wdd_matcher', 'upload'),
  ('wdd_matcher.review',  'WDD Matcher Review',  'wdd_matcher', 'review'),
  ('wdd_matcher.approve', 'WDD Matcher Approve', 'wdd_matcher', 'approve')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 2: Role-permission seeding
-- org_owner  → all four permissions (no wildcard for wdd_matcher; granular grants)
-- org_member → wdd_matcher.read + wdd_matcher.upload + wdd_matcher.review
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
  v_read_id   UUID;
  v_upload_id UUID;
  v_review_id UUID;
  v_approve_id UUID;
BEGIN
  SELECT id INTO v_owner_id  FROM public.roles WHERE name = 'org_owner'  AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  SELECT id INTO v_read_id    FROM public.permissions WHERE slug = 'wdd_matcher.read';
  SELECT id INTO v_upload_id  FROM public.permissions WHERE slug = 'wdd_matcher.upload';
  SELECT id INTO v_review_id  FROM public.permissions WHERE slug = 'wdd_matcher.review';
  SELECT id INTO v_approve_id FROM public.permissions WHERE slug = 'wdd_matcher.approve';

  -- org_owner
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES
    (v_owner_id, v_read_id),
    (v_owner_id, v_upload_id),
    (v_owner_id, v_review_id),
    (v_owner_id, v_approve_id)
  ON CONFLICT DO NOTHING;

  -- org_member (no approve)
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES
    (v_member_id, v_read_id),
    (v_member_id, v_upload_id),
    (v_member_id, v_review_id)
  ON CONFLICT DO NOTHING;
END $$;

-- ---------------------------------------------------------------------------
-- PART 3: tools_catalog seed
-- ---------------------------------------------------------------------------
INSERT INTO public.tools_catalog (slug, name, description, category, icon_key, is_active, sort_order, metadata)
VALUES (
  'svwms-wdd-matcher',
  'SVWMS WDD Matcher',
  'Reconcile BC, Brand Relocation and WDD PDFs into a structured match report with block-level and line-level review.',
  'compliance',
  'file-diff',
  true,
  100,
  '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 4: wdd_matcher_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','ready_for_review','approved','rejected','failed')),
  match_summary   JSONB       NULL,
  created_by      UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by     UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wms_name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS wms_org_created_idx ON public.wdd_matcher_sessions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wms_org_status_idx  ON public.wdd_matcher_sessions (organization_id, status);

CREATE OR REPLACE TRIGGER wdd_matcher_sessions_updated_at
  BEFORE UPDATE ON public.wdd_matcher_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.wdd_matcher_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wms_select" ON public.wdd_matcher_sessions
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wms_insert" ON public.wdd_matcher_sessions
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

CREATE POLICY "wms_update" ON public.wdd_matcher_sessions
  FOR UPDATE USING (public.has_permission(organization_id, 'wdd_matcher.upload'));

-- ---------------------------------------------------------------------------
-- PART 5: wdd_matcher_session_files
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_session_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_role       TEXT        NOT NULL CHECK (file_role IN ('bc','brand','wdd')),
  file_path       TEXT        NULL,
  file_name       TEXT        NOT NULL,
  file_size       BIGINT      NOT NULL DEFAULT 0,
  brand_label     TEXT        NULL,
  parsed_at       TIMESTAMPTZ NULL,
  parse_error     TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wmsf_session_role_idx ON public.wdd_matcher_session_files (session_id, file_role);
CREATE INDEX IF NOT EXISTS wmsf_org_idx ON public.wdd_matcher_session_files (organization_id);

ALTER TABLE public.wdd_matcher_session_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wmsf_select" ON public.wdd_matcher_session_files
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wmsf_insert" ON public.wdd_matcher_session_files
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

CREATE POLICY "wmsf_update" ON public.wdd_matcher_session_files
  FOR UPDATE USING (public.has_permission(organization_id, 'wdd_matcher.upload'));

-- ---------------------------------------------------------------------------
-- PART 6: wdd_matcher_blocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_blocks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_file_id     UUID        NOT NULL REFERENCES public.wdd_matcher_session_files(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  block_index         INTEGER     NOT NULL,
  block_type          TEXT        NOT NULL CHECK (block_type IN ('wdd_reconciliation','direct_order','brand_order','wdd_source')),
  block_header_text   TEXT        NULL,
  warehouse_section   TEXT        NULL,
  brand_label         TEXT        NULL,
  from_section        TEXT        NULL,
  to_section          TEXT        NULL,
  is_excluded         BOOLEAN     NOT NULL DEFAULT false,
  page_number         INTEGER     NULL,
  metadata            JSONB       NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wmb_session_file_idx  ON public.wdd_matcher_blocks (session_file_id);
CREATE INDEX IF NOT EXISTS wmb_session_type_idx  ON public.wdd_matcher_blocks (session_id, block_type);
CREATE INDEX IF NOT EXISTS wmb_org_idx           ON public.wdd_matcher_blocks (organization_id);

ALTER TABLE public.wdd_matcher_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wmb_select" ON public.wdd_matcher_blocks
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wmb_insert" ON public.wdd_matcher_blocks
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

-- ---------------------------------------------------------------------------
-- PART 7: wdd_matcher_lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_lines (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID        NOT NULL REFERENCES public.wdd_matcher_blocks(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_number     INTEGER     NOT NULL,
  product_code    TEXT        NULL,
  product_name    TEXT        NULL,
  quantity        NUMERIC(15,4) NULL,
  unit            TEXT        NULL,
  raw_text        TEXT        NULL,
  page_number     INTEGER     NULL,
  metadata        JSONB       NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wml_block_idx  ON public.wdd_matcher_lines (block_id);
CREATE INDEX IF NOT EXISTS wml_session_idx ON public.wdd_matcher_lines (session_id);
CREATE INDEX IF NOT EXISTS wml_org_idx    ON public.wdd_matcher_lines (organization_id);

ALTER TABLE public.wdd_matcher_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wml_select" ON public.wdd_matcher_lines
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wml_insert" ON public.wdd_matcher_lines
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

-- ---------------------------------------------------------------------------
-- PART 8: wdd_matcher_block_matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_block_matches (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  organization_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bc_block_id           UUID        NULL REFERENCES public.wdd_matcher_blocks(id) ON DELETE SET NULL,
  brand_block_id        UUID        NULL REFERENCES public.wdd_matcher_blocks(id) ON DELETE SET NULL,
  wdd_block_id          UUID        NULL REFERENCES public.wdd_matcher_blocks(id) ON DELETE SET NULL,
  block_match_type      TEXT        NOT NULL CHECK (block_match_type IN ('exact','partial','unmatched_bc','unmatched_brand')),
  block_confidence      INTEGER     NOT NULL DEFAULT 0 CHECK (block_confidence BETWEEN 0 AND 100),
  block_match_reasons   JSONB       NULL DEFAULT '{}'::jsonb,
  review_status         TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (review_status IN ('pending','approved','rejected','skipped')),
  reviewed_by           UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ NULL,
  reviewer_notes        TEXT        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wmbm_session_type_idx   ON public.wdd_matcher_block_matches (session_id, block_match_type);
CREATE INDEX IF NOT EXISTS wmbm_session_status_idx ON public.wdd_matcher_block_matches (session_id, review_status);
CREATE INDEX IF NOT EXISTS wmbm_org_idx            ON public.wdd_matcher_block_matches (organization_id);

CREATE OR REPLACE TRIGGER wdd_matcher_block_matches_updated_at
  BEFORE UPDATE ON public.wdd_matcher_block_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wdd_matcher_block_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wmbm_select" ON public.wdd_matcher_block_matches
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wmbm_insert" ON public.wdd_matcher_block_matches
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

CREATE POLICY "wmbm_update" ON public.wdd_matcher_block_matches
  FOR UPDATE USING (public.has_permission(organization_id, 'wdd_matcher.review'));

-- ---------------------------------------------------------------------------
-- PART 9: wdd_matcher_line_matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wdd_matcher_line_matches (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  block_match_id      UUID        NOT NULL REFERENCES public.wdd_matcher_block_matches(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES public.wdd_matcher_sessions(id) ON DELETE CASCADE,
  organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bc_line_id          UUID        NULL REFERENCES public.wdd_matcher_lines(id) ON DELETE SET NULL,
  brand_line_id       UUID        NULL REFERENCES public.wdd_matcher_lines(id) ON DELETE SET NULL,
  wdd_line_id         UUID        NULL REFERENCES public.wdd_matcher_lines(id) ON DELETE SET NULL,
  line_match_type     TEXT        NOT NULL CHECK (line_match_type IN ('exact','partial','unmatched_bc','unmatched_brand')),
  line_confidence     INTEGER     NOT NULL DEFAULT 0 CHECK (line_confidence BETWEEN 0 AND 100),
  line_match_reasons  JSONB       NULL DEFAULT '{}'::jsonb,
  discrepancies       JSONB       NULL DEFAULT '[]'::jsonb,
  review_status       TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (review_status IN ('pending','approved','rejected','skipped')),
  reviewed_by         UUID        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ NULL,
  reviewer_notes      TEXT        NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wmlm_block_match_idx    ON public.wdd_matcher_line_matches (block_match_id);
CREATE INDEX IF NOT EXISTS wmlm_block_status_idx   ON public.wdd_matcher_line_matches (block_match_id, review_status);
CREATE INDEX IF NOT EXISTS wmlm_session_idx        ON public.wdd_matcher_line_matches (session_id);
CREATE INDEX IF NOT EXISTS wmlm_org_idx            ON public.wdd_matcher_line_matches (organization_id);

CREATE OR REPLACE TRIGGER wdd_matcher_line_matches_updated_at
  BEFORE UPDATE ON public.wdd_matcher_line_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.wdd_matcher_line_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wmlm_select" ON public.wdd_matcher_line_matches
  FOR SELECT USING (public.has_permission(organization_id, 'wdd_matcher.read'));

CREATE POLICY "wmlm_insert" ON public.wdd_matcher_line_matches
  FOR INSERT WITH CHECK (public.has_permission(organization_id, 'wdd_matcher.upload'));

CREATE POLICY "wmlm_update" ON public.wdd_matcher_line_matches
  FOR UPDATE USING (public.has_permission(organization_id, 'wdd_matcher.review'));
