-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Invitation names + normalized role assignments + eligibility RPC
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Changes:
--   1. invitations: add invited_first_name, invited_last_name columns
--   2. invitation_role_assignments: new normalized table (1 row per role+scope)
--   3. check_invitation_eligibility RPC: server-side eligibility gating
--   4. accept_invitation_and_join_org: copy IRA rows atomically (legacy fallback kept)
--   5. get_invitation_preview_by_token: expose invited names + IRA role summary

-- ── 1. Invited name columns ──────────────────────────────────────────────────
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invited_first_name TEXT,
  ADD COLUMN IF NOT EXISTS invited_last_name  TEXT;

-- ── 2. invitation_role_assignments table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitation_role_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES public.roles(id)       ON DELETE RESTRICT,
  scope         TEXT NOT NULL CHECK (scope IN ('org', 'branch')),
  scope_id      UUID,           -- NULL for org-scope (invitation carries org_id implicitly)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ira_invitation_id_idx ON public.invitation_role_assignments (invitation_id);

-- RLS
ALTER TABLE public.invitation_role_assignments ENABLE ROW LEVEL SECURITY;

-- Inviter (has INVITES_READ) can see IRA rows for their org
CREATE POLICY "ira_select_org_admin"
  ON public.invitation_role_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invitations i
      WHERE i.id = invitation_id
        AND i.organization_id IS NOT NULL
        AND public.has_permission(i.organization_id, 'invites.read')
    )
  );

-- Inviter (has INVITES_CREATE) can insert IRA rows (via service, SECURITY DEFINER RPC)
-- Direct insert also allowed for the service layer running as authed user
CREATE POLICY "ira_insert_org_admin"
  ON public.invitation_role_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invitations i
      WHERE i.id = invitation_id
        AND i.organization_id IS NOT NULL
        AND public.has_permission(i.organization_id, 'invites.create')
    )
  );

-- Delete is handled via CASCADE on invitation cancel (no direct delete policy needed)
-- Allow service-layer deletes via the RPC (SECURITY DEFINER bypasses RLS)

-- ── 3. check_invitation_eligibility RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_invitation_eligibility(
  p_org_id    UUID,
  p_email     TEXT,
  p_inviter_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_norm_email TEXT := lower(trim(p_email));
BEGIN
  -- 1. Self-invite check
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_inviter_id
      AND lower(email) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'SELF_INVITE');
  END IF;

  -- 2. Already an active member of this org
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.organization_id = p_org_id
      AND om.status = 'active'
      AND om.deleted_at IS NULL
      AND lower(u.email) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'ALREADY_MEMBER');
  END IF;

  -- 3. Already has a pending invite for this org
  IF EXISTS (
    SELECT 1 FROM public.invitations
    WHERE organization_id = p_org_id
      AND lower(email)    = v_norm_email
      AND status          = 'pending'
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'DUPLICATE_PENDING');
  END IF;

  RETURN jsonb_build_object('eligible', true);
END;
$fn$;

-- ── 4. accept_invitation_and_join_org — copy IRA rows atomically ──────────────
CREATE OR REPLACE FUNCTION public.accept_invitation_and_join_org(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_invitation        public.invitations%ROWTYPE;
  v_current_user_id   UUID;
  v_current_email     TEXT;
  v_org_member_role_id UUID;
  v_ira               RECORD;
BEGIN
  -- ── 1. Authenticate caller ──────────────────────────────────────────────────
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT email INTO v_current_email
    FROM auth.users
    WHERE id = v_current_user_id;

  IF v_current_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND');
  END IF;

  -- ── 2. Resolve org_member role dynamically ──────────────────────────────────
  SELECT id INTO v_org_member_role_id
    FROM public.roles
    WHERE name = 'org_member'
      AND is_basic = true
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_org_member_role_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
  END IF;

  -- ── 3. Lock and validate invitation ────────────────────────────────────────
  SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_FOUND');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_NOT_PENDING');
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITE_EXPIRED');
  END IF;

  IF lower(v_invitation.email) != lower(v_current_email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH');
  END IF;

  -- ── 4. Ensure public.users row exists ───────────────────────────────────────
  INSERT INTO public.users (id, email, created_at)
    VALUES (v_current_user_id, v_current_email, now())
    ON CONFLICT (id) DO NOTHING;

  -- Apply invited names to public.users if they are still empty
  IF v_invitation.invited_first_name IS NOT NULL OR v_invitation.invited_last_name IS NOT NULL THEN
    UPDATE public.users
      SET first_name = COALESCE(NULLIF(first_name, ''), v_invitation.invited_first_name),
          last_name  = COALESCE(NULLIF(last_name,  ''), v_invitation.invited_last_name)
      WHERE id = v_current_user_id;
  END IF;

  -- ── 5. Create / reactivate org membership ──────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
    VALUES (v_invitation.organization_id, v_current_user_id, 'active', now())
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status     = 'active',
          deleted_at = NULL,
          updated_at = now();

  -- ── 6. Assign org_member baseline role ─────────────────────────────────────
  INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (v_current_user_id, v_org_member_role_id, 'org', v_invitation.organization_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
      SET deleted_at = NULL;

  -- ── 7. Copy invitation_role_assignments → user_role_assignments ─────────────
  -- Skip rows where the role has been deleted or scope_type is incompatible.
  -- Each IRA row: scope='org' means scope_id=org_id, scope='branch' means scope_id=branch.
  FOR v_ira IN
    SELECT ira.role_id,
           ira.scope,
           CASE ira.scope
             WHEN 'org'    THEN v_invitation.organization_id
             WHEN 'branch' THEN ira.scope_id
           END AS resolved_scope_id,
           r.scope_type
      FROM public.invitation_role_assignments ira
      JOIN public.roles r ON r.id = ira.role_id AND r.deleted_at IS NULL
     WHERE ira.invitation_id = v_invitation.id
  LOOP
    -- Validate scope compatibility
    IF (v_ira.scope = 'org' AND v_ira.scope_type NOT IN ('org', 'both')) THEN
      CONTINUE;
    END IF;
    IF (v_ira.scope = 'branch' AND v_ira.scope_type NOT IN ('branch', 'both')) THEN
      CONTINUE;
    END IF;
    -- Skip if branch scope_id is null (misconfigured IRA)
    IF v_ira.scope = 'branch' AND v_ira.resolved_scope_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
      VALUES (v_current_user_id, v_ira.role_id, v_ira.scope, v_ira.resolved_scope_id)
      ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
        SET deleted_at = NULL;
  END LOOP;

  -- ── 8. Legacy fallback: single role_id/branch_id on invitation ──────────────
  -- Only used when no IRA rows exist (old invitations created before this migration)
  IF NOT EXISTS (
    SELECT 1 FROM public.invitation_role_assignments WHERE invitation_id = v_invitation.id
  ) AND v_invitation.role_id IS NOT NULL THEN
    DECLARE
      v_legacy_role_scope_type TEXT;
    BEGIN
      SELECT scope_type INTO v_legacy_role_scope_type
        FROM public.roles
        WHERE id = v_invitation.role_id AND deleted_at IS NULL;

      IF v_legacy_role_scope_type IS NOT NULL THEN
        -- Org-scope assignment
        IF v_legacy_role_scope_type IN ('org', 'both') THEN
          INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
            VALUES (v_current_user_id, v_invitation.role_id, 'org', v_invitation.organization_id)
            ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
              SET deleted_at = NULL;
        END IF;
        -- Branch-scope assignment
        IF v_legacy_role_scope_type IN ('branch', 'both') AND v_invitation.branch_id IS NOT NULL THEN
          INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
            VALUES (v_current_user_id, v_invitation.role_id, 'branch', v_invitation.branch_id)
            ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE
              SET deleted_at = NULL;
        END IF;
      END IF;
    END;
  END IF;

  -- ── 9. Update user_preferences → invited org becomes active context ─────────
  INSERT INTO public.user_preferences (user_id, organization_id, created_at)
    VALUES (v_current_user_id, v_invitation.organization_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET organization_id   = v_invitation.organization_id,
          default_branch_id = NULL,
          last_branch_id    = NULL,
          updated_at        = now();

  -- ── 10. Mark invitation accepted ────────────────────────────────────────────
  UPDATE public.invitations
    SET status      = 'accepted',
        accepted_at = now()
    WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success',         true,
    'organization_id', v_invitation.organization_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error_code', 'INTERNAL_ERROR');
END;
$function$;

-- ── 5. get_invitation_preview_by_token — include invited names + IRA summary ──
CREATE OR REPLACE FUNCTION public.get_invitation_preview_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_inv          public.invitations%ROWTYPE;
  v_org_name     TEXT;
  v_role_name    TEXT;
  v_branch_name  TEXT;
  v_reason_code  TEXT;
  v_ira_summary  TEXT;
BEGIN
  SELECT * INTO v_inv
    FROM public.invitations
    WHERE token = p_token
      AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason_code', 'INVITE_NOT_FOUND');
  END IF;

  -- Map status to reason code
  v_reason_code := CASE v_inv.status
    WHEN 'pending'   THEN
      CASE WHEN v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()
           THEN 'INVITE_EXPIRED'
           ELSE 'INVITE_PENDING'
      END
    WHEN 'accepted'  THEN 'INVITE_ACCEPTED'
    WHEN 'declined'  THEN 'INVITE_DECLINED'
    WHEN 'cancelled' THEN 'INVITE_CANCELLED'
    ELSE 'INVITE_INVALID'
  END;

  -- Org name
  SELECT op.name INTO v_org_name
    FROM public.organization_profiles op
    WHERE op.organization_id = v_inv.organization_id
    LIMIT 1;

  -- Role name: prefer IRA summary (comma-separated), fall back to legacy role_id
  SELECT string_agg(r.name, ', ' ORDER BY r.name) INTO v_ira_summary
    FROM public.invitation_role_assignments ira
    JOIN public.roles r ON r.id = ira.role_id AND r.deleted_at IS NULL
    WHERE ira.invitation_id = v_inv.id;

  IF v_ira_summary IS NOT NULL AND v_ira_summary != '' THEN
    v_role_name := v_ira_summary;
  ELSIF v_inv.role_id IS NOT NULL THEN
    SELECT name INTO v_role_name FROM public.roles WHERE id = v_inv.role_id AND deleted_at IS NULL;
  END IF;

  -- Branch name: from legacy branch_id (IRA branch scope_ids resolved separately if needed)
  IF v_inv.branch_id IS NOT NULL THEN
    SELECT name INTO v_branch_name FROM public.branches WHERE id = v_inv.branch_id;
  END IF;

  RETURN jsonb_build_object(
    'reason_code',        v_reason_code,
    'status',             v_inv.status,
    'expires_at',         v_inv.expires_at,
    'invited_email',      v_inv.email,
    'invited_first_name', v_inv.invited_first_name,
    'invited_last_name',  v_inv.invited_last_name,
    'org_name',           v_org_name,
    'role_name',          v_role_name,
    'branch_name',        v_branch_name
  );
END;
$fn$;
