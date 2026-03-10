-- ============================================================
-- TARGET Phase 1 — Batch 4 / File 15
-- Tables: modules, user_modules
-- ============================================================
-- Purpose      : Module catalog (modules) and per-user module
--                enablement overrides (user_modules).
--                modules: global catalog of available application
--                  modules (warehouse, teams, tools, etc.)
--                user_modules: records which modules a specific
--                  user has explicitly enabled, with optional
--                  setting overrides.
-- Dependencies : users (Batch 1 File 2)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema notes vs LEGACY:
--
--   1. RLS: both tables have RLS DISABLED in LEGACY (rls_enabled=false,
--      rls_forced=false). Preserved exactly in TARGET.
--      Rationale preserved from LEGACY:
--        modules: global read-only catalog. Any authenticated
--          client may read all active module definitions.
--          No user-specific data. No RLS needed.
--        user_modules: application-level access control is
--          handled at the service layer, not via RLS. The table
--          is read/written only by server-side actions and the
--          PostgREST service role. No client-facing RLS required.
--      If future requirements demand RLS on either table, add
--      a new migration — do not modify this file.
--
--   2. modules: no updated_at column (matches LEGACY exactly;
--      the column does not exist in LEGACY).
--
--   3. user_modules: FK user_id → users(id) uses plain FK
--      NO ACTION. LEGACY has NO ACTION (confdeltype=a).
--      Hard-deleting a user with user_modules rows is blocked;
--      caller must clean up explicitly under soft-delete-first.
--
--   4. user_modules: FK module_id → modules(id) uses plain FK
--      NO ACTION. LEGACY has NO ACTION. Hard-deleting a module
--      with user_modules rows is blocked; caller cleans up.
--
--   5. user_modules: soft-delete via deleted_at (matches LEGACY).
--      UNIQUE(user_id, module_id) covers all rows including
--      soft-deleted ones — consistent with LEGACY index definition.
-- ============================================================

-- ============================================================
-- modules
-- Global catalog of application modules.
-- slug is the stable identifier used throughout the app.
-- ============================================================
create table if not exists public.modules (
  id          uuid        not null default gen_random_uuid(),
  slug        text        not null,
  label       text        not null,
  description text,
  created_at  timestamptz          default now(),
  deleted_at  timestamptz,
  settings    jsonb                default '{}'::jsonb,

  constraint modules_pkey
    primary key (id),

  constraint modules_slug_key
    unique (slug)
);

-- RLS: DISABLED. Matches LEGACY exactly (see note 1).
-- No alter table enable row level security.

-- ============================================================
-- user_modules
-- Per-user module enablement with optional setting overrides.
-- Tracks which modules a user has explicitly enabled.
-- ============================================================
create table if not exists public.user_modules (
  id               uuid        not null default gen_random_uuid(),
  user_id          uuid        not null,
  module_id        uuid        not null,
  setting_overrides jsonb,
  created_at       timestamptz          default now(),
  deleted_at       timestamptz,

  constraint user_modules_pkey
    primary key (id),

  constraint user_modules_user_id_module_id_key
    unique (user_id, module_id),

  -- Plain FK (NO ACTION). Matches LEGACY.
  -- Hard-deleting a user with user_modules rows is blocked.
  constraint user_modules_user_id_fkey
    foreign key (user_id) references public.users(id),

  -- Plain FK (NO ACTION). Matches LEGACY.
  -- Hard-deleting a module with user_modules rows is blocked.
  constraint user_modules_module_id_fkey
    foreign key (module_id) references public.modules(id)
);

-- RLS: DISABLED. Matches LEGACY exactly (see note 1).
-- No alter table enable row level security.
