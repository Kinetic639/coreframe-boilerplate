-- ============================================================
-- TARGET Phase 1 — Batch 3 / File 9
-- Tables: subscription_plans, organization_subscriptions,
--         organization_module_addons, organization_limit_overrides,
--         organization_entitlements
-- Functions: update_updated_at_column(), trigger_recompute_entitlements()
-- Triggers: 7 triggers across 4 tables
-- RLS policies: all 5 tables
-- ============================================================
-- Purpose      : Entitlement layer — subscription plans, per-org
--                subscriptions and module addons, limit overrides,
--                and the compiled entitlements summary.
-- Dependencies : organizations (Batch 1, File 3),
--                is_org_member (Batch 2, File 8)
-- Applied to   : TARGET project only
-- ============================================================
-- Schema notes vs LEGACY:
--
--   1. update_updated_at_column(): generic BEFORE UPDATE trigger
--      function used by 4 tables. Identical to LEGACY semantics
--      but defined here (does not exist yet in TARGET).
--      SET search_path = public for safety.
--
--   2. trigger_recompute_entitlements(): AFTER I/U/D trigger
--      function that calls recompute_organization_entitlements().
--      recompute_organization_entitlements() is defined in File 10
--      (dependency order). The reference is resolved at trigger-fire
--      time, so defining the trigger function before the target
--      function is safe.
--
--   3. organization_entitlements PK = organization_id (no separate
--      UUID id column). Preserved from LEGACY.
--
--   4. All 5 tables: RLS ENABLED AND FORCED, mirroring LEGACY.
--
--   5. organization_module_addons: partial unique index
--      (organization_id, module_slug) WHERE status='active' —
--      exactly mirrors LEGACY.
--
--   6. RLS SELECT policies for subscription/addon/override/
--      entitlements: is_org_member(organization_id). Matches LEGACY.
--
--   7. subscription_plans SELECT: all authenticated users may read
--      active plans (for plan selection UX). Matches LEGACY.
--
--   8. ON DELETE CASCADE vs plain FK (soft-delete-first design):
--      LEGACY uses ON DELETE CASCADE on all organization_id FKs in
--      this batch. TARGET replaces all of them with plain FKs
--      (NO ACTION / default). Rationale: under the soft-delete-first
--      design, organizations are never hard-deleted (deleted_at is
--      used). The same rule applies in Batch 1 (organization_profiles,
--      branches, organization_members all use plain FKs). Consistent
--      application of the rule here means: if a caller attempts to
--      hard-delete an org while entitlement rows exist, the FK blocks
--      it, forcing explicit cleanup. CASCADE would silently destroy
--      subscription and entitlement data, which is unacceptable.
--      This is a deliberate TARGET correction of LEGACY's approach.
-- ============================================================

-- ============================================================
-- update_updated_at_column()
-- Generic BEFORE UPDATE trigger: sets updated_at = now().
-- Used by subscription_plans, organization_subscriptions,
-- organization_module_addons, organization_limit_overrides.
-- SET search_path = public for safety (TARGET addition).
-- No SECURITY DEFINER — fires as caller.
-- ============================================================
create or replace function public.update_updated_at_column()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- trigger_recompute_entitlements()
-- AFTER INSERT OR UPDATE OR DELETE trigger function.
-- Calls recompute_organization_entitlements() for the affected org.
-- Uses TG_OP to pick OLD vs NEW for the org id (DELETE uses OLD).
-- SET search_path = '' for safety; body uses fully-qualified names.
-- ============================================================
create or replace function public.trigger_recompute_entitlements()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_org_id := old.organization_id;
  else
    v_org_id := new.organization_id;
  end if;

  perform public.recompute_organization_entitlements(v_org_id);
  return null; -- AFTER trigger; return value ignored
end;
$$;

-- ============================================================
-- subscription_plans
-- Global catalog of available subscription plans.
-- Not org-scoped — one row per plan (free, professional, etc.).
-- ============================================================
create table if not exists public.subscription_plans (
  id              uuid        not null default gen_random_uuid(),
  name            text        not null,
  description     text,
  price_monthly   numeric,
  price_yearly    numeric,
  is_active       boolean     not null default true,
  enabled_modules text[]               default array[]::text[],
  limits          jsonb                default '{}'::jsonb,
  contexts        text[]               default array[]::text[],
  metadata        jsonb                default '{}'::jsonb,
  created_at      timestamptz          default now(),
  updated_at      timestamptz          default now(),
  features        jsonb                default '{}'::jsonb,
  stripe_price_id text,
  max_users       integer,

  constraint subscription_plans_pkey
    primary key (id),

  constraint subscription_plans_name_key
    unique (name)
);

-- RLS: enabled AND forced. Mirrors LEGACY.
alter table public.subscription_plans enable row level security;
alter table public.subscription_plans force row level security;

-- BEFORE UPDATE: maintain updated_at timestamp.
create trigger update_subscription_plans_updated_at
  before update on public.subscription_plans
  for each row
  execute function public.update_updated_at_column();

-- ============================================================
-- subscription_plans RLS policies
--
--   SELECT: all authenticated users (for plan selection UX).
--   ALL service_role: admin/backend full access.
-- ============================================================
create policy "subscription_plans_select_authenticated"
  on public.subscription_plans
  for select
  to authenticated
  using (is_active = true);

create policy "subscription_plans_all_service_role"
  on public.subscription_plans
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- organization_subscriptions
-- One active subscription row per organization.
-- UNIQUE(organization_id) enforces the one-sub-per-org rule.
-- status CHECK: 'active','trialing','past_due','canceled',
--               'unpaid','incomplete' — mirrors LEGACY exactly.
-- FKs:
--   organization_id → organizations: plain FK (NO ACTION).
--     TARGET deviation: LEGACY used ON DELETE CASCADE.
--     Rationale: soft-delete-first — see deviation note 8.
--   plan_id → subscription_plans: plain FK (NO ACTION).
--     Plan deletion blocked while any org subscribes to it.
-- ============================================================
create table if not exists public.organization_subscriptions (
  id                     uuid        not null default gen_random_uuid(),
  organization_id        uuid        not null,
  plan_id                uuid        not null,
  status                 text        not null default 'active'::text,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  canceled_at            timestamptz,
  stripe_subscription_id text,
  stripe_customer_id     text,
  metadata               jsonb                default '{}'::jsonb,
  created_at             timestamptz          default now(),
  updated_at             timestamptz          default now(),

  constraint organization_subscriptions_pkey
    primary key (id),

  constraint organization_subscriptions_organization_id_key
    unique (organization_id),

  constraint organization_subscriptions_status_check
    check (status = any (array[
      'active'::text,
      'trialing'::text,
      'past_due'::text,
      'canceled'::text,
      'unpaid'::text,
      'incomplete'::text
    ])),

  -- Plain FK (NO ACTION). LEGACY had ON DELETE CASCADE.
  -- TARGET correction: soft-delete-first; hard-delete is blocked
  -- until caller explicitly cleans up. See deviation note 8.
  constraint organization_subscriptions_organization_id_fkey
    foreign key (organization_id) references public.organizations(id),

  -- Plain FK (NO ACTION): plan deletion blocked while orgs subscribe.
  constraint organization_subscriptions_plan_id_fkey
    foreign key (plan_id) references public.subscription_plans(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY.
alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscriptions force row level security;

-- BEFORE UPDATE: maintain updated_at.
create trigger update_organization_subscriptions_updated_at
  before update on public.organization_subscriptions
  for each row
  execute function public.update_updated_at_column();

-- AFTER INSERT OR UPDATE OR DELETE: recompute entitlements.
create trigger recompute_on_subscription_change
  after insert or update or delete on public.organization_subscriptions
  for each row
  execute function public.trigger_recompute_entitlements();

-- ============================================================
-- organization_subscriptions RLS policies
-- ============================================================
create policy "organization_subscriptions_select_org_member"
  on public.organization_subscriptions
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "organization_subscriptions_all_service_role"
  on public.organization_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- organization_module_addons
-- Per-org addon modules (purchased on top of the base plan).
-- Partial unique index: one active addon per (org, module_slug).
-- status CHECK: 'active','canceled' only.
-- FK: organization_id → organizations: plain FK (NO ACTION).
--   TARGET deviation: LEGACY used ON DELETE CASCADE.
--   Rationale: soft-delete-first — see deviation note 8.
-- ============================================================
create table if not exists public.organization_module_addons (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  module_slug     text        not null,
  status          text        not null default 'active'::text,
  expires_at      timestamptz,
  metadata        jsonb                default '{}'::jsonb,
  created_at      timestamptz          default now(),
  updated_at      timestamptz          default now(),

  constraint organization_module_addons_pkey
    primary key (id),

  constraint organization_module_addons_status_check
    check (status = any (array['active'::text, 'canceled'::text])),

  -- Plain FK (NO ACTION). LEGACY had ON DELETE CASCADE.
  -- TARGET correction: soft-delete-first; see deviation note 8.
  constraint organization_module_addons_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY.
alter table public.organization_module_addons enable row level security;
alter table public.organization_module_addons force row level security;

-- Partial unique index: one ACTIVE addon per (org, module_slug).
-- Mirrors LEGACY exactly.
create unique index if not exists organization_module_addons_unique_active
  on public.organization_module_addons (organization_id, module_slug)
  where status = 'active';

-- BEFORE UPDATE: maintain updated_at.
create trigger update_org_module_addons_updated_at
  before update on public.organization_module_addons
  for each row
  execute function public.update_updated_at_column();

-- AFTER INSERT OR UPDATE OR DELETE: recompute entitlements.
create trigger recompute_on_addon_change
  after insert or update or delete on public.organization_module_addons
  for each row
  execute function public.trigger_recompute_entitlements();

-- ============================================================
-- organization_module_addons RLS policies
-- ============================================================
create policy "organization_module_addons_select_org_member"
  on public.organization_module_addons
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "organization_module_addons_all_service_role"
  on public.organization_module_addons
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- organization_limit_overrides
-- Per-org limit key/value overrides applied by admins.
-- UNIQUE(organization_id, limit_key): one override per key per org.
-- FK: organization_id → organizations: plain FK (NO ACTION).
--   TARGET deviation: LEGACY used ON DELETE CASCADE.
--   Rationale: soft-delete-first — see deviation note 8.
-- ============================================================
create table if not exists public.organization_limit_overrides (
  id              uuid        not null default gen_random_uuid(),
  organization_id uuid        not null,
  limit_key       text        not null,
  limit_value     integer     not null,
  created_at      timestamptz          default now(),
  updated_at      timestamptz          default now(),

  constraint organization_limit_overrides_pkey
    primary key (id),

  constraint organization_limit_overrides_organization_id_limit_key_key
    unique (organization_id, limit_key),

  -- Plain FK (NO ACTION). LEGACY had ON DELETE CASCADE.
  -- TARGET correction: soft-delete-first; see deviation note 8.
  constraint organization_limit_overrides_organization_id_fkey
    foreign key (organization_id) references public.organizations(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY.
alter table public.organization_limit_overrides enable row level security;
alter table public.organization_limit_overrides force row level security;

-- BEFORE UPDATE: maintain updated_at.
create trigger update_org_limit_overrides_updated_at
  before update on public.organization_limit_overrides
  for each row
  execute function public.update_updated_at_column();

-- AFTER INSERT OR UPDATE OR DELETE: recompute entitlements.
create trigger recompute_on_override_change
  after insert or update or delete on public.organization_limit_overrides
  for each row
  execute function public.trigger_recompute_entitlements();

-- ============================================================
-- organization_limit_overrides RLS policies
-- ============================================================
create policy "organization_limit_overrides_select_org_member"
  on public.organization_limit_overrides
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "organization_limit_overrides_all_service_role"
  on public.organization_limit_overrides
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- organization_entitlements
-- Compiled, denormalized entitlement summary per org.
-- PK = organization_id (no separate id column) — mirrors LEGACY.
-- Written exclusively by recompute_organization_entitlements();
-- never mutated directly by application code.
--
-- enabled_modules: union of plan.enabled_modules + active addons.
-- limits: plan.limits merged with limit overrides (override wins).
-- contexts: plan.contexts.
-- plan_id: FK to subscription_plans — informational reference.
--
-- No recompute trigger here — this is the OUTPUT of recompute,
-- never a trigger source (mirrors LEGACY design).
--
-- FK: organization_id → organizations: plain FK (NO ACTION).
--   TARGET deviation: LEGACY used ON DELETE CASCADE.
--   Rationale: soft-delete-first — see deviation note 8.
-- ============================================================
create table if not exists public.organization_entitlements (
  organization_id uuid        not null,
  plan_id         uuid,
  enabled_modules text[]               default array[]::text[],
  limits          jsonb                default '{}'::jsonb,
  contexts        text[]               default array[]::text[],
  updated_at      timestamptz          default now(),
  created_at      timestamptz          default now(),
  metadata        jsonb                default '{}'::jsonb,

  constraint organization_entitlements_pkey
    primary key (organization_id),

  -- Plain FK (NO ACTION). LEGACY had ON DELETE CASCADE.
  -- TARGET correction: soft-delete-first; see deviation note 8.
  constraint organization_entitlements_organization_id_fkey
    foreign key (organization_id) references public.organizations(id),

  -- Plain FK (NO ACTION): plan deletion blocked while referenced.
  -- Compiler re-resolves plan_id on each recompute.
  constraint organization_entitlements_plan_id_fkey
    foreign key (plan_id) references public.subscription_plans(id)
);

-- RLS: enabled AND forced. Mirrors LEGACY.
alter table public.organization_entitlements enable row level security;
alter table public.organization_entitlements force row level security;

-- ============================================================
-- organization_entitlements RLS policies
-- ============================================================
create policy "organization_entitlements_select_org_member"
  on public.organization_entitlements
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "organization_entitlements_all_service_role"
  on public.organization_entitlements
  for all
  to service_role
  using (true)
  with check (true);
