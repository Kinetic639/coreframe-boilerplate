-- ===========================================================================
-- Harden Planning Kanban permissions
-- ===========================================================================
-- The first Kanban migration added the concrete permission slugs and role
-- grants, but existing compiled user permission snapshots may not include the
-- new board permissions until a role assignment changes. Recompile active org
-- memberships so sidebar/page gates see planning.boards.* immediately.

INSERT INTO public.permissions (slug, name, category, action)
VALUES
  ('planning.boards.read',   'Planning Boards Read',   'planning', 'read'),
  ('planning.boards.create', 'Planning Boards Create', 'planning', 'create'),
  ('planning.boards.update', 'Planning Boards Update', 'planning', 'update'),
  ('planning.boards.delete', 'Planning Boards Delete', 'planning', 'delete')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_owner_id  UUID;
  v_member_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM public.roles WHERE name = 'org_owner' AND is_basic = true LIMIT 1;
  SELECT id INTO v_member_id FROM public.roles WHERE name = 'org_member' AND is_basic = true LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_id, p.id
    FROM public.permissions p
    WHERE p.slug = 'planning.*'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_member_id, p.id
    FROM public.permissions p
    WHERE p.slug IN (
      'planning.boards.read',
      'planning.boards.create',
      'planning.boards.update'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

DO $$
DECLARE
  membership RECORD;
BEGIN
  FOR membership IN
    SELECT DISTINCT user_id, organization_id
    FROM public.organization_members
    WHERE status = 'active'
      AND deleted_at IS NULL
  LOOP
    PERFORM public.compile_user_permissions(membership.user_id, membership.organization_id);
  END LOOP;
END;
$$;
