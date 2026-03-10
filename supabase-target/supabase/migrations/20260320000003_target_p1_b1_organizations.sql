-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 3
-- Tables: organizations, organization_profiles, branches
-- ============================================================
-- Purpose      : Core org structure. These three tables form a tight
--                dependency block and are created together.
-- Dependencies : File 2 (users — organizations.created_by FK)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. branches: global UNIQUE(slug) replaced with a partial unique
--      index on (organization_id, slug) WHERE slug IS NOT NULL.
--      LEGACY's global UNIQUE(slug) is a schema bug — the signup hook
--      inserts slug='main' for every org's default branch, causing a
--      UNIQUE violation on the second signup (silently caught by the
--      hook's outer EXCEPTION block, leaving the org without a branch).
--      The partial index scopes uniqueness to within an org and
--      excludes NULL slugs from the constraint entirely.
--
--   2. organization_profiles FK: plain FK, no cascade action.
--      Matches LEGACY exactly. Under the soft-delete-first design,
--      organizations are never hard-deleted (deleted_at is used).
--      Attempting a hard-delete of an org while its profile exists
--      is correctly blocked by the FK — the caller must handle
--      cleanup explicitly.
--
--   3. organization_profiles: no updated_at column — exact LEGACY
--      schema (the column does not exist in LEGACY either).
--
--   4. All policies on these three tables are deferred to the
--      Batch 3 RLS policies migration. Every policy references
--      is_org_member() or has_permission(), which do not exist
--      until Batch 2.
--
--   5. V1 policies (org_insert_authenticated, org_select_creator,
--      is_org_creator, has_org_role) are NOT ported — TARGET is pure V2.
--
--   6. create_default_category_on_org_creation trigger on organizations
--      is NOT ported (warehouse trigger, excluded from Phase 1).
-- ============================================================

-- ============================================================
-- organizations
-- ============================================================
create table if not exists public.organizations (
  id          uuid        not null default gen_random_uuid(),
  name        text        not null,
  slug        text,
  created_by  uuid,
  created_at  timestamptz default timezone('utc'::text, now()),
  deleted_at  timestamptz,
  name_2      text,

  constraint organizations_pkey     primary key (id),
  constraint organizations_slug_key unique (slug),
  constraint organizations_created_by_fkey
    foreign key (created_by) references public.users(id)
);

-- RLS: enabled, NOT forced. Mirrors LEGACY (rls_forced = false).
-- postgres superuser bypasses RLS on non-forced tables, allowing
-- the signup hook to INSERT without a matching policy.
alter table public.organizations enable row level security;

-- Policies deferred to Batch 3 (depend on is_org_member, has_permission).
-- V1 policies (org_insert_authenticated, org_select_creator) NOT ported.

-- ============================================================
-- organization_profiles
-- 1:1 with organizations. organization_id IS the primary key —
-- there is no separate id column.
-- No updated_at column (exact LEGACY schema).
-- ============================================================
create table if not exists public.organization_profiles (
  organization_id uuid  not null,
  website         text,
  logo_url        text,
  bio             text,
  created_at      timestamptz default timezone('utc'::text, now()),
  name            text,
  slug            text,
  -- Note: ordinal_position 8 was a dropped column in LEGACY.
  -- Irrelevant for a fresh CREATE TABLE; all current columns included.
  theme_color     text,
  name_2          text,
  font_color      text,

  constraint organization_profiles_pkey
    primary key (organization_id),

  -- Plain FK, no cascade. Mirrors LEGACY.
  -- Organizations use soft-delete (deleted_at); hard-deletes are blocked
  -- by this FK until the profile is explicitly removed.
  constraint organization_profiles_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.organization_profiles enable row level security;
alter table public.organization_profiles force row level security;

-- Policies deferred to Batch 3 (depend on is_org_member, has_permission).
-- No INSERT policy — inserts are service-role only (signup hook runs as
-- postgres superuser, which bypasses FORCE ROW LEVEL SECURITY).

-- ============================================================
-- branches
-- ============================================================
create table if not exists public.branches (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  name            text        not null,
  created_at      timestamptz default timezone('utc'::text, now()),
  deleted_at      timestamptz,
  slug            text,

  constraint branches_pkey primary key (id),

  -- Plain FK, no cascade. Branches use soft-delete (deleted_at);
  -- hard-deleting an org while branches exist is correctly blocked.
  constraint branches_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.branches enable row level security;
alter table public.branches force row level security;

-- Partial unique index: slug is unique within an org, NULL slugs excluded.
-- Replaces LEGACY's global UNIQUE(slug) which breaks multi-org signups.
-- A partial index (not an inline constraint) is required to express the
-- WHERE clause. NULLs are excluded so branches without a slug never
-- conflict regardless of org.
create unique index if not exists branches_org_slug_unique
  on public.branches (organization_id, slug)
  where slug is not null;

-- Index: branches queried by org_id with deleted_at IS NULL filter.
-- Mirrors LEGACY index idx_branches_org_not_deleted.
create index if not exists idx_branches_org_not_deleted
  on public.branches (organization_id)
  where deleted_at is null;

-- Policies deferred to Batch 3 (all four policies reference
-- is_org_member and has_permission).
