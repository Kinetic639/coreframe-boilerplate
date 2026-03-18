-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 2
-- Table: users
-- ============================================================
-- Purpose    : Public mirror of auth.users. FK anchor for all
--              user-linked tables (organization_members,
--              user_preferences, user_role_assignments, etc.).
-- Dependencies: File 1 (extensions, auth admin grants)
-- Applied to  : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. status_id column included WITHOUT FK to user_statuses.
--      user_statuses is out of Phase 1 scope. The column is
--      preserved for schema parity; the FK will be added in
--      Phase 2 when user_statuses is ported.
--
--   2. default_branch_id column included WITHOUT FK to branches.
--      Circular dependency: organizations.created_by → users,
--      branches.organization_id → organizations. The FK
--      users.default_branch_id → branches cannot be added until
--      branches exists. Added via ALTER TABLE in File 5.
-- ============================================================

create table if not exists public.users (
  id                uuid        not null,
  email             text        not null,
  first_name        text,
  last_name         text,
  status_id         uuid,           -- FK to user_statuses intentionally omitted (Phase 2)
  default_branch_id uuid,           -- FK added via ALTER TABLE in File 5 after branches exists
  created_at        timestamptz default timezone('utc'::text, now()),
  deleted_at        timestamptz,
  avatar_url        text,
  avatar_path       text,

  constraint users_pkey    primary key (id),
  constraint users_id_fkey foreign key (id) references auth.users(id)
);

-- ============================================================
-- RLS
-- ENABLE only — NOT forced. Mirrors LEGACY (rls_forced = false).
-- Table owner (postgres/superuser) bypasses RLS on non-forced
-- tables, allowing the signup hook to insert without a policy.
-- ============================================================
alter table public.users enable row level security;

-- ============================================================
-- Policies (auth.uid()-only — no helper function dependencies)
--
-- users_select_org_member (allows seeing org-mates) is deferred
-- to File 4 because its USING clause references the
-- organization_members table, which does not exist yet.
-- ============================================================

-- Users can read their own row.
create policy "users_select_self"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- Users can update their own row (name, avatar, etc.).
create policy "users_update_self"
  on public.users
  for update
  to authenticated
  using    (id = auth.uid())
  with check (id = auth.uid());

-- Users can insert their own row.
-- In practice the signup hook (SECURITY DEFINER, runs as postgres
-- superuser) inserts this row before the user has an active session.
-- This policy covers any client-side insert edge case.
create policy "users_insert_self"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());
