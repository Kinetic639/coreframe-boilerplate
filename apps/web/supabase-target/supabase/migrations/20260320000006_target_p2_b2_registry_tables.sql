-- ============================================================
-- TARGET Phase 1 — Batch 2 / File 6
-- Tables: permissions, roles, role_permissions
-- ============================================================
-- Purpose      : Permission registry — static catalog of available
--                permissions and the roles that bundle them.
--                System roles (is_basic=true, organization_id IS NULL)
--                are global; custom roles are per-organization.
-- Dependencies : organizations (Batch 1, File 3)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. All RLS policies for these three tables are deferred to
--      File 8 of this batch. All policies reference is_org_member()
--      and has_permission() which are defined in File 8.
--      CREATE POLICY expressions are validated at query time (not
--      at creation time), so the forward reference is safe —
--      deferred here for logical ordering and clarity.
--
--   2. V1 helper functions (is_org_creator, has_org_role,
--      has_any_org_role) are NOT created. TARGET is pure V2.
--      Any LEGACY policies that referenced these are not ported.
--
--   3. protect_roles_immutable_columns() and its trigger are
--      ported as-is — valid V2 design, prevents accidental
--      mutation of structural columns (organization_id, is_basic,
--      scope_type) via UPDATE.
--
--   4. roles.organization_id FK: plain FK (NO ACTION) instead of
--      LEGACY's ON DELETE SET NULL. Rationale: SET NULL would set
--      organization_id=NULL for a custom role (is_basic=false),
--      which immediately violates the roles_invariant CHECK
--      (is_basic=false requires organization_id IS NOT NULL).
--      PostgreSQL evaluates CHECKs after FK cascade actions, so
--      SET NULL would raise a constraint error anyway for custom
--      roles. Plain FK (NO ACTION) correctly blocks hard-delete of
--      an org while custom roles still reference it — forcing
--      explicit cleanup first. This aligns with soft-delete-first
--      design (orgs are never hard-deleted in normal operation).
--      LEGACY's SET NULL on this FK is treated as a schema bug;
--      TARGET corrects it.
-- ============================================================

-- ============================================================
-- permissions
-- Global permission catalog. One row per permission slug.
-- permissions are not scoped to an org — they are global.
-- ============================================================
create table if not exists public.permissions (
  id             uuid        not null default gen_random_uuid(),
  slug           text        not null,
  label          text,
  deleted_at     timestamptz,
  name           text,
  description    text,
  category       text        not null,
  subcategory    text,
  resource_type  text,
  action         text        not null,
  scope_types    text[],
  dependencies   uuid[],
  conflicts_with uuid[],
  is_system      boolean              default false,
  is_dangerous   boolean              default false,
  requires_mfa   boolean              default false,
  priority       integer              default 0,
  metadata       jsonb                default '{}'::jsonb,
  created_at     timestamptz          default now(),
  updated_at     timestamptz          default now(),

  constraint permissions_pkey
    primary key (id),

  constraint permissions_slug_key
    unique (slug)
);

-- RLS: enabled, NOT forced. Mirrors LEGACY (rls_forced = false).
-- postgres superuser (SECURITY DEFINER hooks) bypasses RLS.
alter table public.permissions enable row level security;

-- Indexes — mirrors LEGACY exactly.
create index if not exists idx_permissions_category
  on public.permissions (category)
  where deleted_at is null;

create index if not exists idx_permissions_system
  on public.permissions (is_system)
  where deleted_at is null;

create index if not exists idx_permissions_dangerous
  on public.permissions (is_dangerous)
  where deleted_at is null and is_dangerous = true;

-- Policies deferred to File 8 (depend on is_org_member, has_permission).

-- ============================================================
-- roles
-- Per-org custom roles (is_basic=false, organization_id IS NOT NULL)
-- and global system roles (is_basic=true, organization_id IS NULL).
-- scope_type controls where the role may be assigned:
--   'org'    → assignable only at org scope
--   'branch' → assignable only at branch scope
--   'both'   → assignable at either scope
-- Enforced at write time by validate_role_assignment_scope() trigger
-- (created in File 7) and protect_roles_immutable_columns() below.
-- ============================================================
create table if not exists public.roles (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid,
  name            text        not null,
  is_basic        boolean     not null default false,
  deleted_at      timestamptz,
  description     text,
  scope_type      text        not null default 'org'::text,

  constraint roles_pkey
    primary key (id),

  -- Structural invariant: system roles have no org; custom roles always do.
  -- This invariant is the reason ON DELETE SET NULL cannot be used on the
  -- organization_id FK — SET NULL for a custom role (is_basic=false) would
  -- immediately violate this constraint. See deviation note 4.
  constraint roles_invariant
    check (
      is_basic = true  and organization_id is null
      or
      is_basic = false and organization_id is not null
    ),

  constraint roles_scope_type_check
    check (scope_type = any (array['org'::text, 'branch'::text, 'both'::text])),

  -- Plain FK (NO ACTION): hard-delete of an org is blocked while custom
  -- roles still reference it. Caller must soft-delete roles (deleted_at)
  -- or explicitly remove them before hard-deleting the org.
  -- Deviation from LEGACY (ON DELETE SET NULL) — see deviation note 4.
  constraint roles_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.roles enable row level security;
alter table public.roles force row level security;

-- Policies deferred to File 8.

-- ============================================================
-- protect_roles_immutable_columns()
-- Prevents UPDATE from mutating organization_id, is_basic, or
-- scope_type after creation. These are structural columns that
-- must be fixed at INSERT.
-- SECURITY DEFINER, search_path = 'public'. Mirrors LEGACY.
-- ============================================================
create or replace function public.protect_roles_immutable_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = 'public'
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'roles.organization_id is immutable';
  end if;
  if new.is_basic is distinct from old.is_basic then
    raise exception 'roles.is_basic is immutable';
  end if;
  if new.scope_type is distinct from old.scope_type then
    raise exception 'roles.scope_type is immutable';
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE: fires before any UPDATE on roles.
create trigger roles_protect_immutable_columns
  before update on public.roles
  for each row
  execute function public.protect_roles_immutable_columns();

-- ============================================================
-- role_permissions
-- Junction table mapping roles → permissions.
-- allowed=true: role grants the permission (compiler uses this flag).
-- allowed=false: soft-deny pattern (V1 artifact, kept for LEGACY compat).
-- Both FKs are RESTRICT — neither roles nor permissions can be
-- hard-deleted while linked. Caller must clean up first.
-- ============================================================
create table if not exists public.role_permissions (
  id            uuid        not null default gen_random_uuid(),
  role_id       uuid        not null,
  permission_id uuid        not null,
  allowed       boolean     not null default true,
  deleted_at    timestamptz,

  constraint role_permissions_pkey
    primary key (id),

  constraint role_permissions_role_id_permission_id_key
    unique (role_id, permission_id),

  -- ON DELETE RESTRICT: deleting a role with role_permissions is blocked.
  constraint role_permissions_role_id_fkey
    foreign key (role_id) references public.roles(id)
    on delete restrict,

  -- ON DELETE RESTRICT: deleting a permission used by role_permissions is blocked.
  constraint role_permissions_permission_id_fkey
    foreign key (permission_id) references public.permissions(id)
    on delete restrict
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

-- Index: compiler-critical lookup by role_id + allowed flag.
-- Only active (non-deleted) rows included.
create index if not exists idx_role_permissions_role
  on public.role_permissions (role_id, allowed)
  where deleted_at is null;

-- Policies and compiler trigger (trigger_role_permission_compile)
-- deferred to File 8.
