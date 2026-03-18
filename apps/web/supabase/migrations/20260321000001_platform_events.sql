-- =============================================================================
-- Migration: platform_events — Core Event System Table
-- Project:   rjeraydumwechpjjzrus (TARGET)
-- Phase:     Event System Phase 1 — Core Database Foundation
-- Arch ref:  docs/event-system/README.md
-- Plan ref:  docs/event-system/EVENT_SYSTEM_IMPLEMENTATION_PLAN.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------

create table if not exists public.platform_events (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  organization_id  uuid        null,
  branch_id        uuid        null,
  actor_user_id    uuid        null,
  actor_type       text        not null,
  module_slug      text        not null,
  action_key       text        not null,
  entity_type      text        not null,
  entity_id        text        not null,
  target_type      text        null,
  target_id        text        null,
  metadata         jsonb       not null default '{}',
  event_tier       text        not null,
  request_id       uuid        null,
  ip_address       inet        null,
  user_agent       text        null,

  constraint platform_events_actor_type_check
    check (actor_type in ('user', 'system', 'api', 'worker', 'scheduler', 'automation')),

  constraint platform_events_event_tier_check
    check (event_tier in ('baseline', 'enhanced', 'forensic'))
);

-- -----------------------------------------------------------------------------
-- Foreign keys (soft — on delete set null, no cascade delete)
-- -----------------------------------------------------------------------------

-- organization_id → public.organizations(id)
alter table public.platform_events
  add constraint platform_events_organization_id_fk
  foreign key (organization_id)
  references public.organizations(id)
  on delete set null;

-- actor_user_id → public.users(id)
-- References public.users (not auth.users) because the platform FK chain is:
-- auth.users → public.users → organization_members
-- public.users is the application-identity anchor for all joins and RLS functions.
alter table public.platform_events
  add constraint platform_events_actor_user_id_fk
  foreign key (actor_user_id)
  references public.users(id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

-- 1. Primary query path: events by org, newest first (partial — excludes null org rows)
create index if not exists pe_org_created_idx
  on public.platform_events (organization_id, created_at desc)
  where organization_id is not null;

-- 2. Personal activity feed: events by actor user, newest first
create index if not exists pe_actor_user_idx
  on public.platform_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

-- 3. Registry / admin filtering by action key
create index if not exists pe_action_key_idx
  on public.platform_events (action_key, created_at desc);

-- 4. Entity-level event lookup (e.g. all events on a specific movement)
create index if not exists pe_entity_idx
  on public.platform_events (entity_type, entity_id, created_at desc);

-- 5. Request correlation: group all events in one logical workflow
create index if not exists pe_request_id_idx
  on public.platform_events (request_id)
  where request_id is not null;

-- -----------------------------------------------------------------------------
-- Append-only enforcement
-- Revoke INSERT, UPDATE, DELETE from all non-privileged roles.
-- Inserts are only permitted via:
--   Mode A: eventService.emit() using the service-role Supabase client
--   Mode B: security-definer Postgres RPC functions (atomic forensic workflows)
-- The service role bypasses RLS entirely and is not affected by these REVOKEs.
-- -----------------------------------------------------------------------------

revoke insert on public.platform_events from public;
revoke insert on public.platform_events from authenticated;
revoke insert on public.platform_events from anon;

revoke update on public.platform_events from public;
revoke update on public.platform_events from authenticated;
revoke update on public.platform_events from anon;

revoke delete on public.platform_events from public;
revoke delete on public.platform_events from authenticated;
revoke delete on public.platform_events from anon;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.platform_events enable row level security;

-- READ: org members may read events scoped to their own organization only.
-- Events where organization_id IS NULL (auth, global, platform-level events)
-- are intentionally excluded. They are surfaced only via tightly controlled
-- backend projection paths (service-role, projection.ts), never raw SELECT.
create policy "platform_events_org_members_read"
  on public.platform_events
  for select
  using (
    organization_id is not null
    and is_org_member(organization_id)
  );

-- No INSERT policy — direct inserts are revoked at the privilege level above.
-- No UPDATE policy — updates are architecturally forbidden (append-only).
-- No DELETE policy — deletes are architecturally forbidden (append-only).
