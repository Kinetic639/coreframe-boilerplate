# IMPLEMENTATION PLAN — Entitlements-First Subscriptions (1-Day Execution)

**Repo**: Next.js App Router (SSR-first) + Supabase (Postgres/RLS) + Permissions V2 + TanStack Query
**Goal**: Production-like subscription/plan/module/limit behavior in DEV now (no payment provider), with clean future payment integration.
**Timeline**: 1 day maximum (aggressive execution)

---

## PROGRESS TRACKER

### Phase 0: Schema Baseline (30 min)

- [ ] 0.1 Create idempotent baseline migration
- [ ] 0.2 Add constraints and indexes
- [ ] 0.3 Verify `is_org_member()` function exists
- [ ] 0.4 Reseed `subscription_plans` with namespaced limit keys
- [ ] 0.5 Apply migration and verify

### Phase 1: RLS Security (30 min)

- [ ] 1.1 Enable RLS on subscription_plans
- [ ] 1.2 Enable RLS on organization_subscriptions
- [ ] 1.3 Enable RLS on subscription_usage
- [ ] 1.4 Add SELECT policies (org member checks)
- [ ] 1.5 Add MODIFY policies (service_role only)
- [ ] 1.6 Force RLS on all tables
- [ ] 1.7 Test RLS policies with normal user

### Phase 2: Add-ons & Overrides Tables (30 min)

- [ ] 2.1 Create organization_module_addons table + RLS
- [ ] 2.2 Create organization_limit_overrides table + RLS
- [ ] 2.3 Add indexes
- [ ] 2.4 Apply migration

### Phase 2.5: Module Slug Standardization (20 min)

- [ ] 2.5.1 Keep `id` field but ensure `slug` is authoritative for matching
- [ ] 2.5.2 Update getAllModules() to match on `slug` only
- [ ] 2.5.3 Remove hardcoded "always available" arrays
- [ ] 2.5.4 Remove isDefaultModule() from subscription-service.ts

### Phase 3: Compiled Entitlements (60 min)

- [ ] 3.1 Create organization_entitlements table + RLS
- [ ] 3.2 Create `recompute_organization_entitlements()` function (SECURITY DEFINER + `SET search_path TO ''`)
- [ ] 3.3 Create triggers on subscription/addons/overrides tables
- [ ] 3.4 Create `recompute_all_entitlements()` admin function
- [ ] 3.5 Add advisory locks to prevent concurrent recomputes
- [ ] 3.6 Test recompute logic manually

### Phase 4: Backfill Free Plans (15 min)

- [ ] 4.1 Ensure "free" plan exists in subscription_plans (namespaced limits)
- [ ] 4.2 Backfill organization_subscriptions (all orgs -> free)
- [ ] 4.3 Run `recompute_all_entitlements()`
- [ ] 4.4 Verify all orgs have entitlements row

### Phase 5: SSR Loading — Entitlements Only (30 min)

- [ ] 5.1 Update `loadAppContextServer()` to load only `organization_entitlements` (single row)
- [ ] 5.2 Update `AppContext` type to include `entitlements` field
- [ ] 5.3 Update `getAccessibleModules()` to use `entitlements.enabled_modules`
- [ ] 5.4 Remove `subscription: null` hardcode
- [ ] 5.5 Test SSR render shows correct modules

### Phase 5.5: Route-Level Protection (20 min)

- [ ] 5.5.1 Create `requireModuleAccessSSR()` guard function
- [ ] 5.5.2 Guard `/dashboard-old` premium module routes (per-module layout.tsx)
- [ ] 5.5.2b Guard `/dashboard` v2 catch-all route (`[...slug]` layout)
- [ ] 5.5.3 Add `UpgradeRequiredPage` component for blocked routes
- [ ] 5.5.4 Test direct URL navigation to blocked module (both dashboard trees)

### Phase 6: Server-Side Enforcement (60 min)

- [ ] 6.1 Create `EntitlementError` class with typed codes
- [ ] 6.2 Create `src/server/guards/entitlements.ts`
- [ ] 6.3 Implement `requireOrgContext()`
- [ ] 6.4 Implement `requireModuleAccess()`
- [ ] 6.5 Implement `requireFeatureAccess()`
- [ ] 6.6 Implement `checkLimit()` and `requireWithinLimit()` — use `select("id", { count: "exact", head: true })`
- [ ] 6.7 Apply guards to 3-5 key server actions (products, locations)
- [ ] 6.8 Test direct API calls are blocked

### Phase 7: Limits Enforcement (45 min)

- [ ] 7.1 Create `src/lib/entitlements/limit-keys.ts` registry (namespaced keys)
- [ ] 7.2 Add partial indexes for derived count queries
- [ ] 7.3 Create `EntitlementsLimitService`
- [ ] 7.4 Implement `getEffectiveLimit()`
- [ ] 7.5 Implement `getCurrentUsage()` (derived counts with `select("id", ...)`)
- [ ] 7.6 Implement `assertUnderLimit()`
- [ ] 7.7 Add limit checks to create actions

### Phase 8: Dev Tooling — Architecture Decision Required (45 min)

- [ ] 8.1 **DECIDE**: Option A (SECURITY DEFINER RPCs) or Option B (Server Actions with service_role)
- [ ] 8.1b Create `app_config` table + `assert_dev_mode_enabled()` DB gate
- [ ] 8.2 Add `ENTITLEMENTS_DEV_MODE` env flag (UI gate only — DB gate is authoritative)
- [ ] 8.3 Create dev plan-switching functions (per chosen architecture)
- [ ] 8.4 Create dev addon management functions
- [ ] 8.5 Create dev limit override functions
- [ ] 8.6 Create dev reset function
- [ ] 8.7 Build "Org Billing (Dev)" page UI
- [ ] 8.8 Test plan switching in dev mode

### Phase 9: UI/UX Polish (30 min)

- [ ] 9.1 Update sidebar to show locked modules with lock icon
- [ ] 9.2 Add upgrade modal/CTA for locked modules
- [ ] 9.3 Update `SubscriptionGate` to use entitlements from app store (no client fallbacks)
- [ ] 9.4 Add invariant violation repair CTA (replaces fallback)
- [ ] 9.5 Add limit reached toast + inline CTA

### Phase 10: Testing & Cleanup (30 min)

- [ ] 10.1 Test RLS: org member can read entitlements
- [ ] 10.2 Test RLS: org member cannot modify subscriptions
- [ ] 10.3 Test enforcement: module access blocked
- [ ] 10.4 Test enforcement: limit reached blocked
- [ ] 10.5 Remove ALL hardcoded fallbacks (`["home", "warehouse"]`, `alwaysAvailable`, `subscription === null` returns)
- [ ] 10.6 Test upgrade flow E2E (free -> professional)
- [ ] 10.7 Verify no flicker on SSR
- [ ] 10.8 Verify all SECURITY DEFINER functions have `SET search_path TO ''`

**TOTAL ESTIMATED TIME: ~7 hours**

---

## Success Criteria (Must Be True at End)

1. Every organization has exactly one "active subscription state" (at least free)
2. On SSR, AppContext includes entitlements (modules/features/limits) so sidebar renders correctly on first paint
3. Direct URL navigation is protected: SSR route guards AND server actions enforce module access
4. Limits are enforced server-side (authoritative). UI shows clear "limit reached" message + upgrade CTA
5. DEV tooling exists: org_owner can switch plans + add-ons in dev mode to simulate production
6. All subscription-related tables are protected by RLS (no client bypass)
7. System design supports later payment provider by mapping provider events -> upserts into org_subscriptions/addons/overrides
8. No hardcoded module fallbacks remain in code
9. No flicker/hydration mismatch on module access
10. Typed error codes for all entitlement failures
11. **NEW**: All SECURITY DEFINER functions include `SET search_path TO ''`
12. **NEW**: All limit keys use namespaced `module.limit_name` format consistently (DB + code)
13. **NEW**: No client-side fallback — missing entitlements shows repair CTA, not silent grant

---

## ARCHITECTURE DECISION: Dev RPCs vs RLS (Must Decide Before Phase 8)

### The Problem

The plan calls for FORCE ROW LEVEL SECURITY on subscription tables (Phase 1) so that `authenticated` users cannot write to them. But Phase 8 creates dev RPCs (e.g., `dev_set_org_plan()`) that need to INSERT/UPDATE these tables — called by an `authenticated` user (org_owner) via `supabase.rpc(...)`.

This is a real conflict: **FORCE RLS + service_role-only write policies** means authenticated users cannot write, even through RPCs, **unless** those RPCs are `SECURITY DEFINER` and the function owner has `rolbypassrls`.

### Verified Facts (Supabase Instance)

| Role             | `rolsuper` | `rolbypassrls` |
| ---------------- | ---------- | -------------- |
| `postgres`       | false      | **true**       |
| `supabase_admin` | true       | true           |
| `service_role`   | false      | **true**       |
| `authenticated`  | false      | false          |
| `anon`           | false      | false          |

Key implication: A `SECURITY DEFINER` function owned by `postgres` executes with `rolbypassrls = true`, which **overrides** `FORCE ROW LEVEL SECURITY`. This means SECURITY DEFINER functions CAN write to tables with FORCE RLS, because the bypass attribute takes precedence.

### Existing Pattern in Codebase

The codebase already uses this pattern. The `is_org_member()` function is defined as:

```sql
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
```

This confirms SECURITY DEFINER + search_path hardening is the established convention.

### Option A: SECURITY DEFINER RPCs (Recommended)

**How it works**: Dev RPCs like `dev_set_org_plan()` are defined as `SECURITY DEFINER SET search_path TO ''`. They execute as `postgres` (the function owner), which has `rolbypassrls = true`. The function itself validates the caller is `org_owner` via `auth.uid()` before proceeding.

```sql
CREATE OR REPLACE FUNCTION public.dev_set_org_plan(p_org_id UUID, p_plan_name TEXT)
RETURNS void AS $$
BEGIN
  -- Gate: dev mode must be enabled in DB
  PERFORM public.assert_dev_mode_enabled();
  -- Guard: caller must be org owner (role-based via Permissions V2)
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- This INSERT works because function owner (postgres) has rolbypassrls
  INSERT INTO public.organization_subscriptions (...) VALUES (...)
  ON CONFLICT (...) DO UPDATE SET ...;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
```

**Pros**:

- All logic lives in the database — single transaction, atomic
- No extra infrastructure (no service_role key exposure to client)
- Auth guard (`is_org_owner`) runs in same transaction context
- Matches existing codebase pattern (`is_org_member` is already SECURITY DEFINER)
- Works with FORCE RLS because `postgres` has `rolbypassrls`

**Cons**:

- SECURITY DEFINER functions are powerful — bugs could bypass RLS unintentionally
- Must always include `SET search_path TO ''` to prevent search_path injection
- SQL-only logic (no TypeScript validation before the write)

**Mitigation**: Every SECURITY DEFINER function MUST:

1. Include `SET search_path TO ''`
2. Fully-qualify all table references (e.g., `public.organization_subscriptions`)
3. Include explicit auth guards as the first statement
4. Be reviewed carefully for SQL injection in parameters

### Option B: Server Actions with `service_role` Client

**How it works**: Dev RPCs become Next.js Server Actions that create a `service_role` Supabase client (using `SUPABASE_SERVICE_ROLE_KEY` env var, server-only). The service_role has `rolbypassrls = true`, so it can write to FORCE RLS tables.

```typescript
// src/app/actions/dev/billing-actions.ts
"use server";

import { createServiceClient } from "@/utils/supabase/service";
import { requireOrgOwner } from "@/server/guards/entitlements";

export async function devSetOrgPlan(orgId: string, planName: string) {
  // Guard: verify caller is org owner (uses authenticated client)
  await requireOrgOwner(orgId);

  // Use service_role client to bypass RLS
  const supabase = createServiceClient();

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("name", planName)
    .eq("is_active", true)
    .single();

  if (!plan) throw new Error(`Plan not found: ${planName}`);

  await supabase
    .from("organization_subscriptions")
    .upsert({ organization_id: orgId, plan_id: plan.id, status: "active", is_development: true });
}
```

**Pros**:

- Full TypeScript — easier to debug, test, and add validation
- No SECURITY DEFINER escalation in database
- Service role key never leaves server (Next.js server actions are server-only)

**Cons**:

- Uses `createServiceClient()` helper (already exists at `src/utils/supabase/service.ts`)
- Two roundtrips (auth check + write) instead of single SQL transaction
- The recompute trigger still fires in the DB — but the trigger function IS SECURITY DEFINER regardless
- Harder to guarantee atomicity across multi-step operations

### Decision Table

| Factor               | Option A (SECURITY DEFINER)           | Option B (Server Actions)      |
| -------------------- | ------------------------------------- | ------------------------------ |
| Atomicity            | Single transaction                    | Multi-step                     |
| Language             | SQL                                   | TypeScript + SQL               |
| Auth pattern         | `auth.uid()` in SQL                   | Server action middleware       |
| Matches codebase     | Yes (is_org_member pattern)           | Partially                      |
| RLS bypass mechanism | Function owner has `rolbypassrls`     | Client role has `rolbypassrls` |
| Risk surface         | Function-level (contained)            | Service key (broad)            |
| search_path concern  | Must hardcode `SET search_path TO ''` | N/A                            |

### Recommendation: **Option A** (SECURITY DEFINER RPCs)

Rationale: Matches existing codebase patterns, provides atomic transactions, avoids service_role key management, and the `rolbypassrls` behavior has been verified for this Supabase instance. The recompute function is SECURITY DEFINER regardless (it must write to `organization_entitlements`), so Option B doesn't actually reduce the SECURITY DEFINER surface.

> **Note for non-technical readers**: "Super admin role" in this context refers to database roles like `postgres` and `service_role` — these are **infrastructure-level** accounts used by the system itself, NOT user-facing admin roles. Regular users (including org owners) authenticate as `authenticated` and cannot bypass security rules directly. The dev RPCs let org owners simulate plan changes by calling a carefully guarded function that temporarily uses elevated privileges — like an employee using a manager-approved override key.

---

## OWNERSHIP DEFINITION: Role-Based (Permissions V2)

### Why This Matters

Dev RPCs need an "org owner" check to ensure only authorized users can simulate plan changes. There are two possible approaches:

| Approach                                | Mechanism                                | Problem                                                                                           |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `organizations.created_by`              | Column on orgs table                     | Only matches the original creator — ownership cannot be transferred, and co-owners are impossible |
| **`org_owner` role via Permissions V2** | `user_role_assignments` + `roles` tables | Authoritative RBAC — ownership is a role that can be assigned, transferred, and revoked           |

### Decision: Use Permissions V2 Role

The `org_owner` role already exists in the live database:

- **Role**: `org_owner` (name), scope_type: `org`, is_basic: `true`
- **Assignment**: Via `user_role_assignments` table (user_id, role_id, scope='org', scope_id=org_id)

All dev RPCs use the `is_org_owner()` function (defined in Phase 8) which checks:

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE ura.user_id = auth.uid()
    AND ura.scope = 'org'
    AND ura.scope_id = p_org_id
    AND r.name = 'org_owner'
    AND ura.deleted_at IS NULL
    AND r.deleted_at IS NULL
);
```

This is consistent with the rest of the permission system and avoids creating a parallel ownership mechanism.

---

## SEARCH_PATH STANDARDIZATION

### The Problem

Every `SECURITY DEFINER` function must harden its `search_path` to prevent search_path injection attacks. There are two common approaches:

| Approach              | Syntax                              | Effect                                                                                                     |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Empty search_path** | `SET search_path TO ''`             | Forces fully-qualified references (`public.table_name`) everywhere. Maximum safety.                        |
| Public + pg_temp      | `SET search_path = public, pg_temp` | Allows unqualified `table_name` to resolve to `public`. Slightly more convenient but slightly less strict. |

### Decision: `SET search_path TO ''` (Empty)

**Rationale**:

1. **Existing convention**: The live `is_org_member()` function already uses `SET search_path TO ''` — all new functions should match.
2. **Maximum strictness**: Every table reference must be fully qualified (`public.organizations`, `public.user_role_assignments`), making accidental cross-schema access impossible.
3. **Auditability**: Reviewers can verify at a glance that every table reference is explicitly scoped.

**Consequence**: All SQL in SECURITY DEFINER functions throughout this plan uses `public.table_name` for every table reference. If a table reference is unqualified, that is a bug.

### Verification (Phase 10)

Phase 10.8 includes a verification query that checks all SECURITY DEFINER functions have `search_path` set. The check accepts both `search_path=''` and `search_path=""` forms (Postgres normalizes the quoting).

---

## Phase 0 — Freeze Schema and Eliminate Drift (30 min)

### Problem

There is a `.sql.disabled` migration, but tables exist in DB. This creates drift and makes future work unsafe.

### Tasks

**0.1 Create baseline migration** (10 min)

```bash
# Create migration file
supabase migration new entitlements_baseline
```

**0.2 Write idempotent schema** (15 min)

File: `supabase/migrations/YYYYMMDDHHMMSS_entitlements_baseline.sql`

```sql
-- =====================================================
-- ENTITLEMENTS BASELINE MIGRATION
-- Purpose: Establish idempotent schema for subscription system
-- Replaces: 20250925120000_create_subscription_system.sql.disabled
-- =====================================================

-- Verify is_org_member exists (DO NOT REPLACE — used by all existing RLS policies)
-- The live function checks public.organization_members (status='active', deleted_at IS NULL)
-- Replacing it would break every RLS policy in the system.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_org_member'
  ) THEN
    RAISE EXCEPTION 'FATAL: is_org_member() function missing — cannot proceed with entitlements setup';
  END IF;
END $$;

-- =====================================================
-- SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT,
  name TEXT NOT NULL,
  display_name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB DEFAULT '{}'::jsonb,
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled_contexts TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_name_key'
  ) THEN
    ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);
  END IF;
END $$;

-- =====================================================
-- ORGANIZATION SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  is_development BOOLEAN NOT NULL DEFAULT false,
  dev_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_subscriptions_organization_id_key'
  ) THEN
    ALTER TABLE organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_key
    UNIQUE (organization_id);
  END IF;
END $$;

-- =====================================================
-- SUBSCRIPTION USAGE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_usage_org_feature_period_key'
  ) THEN
    ALTER TABLE subscription_usage
    ADD CONSTRAINT subscription_usage_org_feature_period_key
    UNIQUE (organization_id, feature_key, period_start);
  END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
  ON subscription_plans(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org_id
  ON organization_subscriptions(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_status
  ON organization_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id
  ON organization_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_org_feature
  ON subscription_usage(organization_id, feature_key);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_period
  ON subscription_usage(period_start, period_end);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_plans_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_plans_updated_at
      BEFORE UPDATE ON subscription_plans
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organization_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_organization_subscriptions_updated_at
      BEFORE UPDATE ON organization_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscription_usage_updated_at'
  ) THEN
    CREATE TRIGGER update_subscription_usage_updated_at
      BEFORE UPDATE ON subscription_usage
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- RESEED PLANS WITH NAMESPACED LIMIT KEYS
-- =====================================================
-- IMPORTANT: Limit keys must use namespaced format: module.limit_name
-- Current DB has un-namespaced keys (max_products, max_users, etc.)
-- This reseed corrects them to the canonical format.

-- Rename limit keys to namespaced format using key-rename approach.
-- This PRESERVES any unknown keys that may exist in the limits JSONB.
-- Only max_branches gets a hardcoded default (1) because it doesn't exist in current DB.
UPDATE subscription_plans
SET limits = (
  -- Start with existing limits (preserves unknown keys)
  limits
  -- Remove old un-namespaced keys
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  -- Add namespaced keys with values from old keys (fallback to already-namespaced)
  || jsonb_build_object(
    'warehouse.max_products', COALESCE((limits->>'max_products')::int, (limits->>'warehouse.max_products')::int),
    'warehouse.max_locations', COALESCE((limits->>'max_locations')::int, (limits->>'warehouse.max_locations')::int),
    'warehouse.max_branches', COALESCE((limits->>'max_branches')::int, (limits->>'warehouse.max_branches')::int, 1),
    'organization.max_users', COALESCE((limits->>'max_users')::int, (limits->>'organization.max_users')::int)
  )
)
WHERE limits ? 'max_products'
   OR limits ? 'max_users'
   OR limits ? 'max_locations'
   OR limits ? 'max_branches';

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with features and limits';
COMMENT ON TABLE organization_subscriptions IS 'Organization subscription assignments (one per org)';
COMMENT ON TABLE subscription_usage IS 'Monthly usage tracking for subscription limits';
```

**0.3 Verify is_org_member function** (5 min)

```sql
-- Verify function exists and is SECURITY DEFINER with search_path hardened
SELECT proname, prosecdef, proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_org_member';
-- Expected: prosecdef=true, proconfig includes search_path=""
```

**0.4 Apply migration**

```bash
npm run supabase:migration:up
```

**Deliverable**: Baseline migration applied cleanly, no drift, limit keys namespaced

---

## Phase 1 — RLS for Subscription System (30 min)

### Principles

- Plans catalog: readable by authenticated users, writable by service_role only
- Org subscriptions: readable by org members, writable by service_role only
- Usage: readable by org members, writable by service_role only

### Tasks

**1.1-1.3 Enable RLS** (5 min)

Create migration: `supabase migration new enable_subscription_rls`

```sql
-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Force RLS (even for table owner — but rolbypassrls overrides this)
ALTER TABLE subscription_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage FORCE ROW LEVEL SECURITY;
```

> **Why FORCE RLS?** Without FORCE, the table owner (`postgres`) bypasses all RLS policies. With FORCE, even the table owner is subject to policies — UNLESS the role has `rolbypassrls = true` (which `postgres` and `service_role` do in our Supabase instance). This means: regular `authenticated` users are always blocked, while `SECURITY DEFINER` functions (owned by `postgres`) can still write because `rolbypassrls` takes precedence over `FORCE ROW LEVEL SECURITY`.

**1.4 Add SELECT policies** (10 min)

```sql
-- subscription_plans: authenticated users can read active plans
CREATE POLICY "subscription_plans_select_policy" ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- organization_subscriptions: org members can read their org's subscription
CREATE POLICY "organization_subscriptions_select_policy" ON organization_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

-- subscription_usage: org members can read their org's usage
CREATE POLICY "subscription_usage_select_policy" ON subscription_usage
  FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));
```

**1.5 Add MODIFY policies** (10 min)

```sql
-- subscription_plans: only service_role can modify
CREATE POLICY "subscription_plans_modify_policy" ON subscription_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- organization_subscriptions: only service_role can modify
CREATE POLICY "organization_subscriptions_modify_policy" ON organization_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- subscription_usage: only service_role can modify
CREATE POLICY "subscription_usage_modify_policy" ON subscription_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**1.6 Apply migration**

```bash
npm run supabase:migration:up
```

**1.7 Test RLS** (5 min)

```sql
-- As authenticated user (not service_role)
SELECT * FROM subscription_plans WHERE is_active = true; -- Should work
INSERT INTO subscription_plans (name) VALUES ('test'); -- Should fail
```

**Deliverable**: Normal authenticated clients cannot modify subscription state

---

## Phase 2 — Add-ons & Overrides Tables (30 min)

### Purpose

Enable plan bundles + add-on modules + custom limit overrides

### Tasks

**2.1 Create organization_module_addons** (15 min)

Create migration: `supabase migration new addons_and_overrides`

```sql
-- =====================================================
-- ORGANIZATION MODULE ADDONS
-- =====================================================
CREATE TABLE organization_module_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique: only one active addon per org+module
CREATE UNIQUE INDEX organization_module_addons_org_module_active_unique
  ON organization_module_addons(organization_id, module_slug)
  WHERE status = 'active';

-- Indexes
CREATE INDEX idx_organization_module_addons_org_id
  ON organization_module_addons(organization_id);
CREATE INDEX idx_organization_module_addons_status
  ON organization_module_addons(status);

-- Trigger for updated_at
CREATE TRIGGER update_organization_module_addons_updated_at
  BEFORE UPDATE ON organization_module_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE organization_module_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_module_addons FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_module_addons_select_policy" ON organization_module_addons
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "organization_module_addons_modify_policy" ON organization_module_addons
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE organization_module_addons IS 'Add-on modules purchased per organization';
```

**2.2 Create organization_limit_overrides** (15 min)

```sql
-- =====================================================
-- ORGANIZATION LIMIT OVERRIDES
-- =====================================================
CREATE TABLE organization_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  override_value INTEGER NOT NULL, -- -1 for unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, limit_key)
);

-- Indexes
CREATE INDEX idx_organization_limit_overrides_org_id
  ON organization_limit_overrides(organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_organization_limit_overrides_updated_at
  BEFORE UPDATE ON organization_limit_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE organization_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_limit_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_limit_overrides_select_policy" ON organization_limit_overrides
  FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "organization_limit_overrides_modify_policy" ON organization_limit_overrides
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE organization_limit_overrides IS 'Custom limit overrides per organization';
```

**2.3 Apply migration**

```bash
npm run supabase:migration:up
```

**Deliverable**: Add-ons and overrides tables exist with RLS

---

## Phase 2.5 — Module Slug Standardization (20 min)

### Purpose

Eliminate `id` vs `slug` confusion; standardize on `slug` as the authoritative identifier for entitlement matching

### Important Note

We keep the `id` field in `ModuleConfig` for now because it's used in React `key` props and other non-entitlement contexts. But ALL entitlement matching must use `slug`.

### Tasks

**2.5.1 Update getAllModules() matching** (5 min)

File: `src/modules/index.ts`

```typescript
// Before (line ~65)
hasAccess = subscription.plan.enabled_modules.includes(config.module.id);

// After
hasAccess = entitlements.enabled_modules.includes(config.module.slug);
```

**2.5.2 Remove hardcoded arrays** (10 min)

File: `src/lib/services/subscription-service.ts`

```typescript
// REMOVE this method entirely
private isDefaultModule(moduleName: string): boolean {
  return ["home", "warehouse"].includes(moduleName);
}

// REMOVE hardcoded checks in hasModuleAccess():
// Line 150-151: Delete "Always allow access to default modules" logic
```

File: `src/hooks/use-subscription.ts`

```typescript
// Line 121: REMOVE
// if (!subscription) return ["home", "warehouse"].includes(moduleName);

// REPLACE with: invariant violation — entitlements should always exist
if (!subscription) {
  console.error("[Entitlements] Missing entitlements — this is a data integrity issue");
  return false;
}
```

File: `src/modules/index.ts`

```typescript
// REMOVE any alwaysAvailable flags from allModulesConfig entries
```

**Deliverable**: All modules use `slug` for entitlement matching, no hardcoded fallbacks

---

## Phase 3 — Compiled Entitlements (60 min)

### Purpose

Single source of truth for org entitlements (modules/features/limits)

### Tasks

**3.1 Create organization_entitlements table** (10 min)

Create migration: `supabase migration new compiled_entitlements`

```sql
-- =====================================================
-- ORGANIZATION ENTITLEMENTS (COMPILED)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organization_entitlements (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  plan_name TEXT NOT NULL,
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled_contexts TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.organization_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_entitlements FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_entitlements_select_policy" ON public.organization_entitlements
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "organization_entitlements_modify_policy" ON public.organization_entitlements
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.organization_entitlements IS 'Compiled entitlements snapshot per organization (single source of truth)';
```

**3.2 Create recompute function** (25 min)

> **CRITICAL**: This function MUST be `SECURITY DEFINER SET search_path TO ''` because it writes to `organization_entitlements` which has FORCE RLS. The function owner (`postgres`) has `rolbypassrls = true`, allowing the write.

```sql
-- =====================================================
-- RECOMPUTE ORGANIZATION ENTITLEMENTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.recompute_organization_entitlements(p_org_id UUID)
RETURNS void AS $$
DECLARE
  v_subscription RECORD;
  v_plan RECORD;
  v_modules TEXT[];
  v_contexts TEXT[];
  v_features JSONB;
  v_limits JSONB;
  v_addon RECORD;
  v_override RECORD;
BEGIN
  -- Advisory lock: per-org, prevents concurrent recomputes for the SAME org.
  -- hashtext(p_org_id::text) returns a stable int4 hash of the UUID string.
  -- Different orgs get different lock keys → no cross-org contention.
  -- pg_advisory_xact_lock auto-releases at transaction end (no manual unlock needed).
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  -- 1. Get active subscription
  SELECT * INTO v_subscription
  FROM public.organization_subscriptions
  WHERE organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;

  -- If no subscription, default to free plan
  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE name = 'free'
      AND is_active = true
    LIMIT 1;

    IF v_plan IS NULL THEN
      RAISE EXCEPTION 'No free plan found in subscription_plans';
    END IF;
  ELSE
    -- Get plan details
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_subscription.plan_id;
  END IF;

  -- 2. Build modules list (plan + active addons)
  v_modules := v_plan.enabled_modules;

  FOR v_addon IN
    SELECT module_slug FROM public.organization_module_addons
    WHERE organization_id = p_org_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > NOW())
  LOOP
    v_modules := array_append(v_modules, v_addon.module_slug);
  END LOOP;

  -- Remove duplicates
  v_modules := ARRAY(SELECT DISTINCT unnest(v_modules));

  -- 3. Contexts (from plan only for now)
  v_contexts := v_plan.enabled_contexts;

  -- 4. Features (from plan only for now)
  v_features := v_plan.features;

  -- 5. Limits (plan base + overrides)
  v_limits := v_plan.limits;

  FOR v_override IN
    SELECT limit_key, override_value FROM public.organization_limit_overrides
    WHERE organization_id = p_org_id
  LOOP
    v_limits := jsonb_set(
      v_limits,
      ARRAY[v_override.limit_key],
      to_jsonb(v_override.override_value)
    );
  END LOOP;

  -- 6. Upsert compiled entitlements
  INSERT INTO public.organization_entitlements (
    organization_id,
    plan_id,
    plan_name,
    enabled_modules,
    enabled_contexts,
    features,
    limits,
    updated_at
  ) VALUES (
    p_org_id,
    v_plan.id,
    v_plan.name,
    v_modules,
    v_contexts,
    v_features,
    v_limits,
    NOW()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    plan_name = EXCLUDED.plan_name,
    enabled_modules = EXCLUDED.enabled_modules,
    enabled_contexts = EXCLUDED.enabled_contexts,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
```

**3.3 Create triggers** (15 min)

```sql
-- =====================================================
-- TRIGGERS TO AUTO-RECOMPUTE ENTITLEMENTS
-- =====================================================

-- Trigger function that calls recompute
CREATE OR REPLACE FUNCTION public.trigger_recompute_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recompute_organization_entitlements(
    COALESCE(NEW.organization_id, OLD.organization_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Trigger on organization_subscriptions
DROP TRIGGER IF EXISTS recompute_on_subscription_change ON public.organization_subscriptions;
CREATE TRIGGER recompute_on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- Trigger on organization_module_addons
DROP TRIGGER IF EXISTS recompute_on_addon_change ON public.organization_module_addons;
CREATE TRIGGER recompute_on_addon_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_module_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();

-- Trigger on organization_limit_overrides
DROP TRIGGER IF EXISTS recompute_on_override_change ON public.organization_limit_overrides;
CREATE TRIGGER recompute_on_override_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_limit_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recompute_entitlements();
```

**3.4 Create admin recompute all function** (5 min)

```sql
-- =====================================================
-- RECOMPUTE ALL ENTITLEMENTS (for migrations/backfills)
-- =====================================================
CREATE OR REPLACE FUNCTION public.recompute_all_entitlements()
RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_org_id IN
    SELECT id FROM public.organizations WHERE deleted_at IS NULL
  LOOP
    PERFORM public.recompute_organization_entitlements(v_org_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
```

**3.5 Apply migration**

```bash
npm run supabase:migration:up
```

**3.6 Test manually** (5 min)

```sql
-- Test recompute for single org
SELECT public.recompute_organization_entitlements('4aab690b-45c9-4150-96c2-cabe6a6d8633'::uuid);

-- Verify entitlements row created
SELECT * FROM public.organization_entitlements WHERE organization_id = '4aab690b-45c9-4150-96c2-cabe6a6d8633'::uuid;
```

**Deliverable**: Compiled entitlements table with auto-recompute triggers

---

## Phase 4 — Backfill Free Plans (15 min)

### Purpose

Ensure every org has a subscription (no ambiguous state)

### Tasks

**4.1 Ensure free plan exists with namespaced limits** (5 min)

Create migration: `supabase migration new backfill_free_subscriptions`

```sql
-- Ensure free plan exists with NAMESPACED limit keys
-- NOTE: These values are INTENTIONAL updates from the current DB state:
-- - max_users: 2 → 3 (increase for free tier)
-- - enabled_modules: adds 'contacts', 'documentation'; removes 'development'
-- These changes take effect on next recompute for all orgs on free plan.
DO $$
DECLARE
  v_free_plan_id UUID;
BEGIN
  -- Check if free plan exists
  SELECT id INTO v_free_plan_id FROM subscription_plans WHERE name = 'free';

  -- If not, create it
  IF v_free_plan_id IS NULL THEN
    INSERT INTO subscription_plans (
      name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      is_active,
      sort_order,
      enabled_modules,
      enabled_contexts,
      features,
      limits
    ) VALUES (
      'free',
      '{"en": "Free", "pl": "Darmowy"}',
      '{"en": "Perfect for getting started", "pl": "Idealny na początek"}',
      0,
      0,
      true,
      1,
      ARRAY['home', 'warehouse', 'teams', 'organization-management', 'support', 'user-account', 'contacts', 'documentation'],
      ARRAY['warehouse'],
      '{"basic_support": true}'::jsonb,
      '{"warehouse.max_products": 100, "organization.max_users": 3, "warehouse.max_locations": 5, "warehouse.max_branches": 1}'::jsonb
    );
  END IF;
END $$;

-- Also ensure professional and enterprise plans use namespaced keys
-- Key-rename approach: preserves any unknown keys in the limits JSONB
-- Professional plan: actual DB values are max_products=10000, max_locations=100, max_users=50
UPDATE subscription_plans
SET limits = (
  limits
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  || jsonb_build_object(
    'warehouse.max_products', COALESCE((limits->>'max_products')::int, (limits->>'warehouse.max_products')::int, 10000),
    'warehouse.max_locations', COALESCE((limits->>'max_locations')::int, (limits->>'warehouse.max_locations')::int, 100),
    'warehouse.max_branches', COALESCE((limits->>'max_branches')::int, (limits->>'warehouse.max_branches')::int, 10),
    'organization.max_users', COALESCE((limits->>'max_users')::int, (limits->>'organization.max_users')::int, 50),
    'analytics.monthly_exports', 100
  )
)
WHERE name = 'professional'
  AND (limits ? 'max_products' OR NOT limits ? 'warehouse.max_products');

UPDATE subscription_plans
SET limits = (
  limits
  - 'max_products' - 'max_locations' - 'max_branches' - 'max_users'
  || jsonb_build_object(
    'warehouse.max_products', -1,
    'warehouse.max_locations', -1,
    'warehouse.max_branches', -1,
    'organization.max_users', -1,
    'analytics.monthly_exports', -1
  )
)
WHERE name = 'enterprise'
  AND (limits ? 'max_products' OR NOT limits ? 'warehouse.max_products');
```

**4.2 Backfill subscriptions** (5 min)

```sql
-- Backfill: assign free plan to all orgs without subscription
INSERT INTO organization_subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  is_development
)
SELECT
  o.id,
  sp.id,
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  false
FROM organizations o
CROSS JOIN subscription_plans sp
WHERE sp.name = 'free'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_subscriptions os
    WHERE os.organization_id = o.id
  )
ON CONFLICT (organization_id) DO NOTHING;
```

**4.3 Recompute all** (5 min)

```sql
-- Recompute entitlements for all orgs
SELECT public.recompute_all_entitlements();
```

**4.4 Apply migration and verify**

```bash
npm run supabase:migration:up
```

```sql
-- Verify all orgs have entitlements
SELECT COUNT(*) FROM organizations WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM organization_entitlements;
-- Counts should match

-- Verify all limit keys are namespaced (must return 0 rows)
SELECT id, name, key
FROM subscription_plans, jsonb_each(limits) AS kv(key, value)
WHERE key NOT LIKE '%.%';

-- Verify all entitlements have namespaced limits (must return 0 rows)
SELECT organization_id, key
FROM organization_entitlements, jsonb_each(limits) AS kv(key, value)
WHERE key NOT LIKE '%.%';
```

**Deliverable**: All orgs have subscription + entitlements row with namespaced limit keys

---

## Phase 5 — SSR Loading: Entitlements Only (30 min)

### Purpose

Load entitlements in SSR so sidebar renders correctly on first paint

### Design Decision: Load Only `organization_entitlements`

The previous plan loaded both `organization_entitlements` AND `organization_subscriptions` (with plan join) in SSR. This is unnecessary for the sidebar and module access — the compiled entitlements row has everything needed.

**What SSR loads**: Single row from `organization_entitlements` (one query, ~1ms)
**What SSR does NOT load**: Full subscription details (plan pricing, stripe IDs, billing periods) — these are only needed on the billing page, loaded on-demand via client query.

### Tasks

**5.1 Update loadAppContextServer()** (15 min)

File: `src/lib/api/load-app-context-server.ts`

```typescript
// Add after the organization profile loading section:

// 8. Load compiled entitlements (single row, contains everything needed for SSR)
let entitlements = null;

if (activeOrgId) {
  const { data: entitlementsData } = await supabase
    .from("organization_entitlements")
    .select("*")
    .eq("organization_id", activeOrgId)
    .single();

  entitlements = entitlementsData;
}

// Update return statement (replace the subscription: null line)
return {
  // ... existing fields ...
  entitlements, // NEW: compiled entitlements (replaces subscription: null)
  subscription: null, // Keep for backwards compat, remove in cleanup
};
```

> **Why not load full subscription here?** The full subscription row contains Stripe IDs, billing periods, trial dates — none of which are needed for sidebar rendering or module access checks. Loading it adds an unnecessary JOIN and transfers unused data to every SSR page. The billing page can load it on-demand.

**5.2 Update AppContext type** (5 min)

File: `src/lib/stores/app-store.ts`

```typescript
// Add new type for entitlements
export type OrganizationEntitlements = {
  organization_id: string;
  plan_id: string | null;
  plan_name: string;
  enabled_modules: string[];
  enabled_contexts: string[];
  features: Record<string, any>;
  limits: Record<string, number>;
  updated_at: string;
};

// Update AppContext type — add entitlements field
export type AppContext = {
  // ... existing fields ...
  entitlements: OrganizationEntitlements | null; // NEW
  subscription: OrganizationSubscriptionWithPlan | null;
};
```

**5.3 Update getAccessibleModules()** (8 min)

File: `src/modules/index.ts`

```typescript
export async function getAllModules(
  activeOrgId?: string,
  entitlements?: OrganizationEntitlements | null // Change param type
): Promise<ModuleWithAccess[]> {
  // ... load module configs ...

  for (const config of allModulesConfig) {
    let hasAccess = false;
    let isPremium = config.requiredPlan !== "free";

    if (entitlements) {
      // Use compiled entitlements (authoritative, SSR path)
      hasAccess = entitlements.enabled_modules.includes(config.module.slug);
    }
    // NO ELSE FALLBACK — if no entitlements, hasAccess stays false
    // This is intentional: missing entitlements = data integrity issue, not silent grant

    modulesWithAccess.push({
      ...config.module,
      hasAccess,
      isPremium,
      requiredPlan: config.requiredPlan,
    });
  }

  return modulesWithAccess;
}
```

**5.4 Update sidebar call** (2 min)

File: `src/components/Dashboard/sidebar/AppSidebar.tsx`

```typescript
// Line 38: Update to pass entitlements instead of subscription
const modules = await getAccessibleModules(activeOrgId, appContext?.entitlements);
```

**Deliverable**: SSR renders correct modules on first paint (no flicker), loads only what's needed

---

## Phase 5.5 — Route-Level Protection for SSR Pages (20 min)

### Purpose

Prevent direct URL navigation to premium module pages (e.g., typing `/dashboard/analytics` when on free plan)

### Current Gap

The codebase has two dashboard systems:

- **`/dashboard` (v2)** — uses `[...slug]` catch-all routing + `loadDashboardContextV2()`. Module slugs are resolved from the URL dynamically.
- **`/dashboard-old`** — uses explicit module directories (analytics, warehouse, teams, organization, contacts, dev, development, docs, announcements, news, account, profile, start) + `loadAppContextServer()`.

Neither has module-level sub-layouts. A user on a free plan can type `/dashboard-old/analytics` and reach the page (even though the sidebar won't show it).

### Scope Decision

**In scope for this plan**: Both dashboard trees require route protection.

| Dashboard         | Guard strategy                                           | Notes                                                                    |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/dashboard-old`  | Per-module `layout.tsx` with `requireModuleAccessSSR()`  | Each premium module dir gets its own layout guard                        |
| `/dashboard` (v2) | Single guard in `[...slug]/page.tsx` or catch-all layout | Extract module slug from URL params, check entitlements before rendering |

> **Implementation note for `/dashboard` v2**: The `[...slug]` catch-all means there are no per-module layout files. Instead, the guard runs inside the catch-all page/layout, extracting the module slug from `params.slug[0]` and calling `requireModuleAccessSSR()`. If the slug maps to a premium module, redirect to upgrade page.

### Tasks

**5.5.1 Create requireModuleAccessSSR guard** (10 min)

File: `src/server/guards/require-module-access-ssr.ts`

```typescript
import { redirect } from "next/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

/**
 * SSR guard for module-level route protection.
 * Call this in layout.tsx files for premium modules.
 * Redirects to upgrade page if module is not in entitlements.
 */
export async function requireModuleAccessSSR(moduleSlug: string) {
  const appContext = await loadAppContextServer();

  if (!appContext?.entitlements) {
    redirect("/dashboard/upgrade?module=" + moduleSlug);
    return;
  }

  if (!appContext.entitlements.enabled_modules.includes(moduleSlug)) {
    redirect("/dashboard/upgrade?module=" + moduleSlug);
    return;
  }

  return appContext;
}
```

**5.5.2 Guard `/dashboard-old` premium module routes** (5 min)

For each premium module under `/dashboard-old`, create a `layout.tsx` guard:

File: `src/app/[locale]/dashboard-old/analytics/layout.tsx`

```tsx
import { requireModuleAccessSSR } from "@/server/guards/require-module-access-ssr";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccessSSR("analytics");
  return <>{children}</>;
}
```

Apply the same pattern to other premium module directories under `/dashboard-old` (e.g., contacts, development).

**5.5.2b Guard `/dashboard` (v2) catch-all route** (5 min)

The v2 dashboard uses `[...slug]` routing — no per-module layout files. Guard the catch-all instead.

**Design**: No hardcoded allowlist. Instead, resolve the route slug against the module registry (`getAllModules()`). If the slug matches a registered module, check entitlements. If it doesn't match any module (e.g., `/dashboard/upgrade`, `/dashboard/settings`), it's a non-module route and we skip the check.

File: `src/app/[locale]/dashboard/[...slug]/layout.tsx`

```tsx
import { requireModuleAccessSSR } from "@/server/guards/require-module-access-ssr";
import { getAllModules } from "@/modules";

/**
 * Route-level SSR guard for the v2 dashboard catch-all.
 * Resolves params.slug[0] against the module registry.
 * Only enforces entitlements if the slug maps to a registered module.
 * Non-module routes (upgrade, settings, etc.) pass through.
 */
export default async function DashboardSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string[] };
}) {
  const routeSlug = params.slug?.[0];

  if (routeSlug) {
    // Get all modules from the registry (single source of truth)
    const allModules = await getAllModules();
    // Check if routeSlug matches a known module slug
    const matchedModule = allModules.find((m) => m.slug === routeSlug);

    if (matchedModule) {
      // This is a module route — enforce entitlement check
      await requireModuleAccessSSR(routeSlug);
    }
    // If no module match, it's a non-module route (upgrade, settings, etc.) — skip
  }

  return <>{children}</>;
}
```

> **Why no allowlist**: The module registry (`getAllModules()`) is the single source of truth for module slugs. Any route that doesn't match a module slug is not a module route and doesn't need entitlement checks. New modules are automatically protected as soon as they're registered. No hardcoded arrays to drift.

**5.5.3 Create UpgradeRequiredPage** (5 min)

File: `src/app/[locale]/dashboard/upgrade/page.tsx`

```tsx
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function UpgradeRequiredPage({
  searchParams,
}: {
  searchParams: { module?: string };
}) {
  const moduleSlug = searchParams.module || "this module";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Lock className="h-16 w-16 mx-auto text-gray-400" />
        <h1 className="text-3xl font-bold">Module Not Available</h1>
        <p className="text-gray-600">
          The <strong>{moduleSlug}</strong> module is not included in your current plan.
        </p>
        <Link href="/dashboard/organization/billing-dev">
          <Button>View Plans</Button>
        </Link>
      </div>
    </div>
  );
}
```

**Deliverable**: Direct URL navigation to blocked modules redirects to upgrade page

---

## Phase 6 — Server-Side Enforcement (60 min)

### Purpose

Block direct API calls and URL navigation to unauthorized modules

### Tasks

**6.1 Create EntitlementError class** (10 min)

File: `src/lib/errors/entitlements-errors.ts`

```typescript
export type EntitlementErrorCode =
  | "MODULE_ACCESS_DENIED"
  | "FEATURE_UNAVAILABLE"
  | "LIMIT_EXCEEDED"
  | "NO_ACTIVE_SUBSCRIPTION"
  | "ENTITLEMENTS_MISSING"; // NEW: data integrity issue

export interface EntitlementErrorContext {
  orgId: string;
  moduleSlug?: string;
  featureKey?: string;
  limitKey?: string;
  current?: number;
  limit?: number;
  planName?: string;
}

export class EntitlementError extends Error {
  constructor(
    public code: EntitlementErrorCode,
    public context: EntitlementErrorContext
  ) {
    super(`Entitlement error: ${code}`);
    this.name = "EntitlementError";
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      context: this.context,
      message: this.message,
    };
  }
}
```

**6.2 Create entitlements guard** (25 min)

File: `src/server/guards/entitlements.ts`

```typescript
"use server";

import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { EntitlementError } from "@/lib/errors/entitlements-errors";

/**
 * Load org context (user + activeOrgId)
 */
export async function requireOrgContext() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Unauthorized - no session");
  }

  const appContext = await loadAppContextServer();
  if (!appContext?.activeOrgId) {
    throw new Error("No active organization");
  }

  return {
    userId: session.user.id,
    orgId: appContext.activeOrgId,
    branchId: appContext.activeBranchId,
    entitlements: appContext.entitlements,
  };
}

/**
 * Require module access (throws if denied)
 */
export async function requireModuleAccess(orgId: string, moduleSlug: string) {
  const supabase = await createClient();

  const { data: entitlements, error } = await supabase
    .from("organization_entitlements")
    .select("enabled_modules, plan_name")
    .eq("organization_id", orgId)
    .single();

  if (error || !entitlements) {
    throw new EntitlementError("ENTITLEMENTS_MISSING", { orgId });
  }

  if (!entitlements.enabled_modules.includes(moduleSlug)) {
    throw new EntitlementError("MODULE_ACCESS_DENIED", {
      orgId,
      moduleSlug,
      planName: entitlements.plan_name,
    });
  }

  return true;
}

/**
 * Require feature access (throws if denied)
 */
export async function requireFeatureAccess(orgId: string, featureKey: string) {
  const supabase = await createClient();

  const { data: entitlements, error } = await supabase
    .from("organization_entitlements")
    .select("features, plan_name")
    .eq("organization_id", orgId)
    .single();

  if (error || !entitlements) {
    throw new EntitlementError("ENTITLEMENTS_MISSING", { orgId });
  }

  const hasFeature = entitlements.features[featureKey] === true;
  if (!hasFeature) {
    throw new EntitlementError("FEATURE_UNAVAILABLE", {
      orgId,
      featureKey,
      planName: entitlements.plan_name,
    });
  }

  return true;
}

/**
 * Check limit (returns status, doesn't throw)
 */
export async function checkLimit(orgId: string, limitKey: string) {
  const supabase = await createClient();

  const { data: entitlements, error } = await supabase
    .from("organization_entitlements")
    .select("limits")
    .eq("organization_id", orgId)
    .single();

  if (error || !entitlements) {
    return { limit: 0, current: 0, canProceed: false };
  }

  const limit = entitlements.limits[limitKey] as number;
  if (limit === undefined) {
    return { limit: 0, current: 0, canProceed: false };
  }

  if (limit === -1) {
    return { limit: -1, current: 0, canProceed: true }; // Unlimited
  }

  // Get current usage (derived count - implement per limit key)
  const current = await getCurrentUsageForLimit(supabase, orgId, limitKey);

  return {
    limit,
    current,
    canProceed: current < limit,
  };
}

/**
 * Require within limit (throws if exceeded)
 */
export async function requireWithinLimit(orgId: string, limitKey: string) {
  const status = await checkLimit(orgId, limitKey);

  if (!status.canProceed) {
    throw new EntitlementError("LIMIT_EXCEEDED", {
      orgId,
      limitKey,
      current: status.current,
      limit: status.limit,
    });
  }

  return true;
}

/**
 * Get current usage for limit key (derived counts)
 * PERFORMANCE NOTE: Uses select("id", ...) instead of select("*", ...)
 * to avoid fetching full rows. Combined with partial indexes
 * (Phase 7.2), this is efficient even for large tables.
 */
async function getCurrentUsageForLimit(
  supabase: any,
  orgId: string,
  limitKey: string
): Promise<number> {
  // Import dynamically to avoid circular deps
  const { LIMIT_STRATEGIES } = await import("@/lib/entitlements/limit-keys");

  const strategy = LIMIT_STRATEGIES[limitKey];
  if (!strategy || strategy.type !== "derived" || !strategy.table) {
    console.warn(`Unknown or non-derived limit key: ${limitKey}`);
    return 0;
  }

  let query = supabase
    .from(strategy.table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("deleted_at", null);

  // Apply extra filters (e.g., status = 'active' for organization_members)
  if (strategy.extraFilters) {
    for (const [key, value] of Object.entries(strategy.extraFilters)) {
      query = query.eq(key, value);
    }
  }

  const { count, error } = await query;

  if (error) {
    console.error(`Error counting ${strategy.table}:`, error);
    return 0;
  }

  return count || 0;
}
```

**6.3-6.6 Apply guards to server actions** (25 min)

Example: Update product actions

```typescript
"use server";

import {
  requireOrgContext,
  requireModuleAccess,
  requireWithinLimit,
} from "@/server/guards/entitlements";
import { LIMIT_KEYS } from "@/lib/entitlements/limit-keys";

export async function createProduct(data: ProductFormData) {
  // 1. Auth + org context
  const { orgId, userId } = await requireOrgContext();

  // 2. Module access check
  await requireModuleAccess(orgId, "warehouse");

  // 3. Limit check (uses namespaced key)
  await requireWithinLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);

  // 4. Perform operation
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      ...data,
      organization_id: orgId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  return product;
}
```

Apply similar pattern to 3-5 key actions:

- Products (create, update, delete)
- Locations (create, update, delete)
- Teams/members (invite, remove)

**Deliverable**: Direct API calls blocked without proper entitlements

---

## Phase 7 — Limits Enforcement (45 min)

### Purpose

Define limit keys registry + enforcement service

### Tasks

**7.1 Create limit keys registry** (10 min)

File: `src/lib/entitlements/limit-keys.ts`

```typescript
/**
 * Canonical registry of all limit keys.
 *
 * FORMAT: module.limit_name (namespaced)
 *
 * These keys MUST match exactly what's stored in:
 * - subscription_plans.limits (JSONB keys)
 * - organization_entitlements.limits (compiled JSONB keys)
 * - organization_limit_overrides.limit_key (text column)
 *
 * If you add a new key here, you must also:
 * 1. Add it to the plan seed data in the migration
 * 2. Add a LIMIT_STRATEGIES entry below
 */

export const LIMIT_KEYS = {
  // Warehouse module limits (derived — count rows)
  WAREHOUSE_MAX_PRODUCTS: "warehouse.max_products",
  WAREHOUSE_MAX_LOCATIONS: "warehouse.max_locations",
  WAREHOUSE_MAX_BRANCHES: "warehouse.max_branches",

  // Organization limits (derived)
  ORGANIZATION_MAX_USERS: "organization.max_users",

  // Analytics module limits (metered — counter in subscription_usage)
  ANALYTICS_MONTHLY_EXPORTS: "analytics.monthly_exports",
} as const;

export type LimitKey = (typeof LIMIT_KEYS)[keyof typeof LIMIT_KEYS];

/**
 * Limit strategy per key.
 *
 * "derived" = count rows in a table (e.g., products, locations)
 *   - Always current, no counter drift
 *   - Requires partial index for performance (see Phase 7.2)
 *
 * "metered" = increment counter in subscription_usage table
 *   - For event-based limits (exports, API calls)
 *   - Resets per billing period
 */
export const LIMIT_STRATEGIES: Record<
  string,
  {
    type: "derived" | "metered";
    table?: string;
    column?: string;
    extraFilters?: Record<string, string>;
  }
> = {
  [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: {
    type: "derived",
    table: "products",
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: {
    type: "derived",
    table: "locations",
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_BRANCHES]: {
    type: "derived",
    table: "branches",
  },
  [LIMIT_KEYS.ORGANIZATION_MAX_USERS]: {
    type: "derived",
    table: "organization_members",
    // Counts active members: WHERE organization_id = ? AND status = 'active' AND deleted_at IS NULL
    // This matches is_org_member() — the authoritative membership table.
    // DO NOT use user_role_assignments (it has no organization_id column).
    extraFilters: { status: "active" },
  },
  [LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS]: {
    type: "metered",
    // Uses subscription_usage table
  },
};
```

**7.2 Add partial indexes for derived counts** (5 min)

Create migration: `supabase migration new limit_indexes`

```sql
-- Partial indexes for derived count queries
-- These optimize: SELECT count(id) FROM table WHERE organization_id = ? AND deleted_at IS NULL
-- The partial condition (deleted_at IS NULL) matches the query filter exactly,
-- so Postgres can use an index-only scan.

CREATE INDEX IF NOT EXISTS idx_products_org_not_deleted
  ON public.products(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_locations_org_not_deleted
  ON public.locations(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_branches_org_not_deleted
  ON public.branches(organization_id) WHERE deleted_at IS NULL;

-- organization_members: authoritative source for organization.max_users
-- Filters match is_org_member(): status = 'active' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_org_members_org_active
  ON public.organization_members(organization_id)
  WHERE status = 'active' AND deleted_at IS NULL;
```

> **Performance note**: For tables with <10K rows per org, these counts are fast (<5ms) even without indexes. The partial indexes become important at scale (>100K rows) or under high concurrency. They are cheap to maintain and worth adding proactively.

**7.3 Create EntitlementsLimitService** (20 min)

File: `src/lib/services/entitlements-limit-service.ts`

```typescript
"use server";

import { createClient } from "@/utils/supabase/server";
import { LIMIT_STRATEGIES } from "@/lib/entitlements/limit-keys";

export class EntitlementsLimitService {
  /**
   * Get effective limit for org (from compiled entitlements)
   */
  static async getEffectiveLimit(orgId: string, limitKey: string): Promise<number> {
    const supabase = await createClient();

    const { data: entitlements, error } = await supabase
      .from("organization_entitlements")
      .select("limits")
      .eq("organization_id", orgId)
      .single();

    if (error || !entitlements) {
      return 0;
    }

    const limit = entitlements.limits[limitKey] as number;
    return limit !== undefined ? limit : 0;
  }

  /**
   * Get current usage (derived or metered)
   */
  static async getCurrentUsage(orgId: string, limitKey: string): Promise<number> {
    const strategy = LIMIT_STRATEGIES[limitKey];

    if (!strategy) {
      console.warn(`Unknown limit key: ${limitKey}`);
      return 0;
    }

    if (strategy.type === "derived") {
      return this.getDerivedCount(orgId, strategy.table!);
    } else {
      return this.getMeteredUsage(orgId, limitKey);
    }
  }

  /**
   * Assert under limit (throws if exceeded)
   */
  static async assertUnderLimit(orgId: string, limitKey: string) {
    const limit = await this.getEffectiveLimit(orgId, limitKey);

    // -1 means unlimited
    if (limit === -1) {
      return;
    }

    const current = await this.getCurrentUsage(orgId, limitKey);

    if (current >= limit) {
      throw new Error(
        `Limit exceeded for ${limitKey}: ${current}/${limit}. Upgrade your plan to continue.`
      );
    }
  }

  /**
   * Get derived count from table.
   * Uses select("id", ...) for performance — only counts, doesn't fetch data.
   * Combined with partial indexes (WHERE deleted_at IS NULL), this is efficient.
   */
  private static async getDerivedCount(orgId: string, table: string): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) {
      console.error(`Error counting ${table}:`, error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get metered usage from subscription_usage
   */
  private static async getMeteredUsage(orgId: string, limitKey: string): Promise<number> {
    const supabase = await createClient();

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: usage } = await supabase
      .from("subscription_usage")
      .select("current_value")
      .eq("organization_id", orgId)
      .eq("feature_key", limitKey)
      .eq("period_start", periodStart.toISOString())
      .single();

    return usage?.current_value || 0;
  }
}
```

**7.4 Apply indexes migration**

```bash
npm run supabase:migration:up
```

**Deliverable**: Limit enforcement with registry + service + optimized queries

---

## Phase 8 — Dev Tooling (45 min)

### Prerequisite

**Architecture Decision**: This phase assumes **Option A (SECURITY DEFINER RPCs)** per the recommendation above. If you choose Option B, convert these SQL functions to Server Actions with `createServiceClient()`.

### Dev Mode Safety: DB-Enforced Gate (Critical)

**Problem**: An `.env` flag (`ENTITLEMENTS_DEV_MODE`) cannot be read by Postgres functions. If dev RPC migrations are accidentally applied to production, nothing would stop authenticated org owners from calling `dev_set_org_plan()` to give themselves enterprise access for free.

**Solution**: A DB-level `app_config` table stores a `dev_mode_enabled` boolean. Every dev RPC checks this flag as its FIRST statement. In production, this flag is `false` and all dev RPCs raise an exception immediately.

> **Deployment safety note**: The dev RPC migration should ideally never be applied to production. The DB gate is mandatory defense-in-depth — even if the migration leaks, the RPCs are inert because `app_config.dev_mode_enabled` defaults to `false` and is never seeded as `true` in migration SQL. To enable dev mode, run `UPDATE public.app_config SET dev_mode_enabled = true WHERE id = 1;` manually in dev environments only.

### Tasks

**8.1 Create app_config table and dev mode gate** (5 min)

Add to the dev entitlements migration:

```sql
-- =====================================================
-- APP CONFIG TABLE (single-row, stores system flags)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  dev_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: dev mode OFF by default (safe for production).
-- NEVER seed as true — if this migration leaks to prod, dev RPCs remain inert.
INSERT INTO public.app_config (id, dev_mode_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TO ENABLE DEV MODE (run manually in dev environment ONLY):
--   UPDATE public.app_config SET dev_mode_enabled = true WHERE id = 1;
-- Or add a dev-only seed script that is NOT deployed to production.
-- =====================================================

-- RLS: readable by authenticated, writable by service_role only
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config FORCE ROW LEVEL SECURITY;

CREATE POLICY "app_config_select" ON public.app_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_config_modify" ON public.app_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.app_config IS 'Single-row system configuration. dev_mode_enabled must be false in production.';
```

**8.2 Create assert_dev_mode_enabled() helper** (3 min)

```sql
-- =====================================================
-- DEV MODE GATE (must be called as first statement in every dev_* RPC)
-- =====================================================
CREATE OR REPLACE FUNCTION public.assert_dev_mode_enabled()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_config WHERE id = 1 AND dev_mode_enabled = true
  ) THEN
    RAISE EXCEPTION 'Dev mode is not enabled. Set app_config.dev_mode_enabled = true to use dev RPCs.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
```

**8.3 Add ENTITLEMENTS_DEV_MODE env flag for UI gating** (2 min)

File: `.env.local`

```env
# Controls whether the dev billing UI page is accessible.
# The DB-level gate (app_config.dev_mode_enabled) is the authoritative check.
ENTITLEMENTS_DEV_MODE=true
```

> The env flag gates the UI page visibility only. The DB flag gates the actual RPC execution. Both must be true for dev tooling to work.

**8.4-8.8 Create dev RPCs** (25 min)

Create migration: `supabase migration new dev_entitlements_rpcs`

```sql
-- =====================================================
-- DEV MODE RPCs (guarded by dev_mode + org_owner role)
-- All functions use SECURITY DEFINER SET search_path TO ''
-- They execute as postgres (rolbypassrls = true), bypassing FORCE RLS
-- EVERY function calls assert_dev_mode_enabled() FIRST, then checks org_owner role
-- =====================================================

-- Helper: check if user has org_owner role via Permissions V2
-- Uses user_role_assignments + roles tables (authoritative for RBAC)
CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = auth.uid()
      AND ura.scope = 'org'
      AND ura.scope_id = p_org_id
      AND r.name = 'org_owner'
      AND ura.deleted_at IS NULL
      AND r.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Set org plan
CREATE OR REPLACE FUNCTION public.dev_set_org_plan(
  p_org_id UUID,
  p_plan_name TEXT
)
RETURNS void AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Gate: dev mode must be enabled in DB
  PERFORM public.assert_dev_mode_enabled();

  -- Guard: must be org owner (role-based via Permissions V2)
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Get plan ID
  SELECT id INTO v_plan_id
  FROM public.subscription_plans
  WHERE name = p_plan_name AND is_active = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_name;
  END IF;

  -- Upsert subscription
  INSERT INTO public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    is_development,
    dev_expires_at,
    current_period_start,
    current_period_end
  ) VALUES (
    p_org_id,
    v_plan_id,
    'active',
    true,
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = v_plan_id,
    status = 'active',
    is_development = true,
    dev_expires_at = NOW() + INTERVAL '30 days',
    updated_at = NOW();

  -- Recompute entitlements (trigger fires automatically on UPDATE)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Add module addon
CREATE OR REPLACE FUNCTION public.dev_add_module_addon(
  p_org_id UUID,
  p_module_slug TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  INSERT INTO public.organization_module_addons (
    organization_id,
    module_slug,
    status,
    starts_at
  ) VALUES (
    p_org_id,
    p_module_slug,
    'active',
    NOW()
  )
  ON CONFLICT (organization_id, module_slug) WHERE status = 'active'
  DO UPDATE SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Remove module addon
CREATE OR REPLACE FUNCTION public.dev_remove_module_addon(
  p_org_id UUID,
  p_module_slug TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  UPDATE public.organization_module_addons
  SET status = 'canceled', ends_at = NOW()
  WHERE organization_id = p_org_id
    AND module_slug = p_module_slug
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Set limit override
CREATE OR REPLACE FUNCTION public.dev_set_limit_override(
  p_org_id UUID,
  p_limit_key TEXT,
  p_override_value INTEGER
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  INSERT INTO public.organization_limit_overrides (
    organization_id,
    limit_key,
    override_value
  ) VALUES (
    p_org_id,
    p_limit_key,
    p_override_value
  )
  ON CONFLICT (organization_id, limit_key) DO UPDATE SET
    override_value = p_override_value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Reset org to free plan
CREATE OR REPLACE FUNCTION public.dev_reset_org_to_free(p_org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  -- Remove addons
  DELETE FROM public.organization_module_addons WHERE organization_id = p_org_id;

  -- Remove overrides
  DELETE FROM public.organization_limit_overrides WHERE organization_id = p_org_id;

  -- Set to free plan (dev mode check already passed, dev_set_org_plan will check again — safe redundancy)
  PERFORM public.dev_set_org_plan(p_org_id, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Dev: Simulate subscription change (like webhook)
CREATE OR REPLACE FUNCTION public.dev_simulate_subscription_change(
  p_org_id UUID,
  p_event_type TEXT,
  p_plan_name TEXT
)
RETURNS void AS $$
BEGIN
  PERFORM public.assert_dev_mode_enabled();
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Permission denied: not org owner';
  END IF;

  CASE p_event_type
    WHEN 'subscription.created', 'subscription.updated' THEN
      PERFORM public.dev_set_org_plan(p_org_id, p_plan_name);
    WHEN 'subscription.canceled' THEN
      UPDATE public.organization_subscriptions
      SET status = 'canceled', updated_at = NOW()
      WHERE organization_id = p_org_id;
    ELSE
      RAISE EXCEPTION 'Unknown event type: %', p_event_type;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- =====================================================
-- PRIVILEGE HARDENING FOR DEV RPCs
-- =====================================================
-- Supabase default ACL auto-grants EXECUTE to anon, authenticated, service_role.
-- Dev RPCs must NOT be callable by anon. Restrict to authenticated + service_role only.
-- (The assert_dev_mode_enabled() + is_org_owner() guards are defense-in-depth,
-- but REVOKE prevents unnecessary attack surface.)

REVOKE ALL ON FUNCTION public.dev_set_org_plan(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_set_org_plan(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_add_module_addon(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_add_module_addon(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_remove_module_addon(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_remove_module_addon(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_set_limit_override(UUID, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_reset_org_to_free(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_reset_org_to_free(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dev_simulate_subscription_change(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_simulate_subscription_change(UUID, TEXT, TEXT) TO authenticated, service_role;

-- Also restrict helper functions
REVOKE ALL ON FUNCTION public.assert_dev_mode_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_dev_mode_enabled() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;
```

**8.7 Create Dev Billing Page** (15 min)

File: `src/app/[locale]/dashboard/organization/billing-dev/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";

export default function BillingDevPage() {
  const { activeOrgId, entitlements } = useAppStore();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    const supabase = createClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    setPlans(data || []);
  }

  async function switchPlan(planName: string) {
    if (!activeOrgId) return;
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("dev_set_org_plan", {
        p_org_id: activeOrgId,
        p_plan_name: planName,
      });

      if (error) throw error;

      toast.success(`Switched to ${planName} plan`);
      window.location.reload(); // Reload to refresh entitlements via SSR
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetToFree() {
    if (!activeOrgId) return;
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("dev_reset_org_to_free", {
        p_org_id: activeOrgId,
      });

      if (error) throw error;

      toast.success("Reset to free plan");
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!entitlements) return <div>Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Billing (Dev Mode)</h1>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{entitlements.plan_name}</p>
          <div className="mt-4">
            <h3 className="font-semibold">Enabled Modules:</h3>
            <ul className="list-disc list-inside">
              {entitlements.enabled_modules.map((m: string) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold">Limits:</h3>
            <pre className="bg-gray-100 p-2 rounded">
              {JSON.stringify(entitlements.limits, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Switch Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.map((plan) => (
            <Button
              key={plan.id}
              onClick={() => switchPlan(plan.name)}
              disabled={loading || plan.name === entitlements.plan_name}
              variant={plan.name === entitlements.plan_name ? "secondary" : "default"}
            >
              {plan.name === entitlements.plan_name ? "Current: " : ""}
              {plan.display_name?.en || plan.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader>
          <CardTitle>Reset</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={resetToFree} disabled={loading} variant="destructive">
            Reset to Free (Remove All Addons/Overrides)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**8.8 Test** (3 min)

Navigate to `/dashboard/organization/billing-dev` and test plan switching.

**Deliverable**: Dev tooling to simulate plans without Stripe

---

## Phase 9 — UI/UX Polish (30 min)

### Tasks

**9.1 Update sidebar for locked modules** (10 min)

File: `src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx`

Add logic to render locked modules separately with lock icon and upgrade CTA.

**9.2 Add upgrade modal** (10 min)

Create: `src/components/subscription/UpgradeModal.tsx`

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleSlug: string;
  requiredPlan: string;
}

export function UpgradeModal({ isOpen, onClose, moduleSlug, requiredPlan }: UpgradeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Upgrade Required
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            The <strong>{moduleSlug}</strong> module requires the <strong>{requiredPlan}</strong>{" "}
            plan.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => (window.location.href = "/dashboard/organization/billing-dev")}>
              View Plans
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**9.3 Update SubscriptionGate — no client fallbacks** (5 min)

File: `src/components/subscription/subscription-gate.tsx`

The existing `SubscriptionGate` uses SWR hooks to load subscription data client-side. Update it to:

1. Read entitlements from app store (already loaded via SSR)
2. If entitlements are missing, show a repair CTA instead of silently granting access

```typescript
// BEFORE (client-side SWR)
const { data: moduleAccess } = useModuleAccess(module || "", activeOrgId);
if (module && moduleAccess === false) return false;

// AFTER (entitlements from store)
const { entitlements } = useAppStore();

if (!entitlements) {
  // INVARIANT VIOLATION: entitlements should always be loaded
  // Show repair CTA instead of granting access
  return <EntitlementsMissingCTA />;
}

if (module && !entitlements.enabled_modules.includes(module)) return false;
if (feature && !entitlements.features[feature]) return false;
```

**9.4 Add limit reached handling** (5 min)

Update action error handling to catch `EntitlementError` and show appropriate toast:

```typescript
// In action error handlers
import { EntitlementError } from "@/lib/errors/entitlements-errors";

try {
  await createProduct(data);
} catch (error) {
  if (error instanceof EntitlementError) {
    switch (error.code) {
      case "LIMIT_EXCEEDED":
        toast.error(
          `Limit reached: ${error.context.current}/${error.context.limit}. Upgrade your plan.`
        );
        break;
      case "MODULE_ACCESS_DENIED":
        toast.error(`Module not available on your current plan.`);
        break;
      default:
        toast.error("Access denied. Please upgrade your plan.");
    }
  }
}
```

**Deliverable**: Polished UI for locked modules and limits, no silent fallbacks

---

## Phase 10 — Testing & Cleanup (30 min)

### Tasks

**10.1-10.4 RLS & Enforcement Tests** (15 min)

Manual testing checklist:

```bash
# Test RLS
psql> SELECT * FROM organization_entitlements; -- as org member -> should return row
psql> INSERT INTO organization_subscriptions ...; -- as authenticated -> should fail

# Test module access
# Try accessing /dashboard-old/analytics without professional plan -> redirect to upgrade

# Test limit
# Create products until limit -> server action throws LIMIT_EXCEEDED
```

**10.5 Remove hardcoded fallbacks** (10 min)

Search and remove:

- `["home", "warehouse"]` arrays used as default modules
- `alwaysAvailable` flags in module configs
- Any `subscription === null` fallback returns
- `isDefaultModule()` method

**10.6 Test upgrade flow** (5 min)

1. Start on free plan
2. Navigate to billing-dev page
3. Switch to professional plan
4. Verify analytics module appears in sidebar
5. Navigate to analytics -> works
6. Switch back to free
7. Verify analytics disappears from sidebar
8. Try direct URL `/dashboard-old/analytics` -> redirects to upgrade page

**10.7 Verify no flicker on SSR**

1. Hard refresh any dashboard page
2. Sidebar should render correct modules immediately (no loading skeleton then change)

**10.8 SECURITY DEFINER audit** (new)

Verify every SECURITY DEFINER function includes `SET search_path TO ''`:

```sql
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;
```

Check that every result includes `SET search_path TO ''` (or `SET search_path = ''`).

**Deliverable**: All tests pass, no hardcoded fallbacks remain, all functions hardened

---

## Payment Provider Integration (Future)

When adding Stripe/Paddle:

1. **Webhook handler** receives `subscription.created/updated/canceled`
2. **Handler maps** provider data -> `organization_subscriptions` (plan_id, status, periods)
3. **Triggers fire** -> recomputes `organization_entitlements`
4. **No other code changes needed**

**Dev simulation** already mimics this flow via `dev_simulate_subscription_change()`.

---

## Data Model Conventions

- **Module slug**: Unique identifier for entitlement matching (keep `id` for React keys only)
- **Limit values**: `-1` = unlimited, `>= 0` = cap
- **Soft deletes**: All derived counts filter `deleted_at IS NULL`
- **Derived vs metered**: Entity limits (products, users) are derived from row counts; event limits (exports) use counters
- **SECURITY DEFINER**: All functions that write to RLS-protected tables must be `SECURITY DEFINER SET search_path TO ''`
- **organization.max_users**: Counted from `public.organization_members` WHERE `status = 'active' AND deleted_at IS NULL`. NOT from `user_role_assignments` (which has no `organization_id` column).

### Limits JSONB Key Contract

**Format**: Flat top-level keys using dot notation — `"module.limit_name"`.

```jsonb
-- CORRECT (flat keys):
{"warehouse.max_products": 100, "organization.max_users": 3, "warehouse.max_locations": 5}

-- WRONG (nested):
{"warehouse": {"max_products": 100}, "organization": {"max_users": 3}}
```

**Rules**:

1. All limit keys in `subscription_plans.limits`, `organization_entitlements.limits`, and `organization_limit_overrides.limit_key` use the SAME flat key string.
2. The dot (`.`) in the key name is just a naming convention — it is NOT a JSONB path separator. The key `"warehouse.max_products"` is a single top-level JSONB key.
3. When using `jsonb_set()` to apply overrides, the path array has ONE element: `ARRAY['warehouse.max_products']` (not `ARRAY['warehouse', 'max_products']`).
4. When reading limits in TypeScript, access via: `limits["warehouse.max_products"]` (bracket notation, not `limits.warehouse.max_products`).
5. The canonical key registry is `LIMIT_KEYS` in `src/lib/entitlements/limit-keys.ts`. All code MUST use these constants; no raw strings.

---

## Final Checklist

- [ ] All phases completed (0-10)
- [ ] No `.sql.disabled` migration exists (replaced with baseline)
- [ ] RLS enabled and FORCED on all subscription tables
- [ ] Every org has entitlements row
- [ ] SSR loads only `organization_entitlements` (not full subscription join)
- [ ] Server actions enforce module access + limits
- [ ] Route-level SSR guards exist for premium modules (**both** `/dashboard` v2 and `/dashboard-old`)
- [ ] Dev UI allows plan switching
- [ ] Dev RPCs all call `assert_dev_mode_enabled()` as first statement
- [ ] `app_config.dev_mode_enabled = false` in production
- [ ] `is_org_owner()` uses Permissions V2 role check (not `organizations.created_by`)
- [ ] No hardcoded module fallbacks remain
- [ ] No client-side fallbacks (missing entitlements = repair CTA)
- [ ] All limit keys use namespaced flat format consistently (see Limits JSONB Key Contract)
- [ ] Limit key reseeds use key-rename approach (preserve unknown keys)
- [ ] All SECURITY DEFINER functions include `SET search_path TO ''`
- [ ] All table references in SECURITY DEFINER functions are fully qualified (`public.table_name`)
- [ ] All function calls inside SECURITY DEFINER functions are fully qualified (`public.function_name()`)
- [ ] REVOKE/GRANT hardening applied: dev RPCs callable by `authenticated`/`service_role` only (not `anon`/`PUBLIC`)
- [ ] `organization.max_users` counts from `organization_members` (status='active', deleted_at IS NULL), NOT `user_role_assignments`
- [ ] No hardcoded route allowlists — v2 dashboard guard uses module registry
- [ ] Advisory locks use per-org keys via `hashtext(p_org_id::text)`
- [ ] Derived counts use `select("id", ...)` not `select("*", ...)`
- [ ] Partial indexes exist for count queries (match actual table columns)
- [ ] Tests pass

**ESTIMATED TOTAL TIME: ~7 hours (aggressive 1-day execution)**

---

## Appendix: Key Concepts Explained

### A. RLS vs Application Permissions — Two Different Layers

**Row Level Security (RLS)** is a PostgreSQL feature that controls which _rows_ a database user can see or modify. It operates at the database level — even if your application code tries to `SELECT * FROM subscriptions`, RLS policies will filter out rows the user shouldn't see. Think of it as a security net that catches anything your application code misses.

**Application permissions** (our Permissions V2 system) control what _actions_ a user can perform in the UI. For example, "can this user create a product?" or "can this user invite team members?". These are checked in TypeScript code (server actions, hooks).

**Why both?** Defense in depth. If a bug in your TypeScript code skips a permission check, RLS still prevents unauthorized data access. If RLS has a gap, application permissions still block the UI action.

In this plan:

- **RLS** protects subscription tables (users can read their org's data but never write directly)
- **Application guards** (`requireModuleAccess`, `requireWithinLimit`) check entitlements in server actions
- **SSR guards** (`requireModuleAccessSSR`) redirect unauthorized route access
- **Client guards** (`SubscriptionGate`) hide UI elements (not a security boundary, just UX)

### B. What "Compiled Entitlements" Means

Instead of computing "what modules does this org have access to?" on every page load by joining multiple tables (subscription + plan + addons + overrides), we pre-compute the answer and store it in a single `organization_entitlements` row.

**The compilation formula**:

```
enabled_modules = plan.enabled_modules + active_addons.module_slugs (deduplicated)
limits = plan.limits merged with overrides (overrides win)
features = plan.features (directly)
```

**When it recomputes**: Automatically via database triggers whenever the subscription, addons, or overrides change. This means the entitlements row is always current.

**Why this matters**: Reading one row is much faster than joining 4 tables. And it's a single source of truth — all code reads from the same pre-computed result.

### C. Derived Limits vs Metered Limits

**Derived limits** count existing rows to determine current usage:

- "How many products does this org have?" -> `SELECT count(id) FROM products WHERE org_id = ? AND deleted_at IS NULL`
- Always accurate (can't drift from reality)
- Used for: max_products, max_locations, max_users

**Metered limits** use a counter that gets incremented on each event:

- "How many exports has this org done this month?" -> counter in `subscription_usage` table
- Can drift if events aren't properly tracked
- Used for: monthly_exports, API calls, email sends
- Resets each billing period

### D. SSR-First Loading Pattern

**Problem**: If entitlements are loaded client-side (after the page renders), there's a flash where all modules appear briefly, then some disappear when the subscription check completes.

**Solution**: Load entitlements during Server-Side Rendering (SSR), before any HTML is sent to the browser. The sidebar renders with the correct modules from the very first paint.

**Implementation**: `loadAppContextServer()` fetches the `organization_entitlements` row, which is then passed to `getAccessibleModules()`, which filters the module list before rendering.

### E. SECURITY DEFINER and search_path

`SECURITY DEFINER` means a PostgreSQL function executes with the _owner's_ privileges, not the _caller's_. In our Supabase instance, functions are owned by `postgres`, which has `rolbypassrls = true`. This lets the function write to RLS-protected tables even though the calling user (`authenticated`) cannot.

The `SET search_path TO ''` clause is a security hardening measure. Without it, a malicious user could potentially create objects in a schema that shadows standard tables (a "search_path injection" attack). With an empty search_path, all table references in the function must be fully qualified (e.g., `public.organizations`), making such attacks impossible.

**Rule**: Every `SECURITY DEFINER` function in this codebase MUST include `SET search_path TO ''`.

---

## Plan Patch Summary (Round 2)

Fixes applied to correct incomplete/risky areas identified after Round 1:

- **A) DEV MODE ENFORCEMENT — DB-ENFORCED GATE**: Added `app_config` single-row table with `dev_mode_enabled` boolean, `assert_dev_mode_enabled()` SECURITY DEFINER helper, and `PERFORM public.assert_dev_mode_enabled();` as the first statement in ALL 6 dev RPCs (`dev_set_org_plan`, `dev_add_module_addon`, `dev_remove_module_addon`, `dev_set_limit_override`, `dev_reset_org_to_free`, `dev_simulate_subscription_change`). The env flag (`ENTITLEMENTS_DEV_MODE`) only gates UI page visibility; the DB flag is the authoritative gate.

- **B) LIMITS NORMALIZATION — PRESERVE UNKNOWN KEYS**: Changed Phase 0.2 reseed and Phase 4.1 plan UPDATEs from `jsonb_build_object()` (which replaces entire column, dropping unknown keys) to key-rename approach: `limits - 'old_key' || jsonb_build_object('new_key', value)`. This preserves any keys not explicitly listed in the rename.

- **C) ROUTE PROTECTION SCOPE — BOTH DASHBOARDS**: Added explicit scope decision table and implementation notes for both `/dashboard-old` (per-module layout.tsx guards) and `/dashboard` v2 (`[...slug]` catch-all guard that extracts module from `params.slug[0]`). Added task 5.5.2b with code for the v2 catch-all guard.

- **D) ORG OWNER MODEL — ROLE-BASED (PERMISSIONS V2)**: Added "Ownership Definition" section explaining why `org_owner` role via `user_role_assignments` + `roles` is used instead of `organizations.created_by`. The `is_org_owner()` function was rewritten to check Permissions V2 role assignment. All dev RPCs now call `public.is_org_owner()` (fully qualified).

- **E) SEARCH_PATH STANDARDIZATION**: Added explicit standardization section declaring `SET search_path TO ''` (empty) as the standard, matching the existing `is_org_member()` convention. All SECURITY DEFINER functions must fully qualify table references with `public.`.

---

## What Remains Good / Unchanged

The following aspects were verified correct and preserved as-is:

1. **SECURITY DEFINER + `SET search_path TO ''`** on all privileged functions — already consistent throughout.
2. **Namespaced limit keys** (`module.limit_name` format) — Phase 0.2 reseed + Phase 4.1 backfill both use this format.
3. **`is_org_member()` verification-only** — Phase 0.2 verifies the function exists without replacing it (live function checks `organization_members`).
4. **Professional plan limits match live DB** — 10000 products, 100 locations, 50 users (not the wrong 1000/50/25).
5. **Free plan seed values are intentional updates** — `max_users: 2→3`, modules add contacts/documentation, remove development.
6. **`createServiceClient()`** naming — correct function name from `@/utils/supabase/service`.
7. **Limit key verification SQL** in Phase 4.4 — checks both `subscription_plans` and `organization_entitlements` for un-namespaced keys.
8. **SSR-first loading** — loads only `organization_entitlements` (single row), not full subscription join.

---

## Plan Patch Summary (Round 3 — Implementation-Ready Hardening)

Fixes applied to make the plan migration-ready. All verified against live Supabase DB.

- **B1) FULLY QUALIFIED REFS**: Every table reference (`public.table`) and function call (`public.function()`) inside SECURITY DEFINER functions is now fully qualified. Critical fix: `trigger_recompute_entitlements()` and `recompute_all_entitlements()` had unqualified calls to `recompute_organization_entitlements()` — these would fail at runtime with `SET search_path TO ''`. All CREATE FUNCTION and CREATE TABLE/TRIGGER statements also qualified. Trigger definitions include idempotent `DROP TRIGGER IF EXISTS` before CREATE.

- **B2) ORGANIZATION.MAX_USERS LOCKED TO organization_members**: `LIMIT_STRATEGIES` was using `table: "user_role_assignments"` but that table has NO `organization_id` column. Partial index `idx_user_role_assignments_org_not_deleted` referenced a nonexistent column. Fixed to use `organization_members` with `extraFilters: { status: "active" }`, matching `is_org_member()`. Partial index now on `organization_members(organization_id) WHERE status = 'active' AND deleted_at IS NULL`.

- **B3) NO HARDCODED ROUTE ALLOWLIST**: Removed `coreRoutes = ["start", "account", ...]` from v2 dashboard guard. Replaced with module-registry lookup: `getAllModules()` is called, and only routes matching a registered module slug get entitlement checks. Non-module routes pass through. No arrays to drift.

- **B4) SAFE DEFAULT FOR app_config**: Changed seed from `dev_mode_enabled = true` to `false`. Migration never enables dev mode. Manual SQL required in dev: `UPDATE public.app_config SET dev_mode_enabled = true WHERE id = 1;`.

- **B5) REVOKE/GRANT EXECUTE HARDENING**: Added explicit `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` for all 8 functions (6 dev RPCs + `assert_dev_mode_enabled` + `is_org_owner`). Supabase default ACL auto-grants EXECUTE to anon — this blocks that.

- **B6) ADVISORY LOCK CLARIFIED**: Added inline documentation explaining per-org lock key strategy, `hashtext()` stability, and auto-release via `pg_advisory_xact_lock`.

- **B7) FLAT JSONB KEY CONTRACT**: Added "Limits JSONB Key Contract" section with explicit format rules, correct/wrong examples, `jsonb_set` path semantics, TypeScript access pattern, and mandate to use `LIMIT_KEYS` constants.

---

**END OF PLAN**
