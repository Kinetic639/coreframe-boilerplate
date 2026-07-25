-- Fix handle_user_signup_hook: check role scope_type before assigning invited role at org scope.
-- Root cause: inserting a branch-scoped role at scope='org' triggered validate_role_assignment_scope,
-- raising an exception that rolled back ALL changes (public.users, org membership, role assignments).
-- The user was left with only an auth.users row and no org setup.

CREATE OR REPLACE FUNCTION public.handle_user_signup_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_id uuid;
  user_email text;
  user_first_name text;
  user_last_name text;
  invitation_token text;
  invitation_record RECORD;
  org_owner_role_id uuid;
  org_member_role_id CONSTANT uuid := 'fc5d6871-e442-4e49-94bd-4668b3dde4f7';
  new_org_id uuid;
  new_org_slug text;
  default_branch_id uuid;
  org_name text;
  attempt_count integer := 0;
  max_attempts integer := 5;
  base_slug text;
BEGIN
  user_id := (event->>'user_id')::uuid;
  user_email := event->>'email';
  user_first_name := COALESCE(event->'user_metadata'->>'first_name', '');
  user_last_name := COALESCE(event->'user_metadata'->>'last_name', '');
  invitation_token := event->'user_metadata'->>'invitation_token';

  RAISE LOG 'Processing user signup: % (%) with invitation: %',
    user_email, user_id, COALESCE(invitation_token, 'none');

  INSERT INTO public.users (id, email, first_name, last_name, created_at)
  VALUES (user_id, user_email, user_first_name, user_last_name, now())
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name;

  RAISE LOG 'Created user record in public.users for %', user_id;

  -- INVITATION PATH
  IF invitation_token IS NOT NULL AND invitation_token != '' THEN
    RAISE LOG 'Processing invitation-based registration for token: %', invitation_token;

    SELECT i.id,
           i.organization_id,
           i.branch_id,
           i.email,
           i.role_id,
           i.status,
           i.expires_at
    INTO   invitation_record
    FROM   public.invitations i
    WHERE  i.token       = invitation_token
      AND  i.status      = 'pending'
      AND  lower(i.email) = lower(user_email)
      AND  (i.expires_at IS NULL OR i.expires_at > now())
      AND  i.deleted_at  IS NULL;

    IF FOUND THEN
      RAISE LOG 'Valid invitation found for org: %', invitation_record.organization_id;

      INSERT INTO public.user_preferences (
        user_id, organization_id, default_branch_id, last_branch_id, created_at
      ) VALUES (
        user_id,
        invitation_record.organization_id,
        invitation_record.branch_id,
        invitation_record.branch_id,
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        organization_id   = EXCLUDED.organization_id,
        default_branch_id = EXCLUDED.default_branch_id,
        last_branch_id    = EXCLUDED.last_branch_id;

      INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
      VALUES (invitation_record.organization_id, user_id, 'active', now())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        status     = 'active',
        deleted_at = NULL,
        updated_at = now();

      INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
      VALUES (user_id, org_member_role_id, 'org', invitation_record.organization_id)
      ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE SET deleted_at = NULL;

      -- FIX: Assign invited role only at scopes allowed by the role's scope_type.
      -- Previously this block unconditionally inserted at scope='org', which triggered
      -- validate_role_assignment_scope for branch-scoped roles, rolling back all changes.
      IF invitation_record.role_id IS NOT NULL
         AND invitation_record.role_id != org_member_role_id
      THEN
        -- Org-scope: only if the role permits org-level assignment
        IF EXISTS (
          SELECT 1 FROM public.roles
          WHERE id = invitation_record.role_id
            AND scope_type IN ('org', 'both')
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
          VALUES (user_id, invitation_record.role_id, 'org', invitation_record.organization_id)
          ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE SET deleted_at = NULL;
        END IF;

        -- Branch-scope: only if the role permits branch-level assignment and a branch was specified
        IF invitation_record.branch_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.roles
          WHERE id = invitation_record.role_id
            AND scope_type IN ('branch', 'both')
            AND deleted_at IS NULL
        ) THEN
          INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
          VALUES (user_id, invitation_record.role_id, 'branch', invitation_record.branch_id)
          ON CONFLICT (user_id, role_id, scope, scope_id) DO UPDATE SET deleted_at = NULL;
        END IF;
      END IF;

      UPDATE public.invitations
      SET status      = 'accepted',
          accepted_at = now()
      WHERE id = invitation_record.id
        AND status = 'pending';

      RAISE LOG 'Invitation bootstrap completed for user %', user_id;
      RETURN event;

    ELSE
      RAISE LOG 'Invalid or expired invitation token, proceeding with regular registration';
    END IF;
  END IF;

  -- REGULAR REGISTRATION PATH
  RAISE LOG 'Processing regular registration for user %', user_id;

  IF user_first_name != '' THEN
    org_name  := user_first_name || '''s Organization';
    base_slug := lower(regexp_replace(user_first_name, '[^a-z0-9]+', '-', 'g'));
  ELSE
    org_name  := split_part(user_email, '@', 1) || '''s Organization';
    base_slug := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  END IF;

  base_slug := trim(base_slug, '-');

  IF base_slug = '' OR length(base_slug) < 2 THEN
    base_slug := 'user-org';
  END IF;

  new_org_slug := base_slug;

  WHILE attempt_count < max_attempts LOOP
    BEGIN
      INSERT INTO public.organizations (name, slug, created_by, created_at)
      VALUES (org_name, new_org_slug, user_id, now())
      RETURNING id INTO new_org_id;

      RAISE LOG 'Created organization % with slug %', new_org_id, new_org_slug;
      EXIT;

    EXCEPTION
      WHEN unique_violation THEN
        attempt_count := attempt_count + 1;
        new_org_slug  := base_slug || '-' || floor(random() * 10000)::text;

        IF attempt_count >= max_attempts THEN
          RAISE LOG 'Using fallback epoch slug';
          new_org_slug := base_slug || '-' || extract(epoch from now())::bigint::text;
          INSERT INTO public.organizations (name, slug, created_by, created_at)
          VALUES (org_name, new_org_slug, user_id, now())
          RETURNING id INTO new_org_id;
          EXIT;
        END IF;
    END;
  END LOOP;

  INSERT INTO public.organization_profiles (organization_id, name, slug, created_at)
  VALUES (new_org_id, org_name, new_org_slug, now());

  INSERT INTO public.branches (organization_id, name, slug, created_at)
  VALUES (new_org_id, 'Main Branch', 'main', now())
  RETURNING id INTO default_branch_id;

  RAISE LOG 'Created branch % for organization %', default_branch_id, new_org_id;

  INSERT INTO public.user_preferences (
    user_id, organization_id, default_branch_id, last_branch_id, created_at
  ) VALUES (
    user_id, new_org_id, default_branch_id, default_branch_id, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id   = EXCLUDED.organization_id,
    default_branch_id = EXCLUDED.default_branch_id,
    last_branch_id    = EXCLUDED.last_branch_id;

  INSERT INTO public.organization_members (organization_id, user_id, status, joined_at)
  VALUES (new_org_id, user_id, 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    status     = 'active',
    deleted_at = NULL,
    updated_at = now();

  RAISE LOG 'Created organization_members row for user % in org %', user_id, new_org_id;

  SELECT id INTO org_owner_role_id
  FROM public.roles
  WHERE name      = 'org_owner'
    AND is_basic  = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF org_owner_role_id IS NOT NULL THEN
    INSERT INTO public.user_role_assignments (user_id, role_id, scope, scope_id)
    VALUES (user_id, org_owner_role_id, 'org', new_org_id)
    ON CONFLICT (user_id, role_id, scope, scope_id) DO NOTHING;

    RAISE LOG 'Assigned org_owner role to user %', user_id;
  ELSE
    RAISE LOG 'Warning: org_owner role not found for user %', user_id;
  END IF;

  RAISE LOG 'Regular registration completed for user % with org %', user_id, new_org_id;
  RETURN event;

EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_user_signup_hook: % %', SQLSTATE, SQLERRM;
    RETURN event;
END;
$function$;
