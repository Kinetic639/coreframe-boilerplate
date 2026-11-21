-- QR codes registry (docs/QR_LABELS_PLAN.md, phase Q1)
--
-- * Print batches: every label print run that creates codes is one batch.
-- * Scan tracking: last_scanned_at + scan_count, written only by the server
--   (service role) through qr_record_scan().
-- * Expiry: a code that was never assigned and never scanned expires after
--   the organization's qr_settings.unused_expiry_days (default 180, 0 = off)
--   counted from unused_since, and is soft-deleted 90 days after that.
--   Existing codes start counting now, so nothing expires right after deploy. qr_expire_unused_codes() does
--   both; docs/QR_CODES_CRON_SETUP.md schedules it with pg_cron.
-- * Bulk soft delete / restore for the registry table (RPCs that check
--   qr.revoke themselves, because the SELECT policy hides deleted rows).

-- ── 1. Print batches ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_print_batches (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NULL CHECK (name IS NULL OR char_length(name) <= 120),
  quantity         INTEGER     NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  template_id      UUID        NULL,
  created_by       UUID        NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_print_batches_org_created_idx
  ON public.qr_print_batches (organization_id, created_at DESC);

ALTER TABLE public.qr_print_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qrpb_select ON public.qr_print_batches;
CREATE POLICY qrpb_select ON public.qr_print_batches
  FOR SELECT TO authenticated
  USING (has_permission(organization_id, 'qr.read'));

DROP POLICY IF EXISTS qrpb_insert ON public.qr_print_batches;
CREATE POLICY qrpb_insert ON public.qr_print_batches
  FOR INSERT TO authenticated
  WITH CHECK (has_permission(organization_id, 'qr.create'));

-- ── 2. qr_codes: batch, scans, expiry ────────────────────────────────────
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS batch_id        UUID        NULL REFERENCES public.qr_print_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS scan_count      INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expired_at      TIMESTAMPTZ NULL,
  -- When the expiry clock started: creation for new codes, this migration
  -- for existing ones (scans were not tracked before, so "never scanned"
  -- cannot be trusted for them), and the restore time after a restore.
  ADD COLUMN IF NOT EXISTS unused_since    TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.qr_codes DROP CONSTRAINT IF EXISTS qr_codes_status_check;
ALTER TABLE public.qr_codes
  ADD CONSTRAINT qr_codes_status_check CHECK (status IN ('active', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS qrc_batch_idx
  ON public.qr_codes (batch_id) WHERE batch_id IS NOT NULL;

-- Expiry sweep: active, never scanned codes by age.
CREATE INDEX IF NOT EXISTS qrc_unscanned_active_idx
  ON public.qr_codes (organization_id, unused_since)
  WHERE status = 'active' AND last_scanned_at IS NULL AND deleted_at IS NULL;

-- ── 3. Settings per organization ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qr_settings (
  organization_id     UUID        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  unused_expiry_days  INTEGER     NOT NULL DEFAULT 180 CHECK (unused_expiry_days BETWEEN 0 AND 3650),
  updated_by          UUID        NULL REFERENCES public.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qrs_select ON public.qr_settings;
CREATE POLICY qrs_select ON public.qr_settings
  FOR SELECT TO authenticated
  USING (has_permission(organization_id, 'qr.read'));

DROP POLICY IF EXISTS qrs_insert ON public.qr_settings;
CREATE POLICY qrs_insert ON public.qr_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_permission(organization_id, 'qr.revoke'));

DROP POLICY IF EXISTS qrs_update ON public.qr_settings;
CREATE POLICY qrs_update ON public.qr_settings
  FOR UPDATE TO authenticated
  USING (has_permission(organization_id, 'qr.revoke'))
  WITH CHECK (has_permission(organization_id, 'qr.revoke'));

-- ── 4. Scan recording (server only) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qr_record_scan(p_qr_code_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  UPDATE public.qr_codes
     SET last_scanned_at = now(),
         scan_count = scan_count + 1
   WHERE id = p_qr_code_id
     AND deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.qr_record_scan(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qr_record_scan(UUID) TO service_role;

-- ── 5. Expiry sweep (pg_cron, daily) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qr_expire_unused_codes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_expired INTEGER;
  v_deleted INTEGER;
BEGIN
  -- Never assigned (not even once), never scanned, older than the org's limit.
  UPDATE public.qr_codes c
     SET status = 'expired',
         expired_at = now(),
         updated_at = now()
    FROM (
      SELECT o.id AS organization_id, COALESCE(s.unused_expiry_days, 180) AS days
        FROM public.organizations o
        LEFT JOIN public.qr_settings s ON s.organization_id = o.id
    ) cfg
   WHERE c.organization_id = cfg.organization_id
     AND cfg.days > 0
     AND c.status = 'active'
     AND c.deleted_at IS NULL
     AND c.last_scanned_at IS NULL
     AND c.unused_since < now() - make_interval(days => cfg.days)
     AND NOT EXISTS (SELECT 1 FROM public.qr_assignments a WHERE a.qr_code_id = c.id);
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Expired for 90 days and still not restored: hide for good (soft delete).
  UPDATE public.qr_codes
     SET deleted_at = now(),
         updated_at = now()
   WHERE status = 'expired'
     AND deleted_at IS NULL
     AND expired_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('expired', v_expired, 'deleted', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.qr_expire_unused_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qr_expire_unused_codes() TO service_role;

-- ── 6. Registry bulk actions ─────────────────────────────────────────────
-- Soft delete: only codes with no active assignment (a label on a real
-- object must be revoked first). Returns the number of codes deleted.
CREATE OR REPLACE FUNCTION public.qr_codes_soft_delete(p_organization_id UUID, p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT has_permission(p_organization_id, 'qr.revoke') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.qr_codes c
     SET deleted_at = now(),
         updated_at = now()
   WHERE c.organization_id = p_organization_id
     AND c.id = ANY (p_ids)
     AND c.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.qr_assignments a
        WHERE a.qr_code_id = c.id AND a.revoked_at IS NULL
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qr_codes_soft_delete(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qr_codes_soft_delete(UUID, UUID[]) TO authenticated;

-- Restore expired codes to active (e.g. a found sheet of labels).
CREATE OR REPLACE FUNCTION public.qr_codes_restore(p_organization_id UUID, p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT has_permission(p_organization_id, 'qr.revoke') THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.qr_codes
     SET status = 'active',
         expired_at = NULL,
         -- Restart the clock so the next sweep does not expire it again at once.
         unused_since = now(),
         updated_at = now()
   WHERE organization_id = p_organization_id
     AND id = ANY (p_ids)
     AND status = 'expired'
     AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.qr_codes_restore(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qr_codes_restore(UUID, UUID[]) TO authenticated;
