-- ============================================================
-- TARGET Phase 1 — Batch 3 / File 10
-- Function: recompute_organization_entitlements(p_org_id uuid)
-- ============================================================
-- Purpose      : Merges subscription plan + module addons +
--                limit overrides into organization_entitlements.
--                Called by two paths:
--                  1. trigger_recompute_entitlements() — database
--                     trigger on subscription/addon/override tables
--                     (File 9). Fires automatically on row changes.
--                  2. handle_user_signup_hook() — called directly
--                     after inserting the free subscription row on
--                     new org creation, to guarantee entitlements
--                     exist before the hook returns.
-- Dependencies : subscription_plans, organization_subscriptions,
--                organization_module_addons,
--                organization_limit_overrides,
--                organization_entitlements (File 9)
-- Applied to   : TARGET project only
-- ============================================================
-- Notes:
--   SECURITY DEFINER: runs as postgres so it can write
--   organization_entitlements even under FORCE RLS without
--   needing an explicit self-referencing policy.
--   SET search_path = '': all names fully-qualified.
--   Advisory lock: pg_advisory_xact_lock(hashtext(org_id::text))
--   prevents concurrent recomputes racing each other.
--   Falls back to free plan (by name) if no active subscription.
--   Limit overrides: jsonb_set per key; override wins over plan.
-- ============================================================

create or replace function public.recompute_organization_entitlements(
  p_org_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_plan_id         uuid;
  v_plan_modules    text[];
  v_plan_limits     jsonb;
  v_plan_contexts   text[];
  v_addon_modules   text[];
  v_merged_modules  text[];
  v_merged_limits   jsonb;
  v_override_record record;
begin
  -- Advisory lock: prevents concurrent recomputes for the same org.
  perform pg_advisory_xact_lock(hashtext(p_org_id::text));

  -- ── Step 1: resolve active subscription → plan ──────────────
  -- Look up the org's active/trialing subscription and its plan.
  -- Falls back to the 'free' plan if no matching subscription exists.
  select
    sp.id,
    coalesce(sp.enabled_modules, array[]::text[]),
    coalesce(sp.limits, '{}'::jsonb),
    coalesce(sp.contexts, array[]::text[])
  into
    v_plan_id,
    v_plan_modules,
    v_plan_limits,
    v_plan_contexts
  from public.organization_subscriptions os
  join public.subscription_plans sp on sp.id = os.plan_id
  where os.organization_id = p_org_id
    and os.status in ('active', 'trialing')
  limit 1;

  -- Fallback: free plan (resolved by name, not hardcoded UUID).
  if v_plan_id is null then
    select
      sp.id,
      coalesce(sp.enabled_modules, array[]::text[]),
      coalesce(sp.limits, '{}'::jsonb),
      coalesce(sp.contexts, array[]::text[])
    into
      v_plan_id,
      v_plan_modules,
      v_plan_limits,
      v_plan_contexts
    from public.subscription_plans sp
    where sp.name = 'free'
      and sp.is_active = true
    limit 1;
  end if;

  -- ── Step 2: collect active module addons ─────────────────────
  select array_agg(module_slug)
  into v_addon_modules
  from public.organization_module_addons
  where organization_id = p_org_id
    and status = 'active';

  v_addon_modules := coalesce(v_addon_modules, array[]::text[]);

  -- ── Step 3: merge plan modules + addon modules (deduplicated) ─
  select array_agg(distinct m)
  into v_merged_modules
  from unnest(v_plan_modules || v_addon_modules) as m;

  v_merged_modules := coalesce(v_merged_modules, array[]::text[]);

  -- ── Step 4: apply limit overrides ───────────────────────────
  -- Start from plan limits, then overlay each override key.
  v_merged_limits := coalesce(v_plan_limits, '{}'::jsonb);

  for v_override_record in
    select limit_key, limit_value
    from public.organization_limit_overrides
    where organization_id = p_org_id
  loop
    v_merged_limits := jsonb_set(
      v_merged_limits,
      array[v_override_record.limit_key],
      to_jsonb(v_override_record.limit_value)
    );
  end loop;

  -- ── Step 5: upsert organization_entitlements ─────────────────
  -- ON CONFLICT(organization_id): update all computed columns.
  -- created_at is preserved on conflict (excluded from SET list).
  insert into public.organization_entitlements (
    organization_id,
    plan_id,
    enabled_modules,
    limits,
    contexts,
    updated_at
  )
  values (
    p_org_id,
    v_plan_id,
    v_merged_modules,
    v_merged_limits,
    coalesce(v_plan_contexts, array[]::text[]),
    now()
  )
  on conflict (organization_id) do update
    set plan_id         = excluded.plan_id,
        enabled_modules = excluded.enabled_modules,
        limits          = excluded.limits,
        contexts        = excluded.contexts,
        updated_at      = excluded.updated_at;
end;
$$;

-- ============================================================
-- EXECUTE grant to supabase_auth_admin
-- handle_user_signup_hook runs under supabase_auth_admin and
-- calls this function directly on new org creation.
-- The database trigger path (trigger_recompute_entitlements)
-- runs as the statement owner (postgres), not supabase_auth_admin,
-- and does not require this grant.
-- ============================================================
grant execute on function public.recompute_organization_entitlements(uuid)
  to supabase_auth_admin;
