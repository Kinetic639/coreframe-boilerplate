-- ============================================================
-- TARGET Phase 1 — Batch 2 / File 7
-- Tables: user_role_assignments, user_effective_permissions,
--         user_permission_overrides
-- Functions: validate_role_assignment_scope(),
--            validate_permission_slug_on_override(),
--            update_user_permission_overrides_updated_at()
-- Triggers: check_role_assignment_scope,
--           trigger_validate_permission_slug,
--           trigger_user_permission_overrides_updated_at
-- ============================================================
-- Purpose      : Assignment layer — where roles are assigned to users
--                (user_role_assignments), the compiled result
--                (user_effective_permissions), and per-user admin
--                overrides (user_permission_overrides).
-- Dependencies : roles, permissions (File 6 of this batch),
--                auth.users (Supabase-managed),
--                organizations, branches (Batch 1, File 3)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. user_role_assignments.user_id → auth.users(id) ON DELETE RESTRICT.
--      LEGACY has the same reference. TARGET PRESERVES it.
--      Rationale: role assignments are created during the signup hook
--      at a point when public.users may not yet exist for the new user.
--      Referencing auth.users avoids a chicken-and-egg problem.
--      (Contrast with organization_members, which references public.users
--      and is written after public.users is guaranteed to exist.)
--
--   2. user_effective_permissions.user_id → auth.users(id) ON DELETE CASCADE.
--      Preserved from LEGACY. Correct behavior: if an auth user is
--      deleted, their compiled permissions are automatically purged.
--
--   3. user_permission_overrides.user_id → auth.users(id) ON DELETE CASCADE.
--      Preserved from LEGACY. Same rationale as UEP.
--
--   4. update_user_permission_overrides_updated_at(): TARGET adds
--      SET search_path = public. LEGACY has no search_path setting.
--      Minor hardening deviation; functionally identical.
--
--   5. validate_role_assignment_scope(): TARGET adds SET search_path = ''.
--      LEGACY has no search_path setting. The function body uses fully
--      qualified names (public.roles), so behavior is unchanged.
--      Added for defense-in-depth against search_path injection.
--
--   6. RLS policies for all three tables are deferred to File 8
--      (they depend on is_org_member, has_permission, has_branch_permission
--      which are defined in File 8).
--
--   7. Compiler triggers (trigger_role_assignment_compile,
--      trigger_override_compile) are deferred to File 8 after
--      compile_user_permissions() is defined.
-- ============================================================

-- ============================================================
-- user_role_assignments
-- Assigns a role to a user at org or branch scope.
--   scope='org'    → scope_id = organization_id
--   scope='branch' → scope_id = branch_id
-- No organization_id column — the org is derived from scope/scope_id
-- by trigger_compile_on_role_assignment() at compile time.
-- ============================================================
create table if not exists public.user_role_assignments (
  id         uuid        not null default gen_random_uuid(),
  user_id    uuid        not null,
  role_id    uuid        not null,
  scope      text        not null,
  scope_id   uuid        not null,
  deleted_at timestamptz,

  constraint user_role_assignments_pkey
    primary key (id),

  constraint user_role_assignments_user_id_role_id_scope_scope_id_key
    unique (user_id, role_id, scope, scope_id),

  -- scope must be 'org' or 'branch' only.
  constraint user_role_assignments_scope_check
    check (scope = any (array['org'::text, 'branch'::text])),

  -- → auth.users (not public.users). Intentional: see deviation note 1.
  -- ON DELETE RESTRICT: auth user deletion blocked while assignments exist.
  -- Preserves audit trail; caller must explicitly clean up.
  constraint user_role_assignments_user_id_fkey
    foreign key (user_id) references auth.users(id)
    on delete restrict,

  -- ON DELETE RESTRICT: role deletion blocked while assignments exist.
  -- Mirrors LEGACY.
  constraint user_role_assignments_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete restrict
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.user_role_assignments enable row level security;
alter table public.user_role_assignments force row level security;

-- Index: compiler-critical. compile_user_permissions() filters by
-- (user_id, scope, scope_id) with deleted_at IS NULL.
create index if not exists idx_user_role_assignments_compiler
  on public.user_role_assignments (user_id, scope, scope_id)
  where deleted_at is null;

-- Policies and compiler trigger deferred to File 8.

-- ============================================================
-- validate_role_assignment_scope()
-- BEFORE INSERT OR UPDATE trigger on user_role_assignments.
-- Enforces that the assignment scope matches the role's scope_type:
--   role.scope_type = 'org'    → assignment must use scope='org'
--   role.scope_type = 'branch' → assignment must use scope='branch'
--   role.scope_type = 'both'   → either scope is permitted
-- No SECURITY DEFINER: LEGACY also has none. Runs as the caller,
-- which can read roles through RLS (roles_select_system /
-- roles_select_org policies, or as postgres superuser for hooks).
-- SET search_path = '': TARGET addition for defense-in-depth.
-- Function body uses fully-qualified public.roles — behavior unchanged.
-- ============================================================
create or replace function public.validate_role_assignment_scope()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  role_scope_type text;
begin
  select scope_type into role_scope_type
  from public.roles
  where id = new.role_id;

  if role_scope_type = 'org' and new.scope != 'org' then
    raise exception 'Role % can only be assigned at org scope', new.role_id;
  end if;

  if role_scope_type = 'branch' and new.scope != 'branch' then
    raise exception 'Role % can only be assigned at branch scope', new.role_id;
  end if;

  -- scope_type = 'both' permits either scope; no check needed.
  return new;
end;
$$;

-- BEFORE INSERT OR UPDATE: validates scope on every write.
create trigger check_role_assignment_scope
  before insert or update on public.user_role_assignments
  for each row
  execute function public.validate_role_assignment_scope();

-- ============================================================
-- user_effective_permissions
-- Denormalized compiled result of compile_user_permissions().
-- Never written directly by application code — compiler only.
--
-- Key design points:
--   branch_id IS NULL     → org-wide permission (scope='org' source)
--   branch_id IS NOT NULL → branch-specific permission (scope='branch' source)
--   permission_slug       → source pattern (may contain '*' wildcards)
--   permission_slug_exact → always a concrete slug (no wildcards)
--
--   unique_v3 uses NULLS NOT DISTINCT so that
--   (user, org, slug_exact, NULL) is treated as one unique row,
--   enabling ON CONFLICT upsert for org-wide permissions.
--   CRITICAL: constraint name must be exactly
--   user_effective_permissions_unique_v3 — compile_user_permissions()
--   references it by name in ON CONFLICT ON CONSTRAINT.
-- ============================================================
create table if not exists public.user_effective_permissions (
  id                    uuid        not null default gen_random_uuid(),
  user_id               uuid        not null,
  organization_id       uuid        not null,
  permission_slug       text        not null,
  source_type           text        not null default 'role'::text,
  source_id             uuid,
  created_at            timestamptz not null default now(),
  compiled_at           timestamptz not null default now(),
  branch_id             uuid,
  permission_slug_exact text        not null,

  constraint user_effective_permissions_pkey
    primary key (id),

  -- CRITICAL: exact name referenced by compile_user_permissions().
  -- NULLS NOT DISTINCT: NULL branch_id values compare as equal,
  -- allowing one org-wide row per (user, org, permission_slug_exact).
  constraint user_effective_permissions_unique_v3
    unique nulls not distinct (user_id, organization_id, permission_slug_exact, branch_id),

  -- CASCADE: purge compiled permissions when auth user is deleted.
  -- → auth.users (same as user_role_assignments). Mirrors LEGACY.
  constraint user_effective_permissions_user_id_fkey
    foreign key (user_id) references auth.users(id)
    on delete cascade,

  -- CASCADE: purge compiled permissions when org is deleted.
  -- Mirrors LEGACY.
  constraint user_effective_permissions_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
    on delete cascade
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.user_effective_permissions enable row level security;
alter table public.user_effective_permissions force row level security;

-- Indexes — mirrors LEGACY exactly.
create index if not exists idx_uep_user_org
  on public.user_effective_permissions (user_id, organization_id);

create index if not exists idx_uep_user_org_branch
  on public.user_effective_permissions (user_id, organization_id, branch_id);

create index if not exists idx_uep_permission
  on public.user_effective_permissions (permission_slug);

create index if not exists idx_uep_user_org_permission
  on public.user_effective_permissions (user_id, organization_id, permission_slug);

-- 10k/100k-ready partial indexes used by has_permission() and
-- has_branch_permission() to evaluate RLS policies efficiently.
create index if not exists uep_org_slug_exact_idx
  on public.user_effective_permissions (organization_id, user_id, permission_slug_exact)
  where branch_id is null;

create index if not exists uep_branch_slug_exact_idx
  on public.user_effective_permissions (organization_id, user_id, branch_id, permission_slug_exact)
  where branch_id is not null;

-- Policies deferred to File 8.

-- ============================================================
-- user_permission_overrides
-- Per-user manual grant/revoke overrides applied by admins.
-- The permission compiler reads these and incorporates them
-- into user_effective_permissions at compile time.
--
-- Column notes:
--   effect:          'grant' | 'revoke' — V2 pattern used by compiler
--   allowed:         boolean NOT NULL — V1 artifact, kept for LEGACY compat
--   permission_slug: denormalized from permission_id by
--                    validate_permission_slug_on_override() trigger
--   organization_id: denormalized org reference used by compiler;
--                    nullable (NULL = global override, compiler skips)
-- ============================================================
create table if not exists public.user_permission_overrides (
  id              uuid        not null default gen_random_uuid(),
  user_id         uuid        not null,
  permission_id   uuid        not null,
  allowed         boolean     not null,
  scope           text        not null,
  scope_id        uuid,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  effect          text        not null default 'grant'::text,
  permission_slug text,
  organization_id uuid,

  constraint user_permission_overrides_pkey
    primary key (id),

  constraint user_permission_overrides_effect_check
    check (effect = any (array['grant'::text, 'revoke'::text])),

  constraint user_permission_overrides_scope_check
    check (scope = any (array['global'::text, 'org'::text, 'branch'::text])),

  -- scope_id must be NULL for global scope, NOT NULL for org/branch.
  -- Two equivalent CHECK constraints preserved from LEGACY.
  constraint user_permission_overrides_global_scope_id_null
    check (
      scope = 'global' and scope_id is null
      or scope <> 'global' and scope_id is not null
    ),

  constraint user_permission_overrides_scope_id_required
    check (
      scope = 'global' and scope_id is null
      or scope = any (array['org'::text, 'branch'::text]) and scope_id is not null
    ),

  -- CASCADE: purge overrides if auth user is deleted. Mirrors LEGACY.
  constraint user_permission_overrides_user_id_fkey
    foreign key (user_id) references auth.users(id)
    on delete cascade,

  -- RESTRICT: permission must not be deleted while overrides reference it.
  constraint user_permission_overrides_permission_id_fkey
    foreign key (permission_id) references public.permissions(id)
    on delete restrict,

  -- CASCADE: purge overrides if org is deleted. Mirrors LEGACY.
  constraint user_permission_overrides_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
    on delete cascade
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.user_permission_overrides enable row level security;
alter table public.user_permission_overrides force row level security;

-- Partial unique index: one active override per (user, scope, scope_id, permission).
create unique index if not exists user_permission_overrides_unique_active
  on public.user_permission_overrides (user_id, scope, scope_id, permission_id)
  where deleted_at is null;

-- Compiler lookup: used by compile_user_permissions() to find active
-- overrides for a user within an org.
create index if not exists idx_user_permission_overrides_compiler
  on public.user_permission_overrides (user_id, organization_id, effect)
  where deleted_at is null;

create index if not exists idx_user_permission_overrides_created_at
  on public.user_permission_overrides (created_at desc);

-- ============================================================
-- validate_permission_slug_on_override()
-- BEFORE INSERT OR UPDATE on user_permission_overrides.
-- Ensures permission_slug matches permission_id when both are
-- provided. Auto-populates permission_slug from permission_id
-- if slug is missing or mismatched. Validates slug exists if
-- provided without permission_id.
-- SECURITY DEFINER, SET search_path = ''. Mirrors LEGACY.
-- ============================================================
create or replace function public.validate_permission_slug_on_override()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_correct_slug text;
begin
  if new.permission_id is not null then
    select slug into v_correct_slug
    from public.permissions
    where id = new.permission_id;

    if v_correct_slug is null then
      raise exception 'Invalid permission_id: % does not exist', new.permission_id;
    end if;

    if new.permission_slug is null or new.permission_slug <> v_correct_slug then
      new.permission_slug := v_correct_slug;
    end if;
  end if;

  if new.permission_slug is not null and new.permission_id is null then
    if not exists (
      select 1 from public.permissions where slug = new.permission_slug
    ) then
      raise exception 'Invalid permission_slug: % does not exist in permissions table', new.permission_slug;
    end if;
  end if;

  return new;
end;
$$;

-- BEFORE INSERT OR UPDATE: auto-populate/validate permission_slug.
create trigger trigger_validate_permission_slug
  before insert or update on public.user_permission_overrides
  for each row
  execute function public.validate_permission_slug_on_override();

-- ============================================================
-- update_user_permission_overrides_updated_at()
-- Sets updated_at = now() on every UPDATE.
-- TARGET adds SET search_path = public (LEGACY has none).
-- No SECURITY DEFINER — same as LEGACY.
-- ============================================================
create or replace function public.update_user_permission_overrides_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- BEFORE UPDATE: maintain updated_at timestamp.
create trigger trigger_user_permission_overrides_updated_at
  before update on public.user_permission_overrides
  for each row
  execute function public.update_user_permission_overrides_updated_at();

-- Policies and compiler trigger (trigger_override_compile) deferred to File 8.
