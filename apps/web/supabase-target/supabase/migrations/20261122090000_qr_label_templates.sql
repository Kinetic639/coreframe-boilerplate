-- QR label templates (docs/QR_LABELS_PLAN.md, phase Q3)
--
-- * A template is a name plus a pointer to its current layout
--   (qr_label_layouts, immutable). Editing a template makes (or finds, by
--   hash) another layout and moves the pointer; earlier prints keep pointing
--   at the layout they really used.
-- * target_type says which objects the template is for (warehouse.location,
--   helpdesk.ticket, planning.task, inventory.container) or NULL for blank
--   labels / any object. At most one default per organization and type.
-- * The organization's default location label (warehouse_location_label_settings)
--   becomes the default template for warehouse.location.
-- * Layouts are recorded by the server through qr_label_layout_ensure()
--   (service role), after the caller's permission was checked.

-- ── 1. Templates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_label_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  target_type      TEXT        NULL CHECK (
    target_type IS NULL OR target_type IN (
      'warehouse.location', 'helpdesk.ticket', 'planning.task', 'inventory.container'
    )
  ),
  layout_id        UUID        NOT NULL REFERENCES public.qr_label_layouts(id),
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  created_by       UUID        NULL REFERENCES public.users(id),
  updated_by       UUID        NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS qrlt_org_idx
  ON public.qr_label_templates (organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS qrlt_layout_idx
  ON public.qr_label_templates (layout_id);

-- One default per organization and object type (NULL type counts as one type).
CREATE UNIQUE INDEX IF NOT EXISTS qrlt_one_default_idx
  ON public.qr_label_templates (organization_id, COALESCE(target_type, '*'))
  WHERE is_default AND deleted_at IS NULL;

ALTER TABLE public.qr_label_templates ENABLE ROW LEVEL SECURITY;

-- Every member may print with a template (e.g. location labels need only
-- warehouse.locations.read), so every member may read them.
DROP POLICY IF EXISTS qrlt_select ON public.qr_label_templates;
CREATE POLICY qrlt_select ON public.qr_label_templates
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

-- Designing templates needs qr.export; the location default can also be
-- edited by whoever manages locations (as with the old location setting).
DROP POLICY IF EXISTS qrlt_insert ON public.qr_label_templates;
CREATE POLICY qrlt_insert ON public.qr_label_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    has_permission(organization_id, 'qr.export')
    OR (target_type = 'warehouse.location'
        AND has_permission(organization_id, 'warehouse.locations.manage'))
  );

DROP POLICY IF EXISTS qrlt_update ON public.qr_label_templates;
CREATE POLICY qrlt_update ON public.qr_label_templates
  FOR UPDATE TO authenticated
  USING (
    has_permission(organization_id, 'qr.export')
    OR (target_type = 'warehouse.location'
        AND has_permission(organization_id, 'warehouse.locations.manage'))
  )
  WITH CHECK (
    has_permission(organization_id, 'qr.export')
    OR (target_type = 'warehouse.location'
        AND has_permission(organization_id, 'warehouse.locations.manage'))
  );

-- ── 2. Layouts readable by members (templates point at them) ─────────────
DROP POLICY IF EXISTS qrll_select_member ON public.qr_label_layouts;
CREATE POLICY qrll_select_member ON public.qr_label_layouts
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

-- ── 3. Print batches → template ──────────────────────────────────────────
ALTER TABLE public.qr_print_batches
  DROP CONSTRAINT IF EXISTS qr_print_batches_template_id_fkey;
ALTER TABLE public.qr_print_batches
  ADD CONSTRAINT qr_print_batches_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.qr_label_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS qr_print_batches_template_idx
  ON public.qr_print_batches (template_id) WHERE template_id IS NOT NULL;

-- ── 4. Layout lookup / insert (server only) ──────────────────────────────
-- Returns the id of the layout with this format + config, creating it the
-- first time. The caller (a server route or action) checks permissions.
CREATE OR REPLACE FUNCTION public.qr_label_layout_ensure(
  p_organization_id UUID,
  p_format          TEXT,
  p_config          JSONB,
  p_created_by      UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.qr_label_layouts (organization_id, format, config, created_by)
  VALUES (p_organization_id, p_format, p_config, p_created_by)
  ON CONFLICT ON CONSTRAINT qr_label_layouts_org_hash_key DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
      FROM public.qr_label_layouts
     WHERE organization_id = p_organization_id
       AND config_hash = md5(p_format || ':' || p_config::text);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.qr_label_layout_ensure(UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qr_label_layout_ensure(UUID, TEXT, JSONB, UUID) TO service_role;

-- ── 5. Set default (one call, so the unique index never sees two) ────────
CREATE OR REPLACE FUNCTION public.qr_label_template_set_default(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_org  UUID;
  v_type TEXT;
BEGIN
  SELECT organization_id, target_type INTO v_org, v_type
    FROM public.qr_label_templates
   WHERE id = p_template_id AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'template not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.qr_label_templates
     SET is_default = false, updated_at = now()
   WHERE organization_id = v_org
     AND target_type IS NOT DISTINCT FROM v_type
     AND is_default
     AND id <> p_template_id;

  UPDATE public.qr_label_templates
     SET is_default = true, updated_at = now()
   WHERE id = p_template_id;
END;
$$;

REVOKE ALL ON FUNCTION public.qr_label_template_set_default(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qr_label_template_set_default(UUID) TO authenticated;

-- ── 6. Location label setting → default location template ────────────────
INSERT INTO public.qr_label_layouts (organization_id, format, config)
SELECT s.organization_id, 'pdf', s.label_config
  FROM public.warehouse_location_label_settings s
ON CONFLICT ON CONSTRAINT qr_label_layouts_org_hash_key DO NOTHING;

INSERT INTO public.qr_label_templates (organization_id, name, target_type, layout_id, is_default)
SELECT s.organization_id, 'Lokalizacje', 'warehouse.location', l.id, true
  FROM public.warehouse_location_label_settings s
  JOIN public.qr_label_layouts l
    ON l.organization_id = s.organization_id
   AND l.config_hash = md5('pdf:' || s.label_config::text)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qr_label_templates t
    WHERE t.organization_id = s.organization_id
      AND t.target_type = 'warehouse.location'
      AND t.is_default AND t.deleted_at IS NULL
 );

-- ── 7. Tool name ─────────────────────────────────────────────────────────
UPDATE public.tools_catalog
   SET name = 'QR Label Generator',
       description = 'Design label templates and print QR labels as PDF or ZPL',
       updated_at = now()
 WHERE slug = 'qr-generator';
