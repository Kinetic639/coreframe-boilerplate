-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 5
-- Table: user_preferences
-- Also: closes circular FK users.default_branch_id → branches
-- ============================================================
-- Purpose      : Per-user active org/branch context. Read by every
--                V2 app loader (load-app-context.v2.ts).
--                Key fields the loader uses:
--                  organization_id   → active org
--                  default_branch_id → preferred branch
-- Dependencies : File 1 (set_updated_at), File 2 (users),
--                File 3 (organizations, branches)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema deviations from LEGACY (documented):
--
--   1. updated_at default: LEGACY has no default (column starts NULL).
--      TARGET adds DEFAULT timezone('utc'::text, now()) so newly
--      created rows have a populated updated_at. Consistent with the
--      set_updated_at trigger pattern used here and in File 4.
--
--   2. set_updated_at trigger added (not in LEGACY). LEGACY's
--      updated_at is maintained manually in queries. TARGET adds
--      the trigger for automatic maintenance on all UPDATE paths.
--
--   3. last_branch_id FK: ON DELETE SET NULL added (LEGACY has plain FK).
--      last_branch_id is a bookmark pointer, not a mandatory reference.
--      If a branch is removed, the pointer should silently clear rather
--      than blocking the operation.
--
--   4. users.default_branch_id FK (ALTER TABLE): ON DELETE SET NULL added
--      (LEGACY has plain FK). Same rationale as last_branch_id —
--      default_branch_id is a preference pointer; if the branch is
--      removed, the preference clears.
--
--   5. user_preference_audit table and its trigger are excluded from
--      Phase 1 (explicitly out of scope). LEGACY wraps the trigger in
--      EXCEPTION WHEN OTHERS — failures are silent NOTICEs — so its
--      absence causes no runtime errors.
-- ============================================================

create table if not exists public.user_preferences (
  id                    uuid        not null default gen_random_uuid(),
  user_id               uuid        not null,
  last_branch_id        uuid,
  preferences           jsonb,
  created_at            timestamptz default timezone('utc'::text, now()),
  -- TARGET: default added (LEGACY has no default, column starts NULL).
  updated_at            timestamptz default timezone('utc'::text, now()),
  deleted_at            timestamptz,
  organization_id       uuid,
  default_branch_id     uuid,
  display_name          text,
  phone                 text,
  timezone              text        default 'UTC'::text,
  date_format           text        default 'YYYY-MM-DD'::text,
  time_format           text        default '24h'::text,
  locale                text        default 'pl'::text,
  notification_settings jsonb       default '{}'::jsonb,
  dashboard_settings    jsonb       default '{}'::jsonb,
  module_settings       jsonb       default '{}'::jsonb,
  updated_by            uuid,

  constraint user_preferences_pkey
    primary key (id),

  constraint user_preferences_user_id_key
    unique (user_id),

  -- Plain FK. user_preferences must be removed before a user can be
  -- hard-deleted. Correct for soft-delete-first design.
  constraint user_preferences_user_id_fkey
    foreign key (user_id) references public.users(id),

  -- ON DELETE SET NULL: if an org is hard-deleted, the active-org
  -- pointer clears rather than blocking or orphaning. Mirrors LEGACY.
  constraint user_preferences_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
    on delete set null,

  -- ON DELETE SET NULL: default_branch_id is a preference pointer.
  -- If the branch is removed, the preference clears. Mirrors LEGACY.
  constraint user_preferences_default_branch_id_fkey
    foreign key (default_branch_id) references public.branches(id)
    on delete set null,

  -- ON DELETE SET NULL: last_branch_id is a bookmark pointer.
  -- LEGACY has plain FK (no action); TARGET adds SET NULL per
  -- soft-delete-first rule (pointer columns use SET NULL).
  constraint user_preferences_last_branch_id_fkey
    foreign key (last_branch_id) references public.branches(id)
    on delete set null,

  -- ON DELETE SET NULL: updated_by is an audit pointer.
  -- If the referenced user is hard-deleted, the pointer clears.
  -- Mirrors LEGACY.
  constraint user_preferences_updated_by_fkey
    foreign key (updated_by) references public.users(id)
    on delete set null
);

-- RLS: enabled AND forced. Mirrors LEGACY (rls_forced = true).
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

-- ============================================================
-- Indexes (mirrors LEGACY)
-- ============================================================
create index if not exists idx_user_preferences_user_id
  on public.user_preferences (user_id);

-- Partial index: active (non-deleted) preferences.
create index if not exists idx_user_preferences_user_id_active
  on public.user_preferences (user_id)
  where deleted_at is null;

create index if not exists idx_user_preferences_updated_at
  on public.user_preferences (updated_at);

-- GIN index for dashboard_settings JSONB queries.
create index if not exists idx_user_preferences_dashboard_settings
  on public.user_preferences using gin (dashboard_settings);

-- ============================================================
-- set_updated_at trigger
-- Keeps updated_at current automatically on every UPDATE.
-- set_updated_at() is defined in File 1.
-- ============================================================
create trigger set_updated_at_user_preferences
  before update on public.user_preferences
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Policies
-- All are auth.uid()-based — no helper function dependencies.
-- Safe to create in Batch 1. Mirrors LEGACY exactly.
--
-- Note: the signup hook inserts user_preferences as postgres
-- (superuser), which bypasses FORCE ROW LEVEL SECURITY. The
-- user_preferences_insert_own policy covers authenticated
-- client inserts only (edge case — normally the hook creates
-- the row before the user has a session).
-- ============================================================
create policy "user_preferences_select_own"
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_preferences_insert_own"
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_preferences_update_own"
  on public.user_preferences
  for update
  to authenticated
  using    (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_preferences_delete_own"
  on public.user_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Close circular FK: users.default_branch_id → branches(id)
--
-- Could not be declared in File 2 — branches did not exist yet.
-- Added here after branches is created (File 3).
-- ON DELETE SET NULL: default_branch_id is a preference pointer;
-- if the branch is removed, the pointer clears. LEGACY has plain FK
-- (no action); TARGET adds SET NULL per soft-delete-first rule.
-- ============================================================
alter table public.users
  add constraint users_default_branch_id_fkey
  foreign key (default_branch_id) references public.branches(id)
  on delete set null;
