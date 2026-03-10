-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 4
-- Table: organization_members
-- Also: set_updated_at trigger, users_select_org_member policy
-- ============================================================
-- Purpose      : Org membership table. Core dependency for the
--                is_org_member() RLS helper (Batch 2) and the
--                permission compiler trigger (Batch 2).
-- Dependencies : File 1 (set_updated_at), File 2 (users),
--                File 3 (organizations)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. organization_id FK: plain FK (no cascade). LEGACY has
--      ON DELETE CASCADE. Under soft-delete-first design, orgs are
--      deactivated via deleted_at, never hard-deleted. If a hard-delete
--      is attempted on an org that still has member rows, it is
--      correctly blocked — the caller must handle cleanup explicitly.
--      Cascading would silently destroy business-domain records.
--
--   2. user_id FK: plain FK (no cascade). LEGACY has ON DELETE CASCADE.
--      Same reasoning — users are soft-deleted via users.deleted_at.
--      Attempting to hard-delete a user with memberships is correctly
--      blocked, preserving the audit trail.
--
--   3. V1 INSERT policy ("Org creators and owners can add members"),
--      V1 DELETE policy ("Org owners can remove members"),
--      V1 UPDATE policy ("Org owners can update members"),
--      V1 permissive SELECT policy ("Users can view organization members"),
--      V1 RESTRICTIVE SELECT policy ("org_members_select_requires_active_role"):
--      None ported — all reference is_org_creator(), has_org_role(),
--      or has_any_org_role(), which are excluded from TARGET (pure V2).
--      V2 replacements are created in Batch 3.
--
--   4. trigger_membership_compile (fires trigger_compile_on_membership)
--      NOT created here — trigger_compile_on_membership() does not
--      exist until Batch 2. Created in the Batch 2 compiler migration.
--
--   5. set_updated_at trigger IS added here (not in LEGACY).
--      LEGACY's updated_at column has no trigger and is maintained
--      manually. TARGET adds it for consistency with user_preferences.
--      The signup hook's ON CONFLICT clause sets updated_at = now()
--      manually; the trigger produces the same result automatically
--      for all other UPDATE paths.
-- ============================================================

create table if not exists public.organization_members (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  user_id         uuid        not null,
  status          text        not null default 'active',
  joined_at       timestamptz          default now(),
  created_at      timestamptz          default now(),
  updated_at      timestamptz          default now(),
  deleted_at      timestamptz,

  constraint organization_members_pkey
    primary key (id),

  constraint organization_members_organization_id_user_id_key
    unique (organization_id, user_id),

  constraint organization_members_status_check
    check (status = any (array['active'::text, 'inactive'::text, 'pending'::text])),

  -- Plain FK, no cascade. Mirrors soft-delete-first design.
  -- Hard-deleting an org with existing members is blocked until
  -- memberships are explicitly cleaned up.
  constraint organization_members_organization_id_fkey
    foreign key (organization_id) references public.organizations(id),

  -- Plain FK, no cascade. Mirrors soft-delete-first design.
  -- Hard-deleting a user with existing memberships is blocked.
  constraint organization_members_user_id_fkey
    foreign key (user_id) references public.users(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;

-- ============================================================
-- Performance indexes (mirrors LEGACY)
-- ============================================================

-- Active members by org (most common filter pattern).
create index if not exists idx_org_members_org_active
  on public.organization_members (organization_id)
  where deleted_at is null;

-- Composite lookup: user_id + organization_id.
-- Used by is_org_member(), loader fallback paths, permission snapshot.
create index if not exists idx_organization_members_user_org
  on public.organization_members (user_id, organization_id);

-- ============================================================
-- set_updated_at trigger
-- Keeps updated_at current automatically on every UPDATE.
-- set_updated_at() is defined in File 1.
-- ============================================================
create trigger set_updated_at_organization_members
  before update on public.organization_members
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- users_select_org_member policy
--
-- Placed here (after organization_members exists) rather than in
-- File 2 because the USING expression references organization_members.
-- This policy does NOT depend on RLS helper functions — it is a plain
-- EXISTS subquery safe to create in Batch 1. Mirrors LEGACY exactly.
--
-- Semantics: an authenticated user can SELECT a users row for any
-- other user who shares an active org membership with them.
-- ============================================================
create policy "users_select_org_member"
  on public.users
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om1
      join public.organization_members om2
        on om1.organization_id = om2.organization_id
      where om1.user_id    = auth.uid()
        and om2.user_id    = users.id
        and om1.status     = 'active'
        and om2.status     = 'active'
        and om1.deleted_at is null
        and om2.deleted_at is null
    )
  );
