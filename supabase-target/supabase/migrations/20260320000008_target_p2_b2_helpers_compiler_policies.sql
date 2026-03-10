-- ============================================================
-- TARGET Phase 1 — Batch 2 / File 8
-- Helper functions, permission compiler, compiler triggers,
-- and all RLS policies for Batch 2 tables.
-- ============================================================
-- Purpose      : Runtime permission evaluation layer.
--   Helper functions: used inline by RLS USING/WITH CHECK expressions.
--   compile_user_permissions(): write-time denormalization engine —
--     populates user_effective_permissions from role assignments,
--     role_permissions, and overrides.
--   Compiler triggers: fire on writes to the four input tables,
--     keeping user_effective_permissions always current.
--   RLS policies: all policies for the six Batch 2 tables are
--     created here, after helper functions are defined.
-- Dependencies : All tables from Files 6 and 7, plus
--               organization_members (Batch 1, File 4).
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. V1 RLS policies NOT ported:
--      - user_role_assignments: "Org admins view org role assignments"
--        (references is_org_creator, has_org_role — V1 only)
--      - user_effective_permissions: "Org owners can view member permissions"
--        (references has_org_role — V1 only)
--      Replacement: V2 policy "uep_select_members_read" using
--      has_permission(organization_id, 'members.read') added to
--      user_effective_permissions for admin visibility.
--
--   2. trigger_compile_on_role_permission() fans out only to org-scoped
--      role assignments (scope='org'). Branch-scoped users holding the
--      same role are NOT recompiled when a role_permission changes.
--      This matches LEGACY behavior exactly and is a documented
--      limitation: branch-role users see the updated permissions only
--      after the next compile trigger fires for them (e.g., membership
--      update or role assignment change).
--
--   3. trigger_membership_compile on organization_members was deferred
--      from Batch 1 File 4 (trigger function did not exist yet).
--      It is created here.
--
--   4. compile_user_permissions() uses pg_advisory_xact_lock() keyed
--      on hashtext(user_id || org_id) to prevent concurrent compilation
--      races. Mirrors LEGACY exactly.
--
--   5. supabase_auth_admin EXECUTE grants on hook functions
--      (handle_user_signup_hook, custom_access_token_hook) are
--      deferred to the batch that creates those functions.
--      No EXECUTE grants on hooks are added here.
--
--   6. All V2 user_role_assignments policies that were TO PUBLIC in
--      LEGACY are created TO authenticated in TARGET. LEGACY had
--      {public} (no TO clause) on branch-scope select, insert, update,
--      and delete policies. TARGET makes authentication explicit.
--      Functionally equivalent (is_org_member/has_permission always
--      return false for anon users since auth.uid() = NULL), but
--      explicit TO authenticated is the correct security posture —
--      unauthenticated requests are rejected before policy evaluation.
-- ============================================================

-- ============================================================
-- SECURITY NOTE: SECURITY DEFINER helpers and FORCE RLS
-- ============================================================
-- is_org_member(), has_permission(), and has_branch_permission()
-- are SECURITY DEFINER functions owned by postgres (superuser).
-- When they are called from within an RLS USING/WITH CHECK
-- expression, they run AS postgres, bypassing FORCE ROW LEVEL
-- SECURITY on the tables they query internally (organization_members,
-- user_effective_permissions).
--
-- This is SAFE and INTENTIONAL for the following reasons:
--
--   a. Each function has a hardened SET search_path that prevents
--      search_path injection attacks.
--
--   b. Each function returns only a boolean (EXISTS check) —
--      no row data is returned or exposed to the caller.
--
--   c. The logic is tightly scoped: each function checks exactly
--      one condition about auth.uid() relative to the given org/
--      branch/permission. There is no way to extract arbitrary data.
--
--   d. Without SECURITY DEFINER, these helper functions would need
--      to run as the authenticated user — which would require RLS
--      policies on organization_members and user_effective_permissions
--      to permit self-reads. Those policies could then be exploited
--      in complex ways. SECURITY DEFINER is the standard PostgreSQL
--      pattern for RLS helper functions precisely because it avoids
--      this circular dependency.
--
--   e. compile_user_permissions() is also SECURITY DEFINER and writes
--      to user_effective_permissions. It is called by triggers, never
--      directly by authenticated users. Triggers on FORCE RLS tables
--      run as the table owner (postgres superuser) by default, so
--      SECURITY DEFINER is consistent with that context.
--
-- Summary: SECURITY DEFINER on these specific, narrowly-scoped,
-- read-only (helpers) and write-only (compiler) functions is the
-- correct design. It does NOT create a security hole.
-- ============================================================

-- ============================================================
-- BRANCH-SCOPE SEMANTICS NOTE: user_role_assignments policies
-- ============================================================
-- For rows where scope='branch':
--   scope_id = the UUID of a specific branch (public.branches.id)
--   organization_id = NOT stored on the row — derived at query time:
--     SELECT b.organization_id FROM public.branches b
--     WHERE b.id = user_role_assignments.scope_id
--       AND b.deleted_at IS NULL
--
-- Implications:
--   - The subquery appears in multiple policy USING/WITH CHECK
--     expressions. It is evaluated per-row, not once per query.
--
--   - If a branch is soft-deleted (deleted_at IS NOT NULL), the
--     subquery returns NULL. has_permission(NULL, ...) and
--     has_branch_permission(NULL, ...) both return false. Effect:
--     role assignments on soft-deleted branches become invisible
--     through RLS but remain in the table for audit. This is the
--     intended behavior, matching LEGACY exactly.
--
--   - There is no branch_id column on user_role_assignments itself.
--     If a branch's organization_id were ever changed (not a normal
--     operation), existing branch-scope assignments would silently
--     appear to belong to the new org under RLS. This edge case is
--     acceptable given soft-delete-first design (org changes don't
--     happen) and is consistent with LEGACY.
--
--   - is_org_member() is called with the derived org_id to confirm
--     the acting user belongs to the same org as the branch, before
--     has_permission / has_branch_permission are checked.
-- ============================================================

-- ============================================================
-- is_org_member(org_id)
-- Returns true if the current auth user is an active, non-deleted
-- member of the given organization.
-- SQL, STABLE, SECURITY DEFINER, SET search_path = ''.
-- Mirrors LEGACY exactly.
-- ============================================================
create or replace function public.is_org_member(org_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id         = auth.uid()
      and status          = 'active'
      and deleted_at      is null
  );
$$;

-- ============================================================
-- has_permission(org_id, permission)
-- Returns true if the current auth user has the given concrete
-- permission slug at org scope (branch_id IS NULL) for the org.
-- Matches on permission_slug_exact only — wildcard patterns are
-- expanded by the compiler at write time, never at query time.
-- SQL, STABLE, SECURITY DEFINER, SET search_path TO 'public','pg_temp'.
-- Mirrors LEGACY exactly.
-- ============================================================
create or replace function public.has_permission(org_id uuid, permission text)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.user_effective_permissions
    where organization_id       = org_id
      and user_id               = auth.uid()
      and permission_slug_exact = permission
      and branch_id             is null
  );
$$;

-- ============================================================
-- has_branch_permission(p_org_id, p_branch_id, p_permission_slug)
-- Returns true if the current auth user has the given permission
-- for the specific branch OR org-wide (branch_id IS NULL).
-- Org-wide grants satisfy any branch-level check (inheritance).
-- SQL, STABLE, SECURITY DEFINER, SET search_path TO 'public','pg_temp'.
-- Mirrors LEGACY exactly.
-- ============================================================
create or replace function public.has_branch_permission(
  p_org_id          uuid,
  p_branch_id       uuid,
  p_permission_slug text)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.user_effective_permissions
    where user_id               = auth.uid()
      and organization_id       = p_org_id
      and permission_slug_exact = p_permission_slug
      and (
            branch_id is null          -- org-wide grant satisfies any branch check
        or  branch_id = p_branch_id    -- branch-specific grant for the exact branch
      )
  );
$$;

-- ============================================================
-- is_org_owner(p_org_id)
-- Returns true if the current auth user holds a role named
-- 'org_owner' (org-scoped, not deleted) for the given org.
-- Reads user_role_assignments + roles directly (not via UEP)
-- so it works before compilation and during the signup hook.
-- PL/pgSQL, SECURITY DEFINER, SET search_path = ''.
-- Mirrors LEGACY exactly.
-- ============================================================
create or replace function public.is_org_owner(p_org_id uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id    = auth.uid()
      and ura.scope      = 'org'
      and ura.scope_id   = p_org_id
      and r.name         = 'org_owner'
      and ura.deleted_at is null
      and r.deleted_at   is null
  );
end;
$$;

-- ============================================================
-- compile_user_permissions(p_user_id, p_organization_id)
-- Core permission compiler. Called by all four compiler triggers.
--
-- Algorithm:
--   1. Membership gate: if user is NOT an active org member,
--      DELETE all UEP rows for (user, org) and RETURN.
--   2. Advisory lock on hashtext(user_id || org_id) prevents
--      concurrent compilation races for the same (user, org).
--   3. DELETE all existing UEP rows for (user, org).
--   4. INSERT 1 — org-scoped permissions (branch_id = NULL):
--        Source A: org-scope role assignments (scope='org',
--          scope_id=p_organization_id), joined through
--          role_permissions → permissions. Wildcards expanded.
--        Source B: grant overrides (effect='grant'). Wildcards expanded.
--        Revoke overrides suppress Source A rows via NOT EXISTS.
--   5. INSERT 2 — branch-scoped permissions (branch_id IS NOT NULL):
--        Source: branch-scope role assignments (scope='branch')
--          where branch.organization_id = p_organization_id.
--          One row per (permission_slug_exact, branch_id).
--          Revoke overrides checked org-wide (matches LEGACY).
--   Both INSERTs use ON CONFLICT ON CONSTRAINT
--   user_effective_permissions_unique_v3 DO UPDATE (upsert).
--
-- Wildcard expansion:
--   Wildcard slug: p.slug LIKE '%*%'
--   Concrete target: p2.slug LIKE replace(p.slug, '*', '%')
--                    AND p2.slug NOT LIKE '%*%'
--                    AND p2.deleted_at IS NULL
--   Wildcard rows only emitted if at least one concrete match exists
--   (NOT p.slug LIKE '%*%' OR p2.slug IS NOT NULL).
--
-- PL/pgSQL, SECURITY DEFINER, SET search_path TO 'public','pg_temp'.
-- Mirrors LEGACY exactly.
-- ============================================================
create or replace function public.compile_user_permissions(
  p_user_id         uuid,
  p_organization_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
begin
  -- Membership gate: wipe permissions if user is not an active member.
  if not exists (
    select 1 from public.organization_members
    where user_id        = p_user_id
      and organization_id = p_organization_id
      and status          = 'active'
      and deleted_at      is null
  ) then
    delete from public.user_effective_permissions
    where user_id        = p_user_id
      and organization_id = p_organization_id;
    return;
  end if;

  -- Advisory lock: prevent concurrent compilation for same (user, org).
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text || p_organization_id::text)
  );

  -- Wipe existing compiled permissions for this (user, org).
  delete from public.user_effective_permissions
  where user_id        = p_user_id
    and organization_id = p_organization_id;

  -- ────────────────────────────────────────────────────────────
  -- INSERT 1: org-scoped permissions (branch_id = NULL)
  --   Source A: org-scope role assignments
  --   Source B: grant overrides
  --   Revoke overrides in Source A filtered by NOT EXISTS.
  -- ────────────────────────────────────────────────────────────
  insert into public.user_effective_permissions (
    user_id, organization_id, permission_slug, permission_slug_exact,
    source_type, branch_id, compiled_at
  )
  select distinct
    p_user_id, p_organization_id,
    base.permission_slug, base.permission_slug_exact,
    base.source_type, null::uuid, now()
  from (
    -- Source A: org-scope role assignments
    select
      p.slug                    as permission_slug,
      coalesce(p2.slug, p.slug) as permission_slug_exact,
      'role'                    as source_type
    from public.user_role_assignments ura
    join public.roles            r   on ura.role_id      = r.id
    join public.role_permissions rp  on r.id              = rp.role_id
                                     and rp.allowed       = true
    join public.permissions      p   on rp.permission_id  = p.id
    -- Wildcard expansion: find concrete slugs matching wildcard pattern
    left join public.permissions p2
      on  p.slug like '%*%'
      and p2.slug not like '%*%'
      and p2.deleted_at is null
      and p2.slug like replace(p.slug, '*', '%')
    where ura.user_id    = p_user_id
      and ura.scope      = 'org'
      and ura.scope_id   = p_organization_id
      and ura.deleted_at is null
      and r.deleted_at   is null
      and rp.deleted_at  is null
      and p.deleted_at   is null
      -- Wildcard rows only if at least one concrete match exists
      and (not p.slug like '%*%' or p2.slug is not null)
      -- Suppress row if a revoke override exists for this slug
      and not exists (
        select 1 from public.user_permission_overrides upo
        where upo.user_id        = p_user_id
          and upo.organization_id = p_organization_id
          and (upo.permission_slug = p.slug
               or upo.permission_slug = coalesce(p2.slug, p.slug))
          and upo.effect          = 'revoke'
          and upo.deleted_at      is null
      )

    union

    -- Source B: grant overrides (effect='grant')
    select
      upo.permission_slug                    as permission_slug,
      coalesce(p2.slug, upo.permission_slug) as permission_slug_exact,
      'override'                             as source_type
    from public.user_permission_overrides upo
    left join public.permissions p2
      on  upo.permission_slug like '%*%'
      and p2.slug not like '%*%'
      and p2.deleted_at is null
      and p2.slug like replace(upo.permission_slug, '*', '%')
    where upo.user_id        = p_user_id
      and upo.organization_id = p_organization_id
      and upo.effect          = 'grant'
      and upo.permission_slug is not null
      and upo.deleted_at      is null
      and (not upo.permission_slug like '%*%' or p2.slug is not null)
  ) as base
  on conflict on constraint user_effective_permissions_unique_v3
  do update set
    compiled_at     = now(),
    source_type     = excluded.source_type,
    permission_slug = excluded.permission_slug;

  -- ────────────────────────────────────────────────────────────
  -- INSERT 2: branch-scoped permissions (branch_id IS NOT NULL)
  --   Source: branch-scope role assignments where
  --   branch.organization_id = p_organization_id.
  --   Revoke overrides checked org-wide (matches LEGACY).
  -- ────────────────────────────────────────────────────────────
  insert into public.user_effective_permissions (
    user_id, organization_id, permission_slug, permission_slug_exact,
    source_type, branch_id, compiled_at
  )
  select distinct
    p_user_id, p_organization_id,
    base.permission_slug, base.permission_slug_exact,
    base.source_type, base.branch_id, now()
  from (
    select
      p.slug                    as permission_slug,
      coalesce(p2.slug, p.slug) as permission_slug_exact,
      'role'                    as source_type,
      ura.scope_id              as branch_id
    from public.user_role_assignments ura
    join public.roles            r   on ura.role_id      = r.id
    join public.role_permissions rp  on r.id              = rp.role_id
                                     and rp.allowed       = true
    join public.permissions      p   on rp.permission_id  = p.id
    -- Branch must belong to the target org and not be soft-deleted.
    join public.branches         b   on b.id              = ura.scope_id
                                     and b.deleted_at     is null
    left join public.permissions p2
      on  p.slug like '%*%'
      and p2.slug not like '%*%'
      and p2.deleted_at is null
      and p2.slug like replace(p.slug, '*', '%')
    where ura.user_id         = p_user_id
      and ura.scope           = 'branch'
      and b.organization_id   = p_organization_id
      and ura.deleted_at      is null
      and r.deleted_at        is null
      and rp.deleted_at       is null
      and p.deleted_at        is null
      and (not p.slug like '%*%' or p2.slug is not null)
      and not exists (
        select 1 from public.user_permission_overrides upo
        where upo.user_id        = p_user_id
          and upo.organization_id = p_organization_id
          and (upo.permission_slug = p.slug
               or upo.permission_slug = coalesce(p2.slug, p.slug))
          and upo.effect          = 'revoke'
          and upo.deleted_at      is null
      )
  ) as base
  on conflict on constraint user_effective_permissions_unique_v3
  do update set
    compiled_at     = now(),
    source_type     = excluded.source_type,
    permission_slug = excluded.permission_slug;

end;
$$;

-- ============================================================
-- trigger_compile_on_membership()
-- AFTER INSERT OR UPDATE OR DELETE on organization_members.
-- Compiles or wipes permissions based on membership status.
--   INSERT + active → compile
--   UPDATE, became inactive or deleted → wipe
--   UPDATE, became active → compile
--   UPDATE, org_id or user_id changed → wipe old, compile new
--   DELETE → wipe
-- SECURITY DEFINER, SET search_path = ''. Mirrors LEGACY.
-- ============================================================
create or replace function public.trigger_compile_on_membership()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' and new.deleted_at is null then
      perform public.compile_user_permissions(new.user_id, new.organization_id);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Handle org_id or user_id changes — prevents ghost permissions.
    if (old.organization_id <> new.organization_id) or (old.user_id <> new.user_id) then
      delete from public.user_effective_permissions
      where user_id        = old.user_id
        and organization_id = old.organization_id;
      if new.status = 'active' and new.deleted_at is null then
        perform public.compile_user_permissions(new.user_id, new.organization_id);
      end if;
      return new;
    end if;

    -- User became inactive or soft-deleted: wipe permissions.
    if (old.status = 'active' and new.status <> 'active')
       or (old.deleted_at is null and new.deleted_at is not null) then
      delete from public.user_effective_permissions
      where user_id        = new.user_id
        and organization_id = new.organization_id;
      return new;
    end if;

    -- User became active: compile permissions.
    if (old.status <> 'active' and new.status = 'active')
       or (old.deleted_at is not null and new.deleted_at is null) then
      perform public.compile_user_permissions(new.user_id, new.organization_id);
      return new;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from public.user_effective_permissions
    where user_id        = old.user_id
      and organization_id = old.organization_id;
    return old;
  end if;

  return new;
end;
$$;

-- ============================================================
-- trigger_compile_on_role_assignment()
-- AFTER INSERT OR UPDATE OR DELETE on user_role_assignments.
-- For org-scope: recompiles directly (scope_id = org_id).
-- For branch-scope: looks up branch.organization_id, then recompiles.
-- SECURITY DEFINER, SET search_path = ''. Mirrors LEGACY.
-- ============================================================
create or replace function public.trigger_compile_on_role_assignment()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.scope = 'org' then
      perform public.compile_user_permissions(old.user_id, old.scope_id);
    elsif old.scope = 'branch' then
      select organization_id into v_org_id
      from public.branches
      where id = old.scope_id;
      if v_org_id is not null then
        perform public.compile_user_permissions(old.user_id, v_org_id);
      end if;
    end if;
    return old;
  else
    if new.scope = 'org' then
      perform public.compile_user_permissions(new.user_id, new.scope_id);
    elsif new.scope = 'branch' then
      select organization_id into v_org_id
      from public.branches
      where id = new.scope_id;
      if v_org_id is not null then
        perform public.compile_user_permissions(new.user_id, v_org_id);
      end if;
    end if;
    return new;
  end if;
end;
$$;

-- ============================================================
-- trigger_compile_on_role_permission()
-- AFTER INSERT OR UPDATE OR DELETE on role_permissions.
-- Fan-out: recompiles all users who hold the affected role
-- at org scope (scope='org'). Branch-scope holders of the same
-- role are NOT recompiled here — this matches LEGACY behavior
-- and is a documented limitation (see deviation note 2).
-- SECURITY DEFINER, SET search_path = ''. Mirrors LEGACY.
-- ============================================================
create or replace function public.trigger_compile_on_role_permission()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_role_id    uuid;
  v_assignment record;
begin
  if tg_op = 'DELETE' then
    v_role_id := old.role_id;
  else
    v_role_id := new.role_id;
  end if;

  for v_assignment in
    select user_id, scope_id
    from public.user_role_assignments
    where role_id    = v_role_id
      and scope      = 'org'
      and deleted_at is null
  loop
    perform public.compile_user_permissions(v_assignment.user_id, v_assignment.scope_id);
  end loop;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- ============================================================
-- trigger_compile_on_override()
-- AFTER INSERT OR UPDATE OR DELETE on user_permission_overrides.
-- Only compiles when organization_id IS NOT NULL — global-scope
-- overrides (organization_id IS NULL) are not compiled per-org.
-- SECURITY DEFINER, SET search_path = ''. Mirrors LEGACY.
-- ============================================================
create or replace function public.trigger_compile_on_override()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.organization_id is not null then
      perform public.compile_user_permissions(old.user_id, old.organization_id);
    end if;
    return old;
  else
    if new.organization_id is not null then
      perform public.compile_user_permissions(new.user_id, new.organization_id);
    end if;
    return new;
  end if;
end;
$$;

-- ============================================================
-- COMPILER TRIGGERS
-- ============================================================

-- organization_members: deferred from Batch 1 File 4 because
-- trigger_compile_on_membership() did not exist until now.
create trigger trigger_membership_compile
  after insert or update or delete on public.organization_members
  for each row
  execute function public.trigger_compile_on_membership();

-- user_role_assignments: fires after any assignment write.
create trigger trigger_role_assignment_compile
  after insert or update or delete on public.user_role_assignments
  for each row
  execute function public.trigger_compile_on_role_assignment();

-- role_permissions: fans out to all affected org-scope users.
create trigger trigger_role_permission_compile
  after insert or update or delete on public.role_permissions
  for each row
  execute function public.trigger_compile_on_role_permission();

-- user_permission_overrides: recompiles affected (user, org).
create trigger trigger_override_compile
  after insert or update or delete on public.user_permission_overrides
  for each row
  execute function public.trigger_compile_on_override();

-- ============================================================
-- RLS POLICIES — permissions
-- SELECT only: permissions are a system-managed catalog.
-- Any authenticated user can read active permissions.
-- ============================================================
create policy "permissions_select_authenticated"
  on public.permissions
  for select
  to authenticated
  using (deleted_at is null);

-- ============================================================
-- RLS POLICIES — roles
-- Two SELECT policies cover the two role types.
-- Write policies require is_org_member + has_permission('members.manage').
-- One permissive + one restrictive UPDATE policy (both must pass).
-- ============================================================
create policy "roles_select_system"
  on public.roles
  for select
  to authenticated
  using (
    is_basic = true
    and organization_id is null
    and deleted_at is null
  );

create policy "roles_select_org"
  on public.roles
  for select
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
    and deleted_at is null
  );

create policy "roles_insert_permission"
  on public.roles
  for insert
  to authenticated
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );

-- Permissive UPDATE: user must be org member with members.manage.
create policy "roles_update_permission"
  on public.roles
  for update
  to authenticated
  using (
    organization_id is not null
    and is_basic = false
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and is_basic = false
  );

-- Restrictive UPDATE: additional mandatory gate (both must pass).
create policy "roles_update_restrictive_hardened"
  on public.roles
  as restrictive
  for update
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
  );

create policy "roles_delete_permission"
  on public.roles
  for delete
  to authenticated
  using (
    organization_id is not null
    and is_basic = false
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );

-- ============================================================
-- RLS POLICIES — role_permissions
-- SELECT: two policies cover system roles and org-custom roles.
-- Write: non-basic roles only, requires members.manage.
-- ============================================================
create policy "role_permissions_select_system"
  on public.role_permissions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.is_basic        = true
        and r.organization_id is null
        and r.deleted_at      is null
    )
    and deleted_at is null
  );

create policy "role_permissions_select_org"
  on public.role_permissions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.organization_id is not null
        and public.is_org_member(r.organization_id)
        and r.deleted_at      is null
    )
    and deleted_at is null
  );

create policy "role_permissions_insert_permission"
  on public.role_permissions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.organization_id is not null
        and r.is_basic        = false
        and public.is_org_member(r.organization_id)
        and public.has_permission(r.organization_id, 'members.manage')
        and r.deleted_at      is null
    )
    and deleted_at is null
  );

create policy "role_permissions_update_permission"
  on public.role_permissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.organization_id is not null
        and r.is_basic        = false
        and public.is_org_member(r.organization_id)
        and public.has_permission(r.organization_id, 'members.manage')
        and r.deleted_at      is null
    )
    and deleted_at is null
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.organization_id is not null
        and r.is_basic        = false
        and public.is_org_member(r.organization_id)
        and public.has_permission(r.organization_id, 'members.manage')
        and r.deleted_at      is null
    )
    and deleted_at is null
  );

create policy "role_permissions_delete_permission"
  on public.role_permissions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id              = role_permissions.role_id
        and r.organization_id is not null
        and r.is_basic        = false
        and public.is_org_member(r.organization_id)
        and public.has_permission(r.organization_id, 'members.manage')
        and r.deleted_at      is null
    )
    and deleted_at is null
  );

-- ============================================================
-- RLS POLICIES — user_role_assignments
--
-- All policies are TO authenticated (see deviation note 6).
-- LEGACY had {public} (no TO clause) on branch-scope and write
-- policies. TARGET makes authentication explicit on all policies.
--
-- Org-scope policy design:
--   scope_id IS the organization_id when scope='org'.
--   is_org_member(scope_id) and has_permission(scope_id, ...) are
--   called directly with scope_id.
--
-- Branch-scope policy design (see BRANCH-SCOPE SEMANTICS NOTE above):
--   scope_id IS the branch UUID when scope='branch'.
--   The org is derived per-row via subquery on branches.
--   Soft-deleted branches yield NULL org → policy returns false
--   (row invisible through RLS, still present for audit).
-- ============================================================

-- Self-view: users can always see their own role assignments.
create policy "View own role assignments"
  on public.user_role_assignments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- V2 org-scope view: org members with members.read see org assignments.
create policy "V2 view org role assignments"
  on public.user_role_assignments
  for select
  to authenticated
  using (
    scope = 'org'
    and public.is_org_member(scope_id)
    and public.has_permission(scope_id, 'members.read')
  );

-- V2 branch-scope view: members.read at org OR branch.roles.manage at branch.
-- TO authenticated (TARGET fix: LEGACY was TO PUBLIC — see deviation note 6).
create policy "V2 view branch role assignments"
  on public.user_role_assignments
  for select
  to authenticated
  using (
    scope = 'branch'
    and (
      public.has_permission(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null),
        'members.read'
      )
      or
      public.has_branch_permission(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null),
        scope_id,
        'branch.roles.manage'
      )
    )
  );

-- V2 assign roles: org path or branch path.
-- TO authenticated (TARGET fix: LEGACY was TO PUBLIC — see deviation note 6).
create policy "V2 assign roles"
  on public.user_role_assignments
  for insert
  to authenticated
  with check (
    (
      scope = 'org'
      and public.is_org_member(scope_id)
      and public.has_permission(scope_id, 'members.manage')
    )
    or
    (
      scope = 'branch'
      and public.is_org_member(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null)
      )
      and (
        public.has_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          'members.manage'
        )
        or
        public.has_branch_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          scope_id,
          'branch.roles.manage'
        )
      )
    )
  );

-- V2 update role assignments.
-- TO authenticated (TARGET fix: LEGACY was TO PUBLIC — see deviation note 6).
create policy "V2 update role assignments"
  on public.user_role_assignments
  for update
  to authenticated
  using (
    (
      scope = 'org'
      and public.is_org_member(scope_id)
      and public.has_permission(scope_id, 'members.manage')
    )
    or
    (
      scope = 'branch'
      and public.is_org_member(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null)
      )
      and (
        public.has_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          'members.manage'
        )
        or
        public.has_branch_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          scope_id,
          'branch.roles.manage'
        )
      )
    )
  )
  with check (
    (
      scope = 'org'
      and public.is_org_member(scope_id)
      and public.has_permission(scope_id, 'members.manage')
    )
    or
    (
      scope = 'branch'
      and public.is_org_member(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null)
      )
      and (
        public.has_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          'members.manage'
        )
        or
        public.has_branch_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          scope_id,
          'branch.roles.manage'
        )
      )
    )
  );

-- V2 delete role assignments.
-- TO authenticated (TARGET fix: LEGACY was TO PUBLIC — see deviation note 6).
create policy "V2 delete role assignments"
  on public.user_role_assignments
  for delete
  to authenticated
  using (
    (
      scope = 'org'
      and public.is_org_member(scope_id)
      and public.has_permission(scope_id, 'members.manage')
    )
    or
    (
      scope = 'branch'
      and public.is_org_member(
        (select b.organization_id from public.branches b
         where b.id = user_role_assignments.scope_id and b.deleted_at is null)
      )
      and (
        public.has_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          'members.manage'
        )
        or
        public.has_branch_permission(
          (select b.organization_id from public.branches b
           where b.id = user_role_assignments.scope_id and b.deleted_at is null),
          scope_id,
          'branch.roles.manage'
        )
      )
    )
  );

-- ============================================================
-- RLS POLICIES — user_effective_permissions
-- V1 "Org owners can view member permissions" NOT ported
-- (references has_org_role). Replaced by V2 policy below.
-- ============================================================

-- Self-view: users can see their own compiled permissions.
create policy "Users can view own effective permissions"
  on public.user_effective_permissions
  for select
  to authenticated
  using (user_id = auth.uid());

-- V2 admin view: org members with members.read can see any member's
-- effective permissions. Replaces V1 "Org owners can view member
-- permissions" which used has_org_role (not available in TARGET).
create policy "uep_select_members_read"
  on public.user_effective_permissions
  for select
  to authenticated
  using (
    public.has_permission(organization_id, 'members.read')
  );

-- ============================================================
-- RLS POLICIES — user_permission_overrides
-- ============================================================

-- Self-view: users can see their own active overrides.
create policy "overrides_select_self"
  on public.user_permission_overrides
  for select
  to authenticated
  using (
    user_id    = auth.uid()
    and deleted_at is null
  );

-- Admin view: org members with members.manage see all overrides in their org.
create policy "overrides_select_admin"
  on public.user_permission_overrides
  for select
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );

create policy "overrides_insert_permission"
  on public.user_permission_overrides
  for insert
  to authenticated
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );

create policy "overrides_update_permission"
  on public.user_permission_overrides
  for update
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );

create policy "overrides_delete_permission"
  on public.user_permission_overrides
  for delete
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
    and public.has_permission(organization_id, 'members.manage')
    and deleted_at is null
  );
