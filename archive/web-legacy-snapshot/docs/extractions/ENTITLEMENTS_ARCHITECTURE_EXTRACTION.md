# Entitlements Architecture Extraction (Complete)

## Context

This document is a **pure technical extraction** of the current entitlements/subscription system. It captures the exact current state from real code files and live database queries. No redesign. No improvements. No assumptions.

---

# 1. TABLES

## 1.1 `subscription_plans`

**Purpose:** Available subscription plans (public catalog).

| Column              | Type           | Default             | Notes                                                 |
| ------------------- | -------------- | ------------------- | ----------------------------------------------------- |
| `id`                | UUID PK        | `gen_random_uuid()` |                                                       |
| `stripe_product_id` | TEXT           |                     | Stripe integration (nullable)                         |
| `name`              | TEXT NOT NULL  |                     | Unique constraint (`subscription_plans_name_key`)     |
| `display_name`      | JSONB NOT NULL |                     | i18n: `{"en": "Free Plan", "pl": "Plan Darmowy"}`     |
| `description`       | JSONB          |                     | i18n                                                  |
| `price_monthly`     | INTEGER        |                     | In cents                                              |
| `price_yearly`      | INTEGER        |                     | In cents                                              |
| `is_active`         | BOOLEAN        | `true`              |                                                       |
| `sort_order`        | INTEGER        | `0`                 |                                                       |
| `enabled_modules`   | TEXT[]         | `ARRAY[]::text[]`   | Module slugs enabled by this plan                     |
| `enabled_contexts`  | TEXT[]         | `ARRAY[]::text[]`   | Context slugs (warehouse, ecommerce, b2b, pos)        |
| `features`          | JSONB          | `'{}'::jsonb`       | Feature flags (boolean values)                        |
| `limits`            | JSONB          | `'{}'::jsonb`       | Flat namespaced keys: `"warehouse.max_products": 100` |
| `created_at`        | TIMESTAMPTZ    | `NOW()`             |                                                       |
| `updated_at`        | TIMESTAMPTZ    | `NOW()`             | Auto-updated by trigger                               |

**Indexes:**

- `idx_subscription_plans_active` ON `(is_active, sort_order)`

**RLS:** Enabled + FORCE

- `subscription_plans_select_authenticated`: SELECT for `authenticated` WHERE `is_active = true`
- `subscription_plans_modify_service`: ALL for `service_role`

---

## 1.2 `organization_subscriptions`

**Purpose:** One active subscription per organization.

| Column                   | Type                                            | Default                      | Notes                                                                       |
| ------------------------ | ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| `id`                     | UUID PK                                         | `gen_random_uuid()`          |                                                                             |
| `organization_id`        | UUID FK → `organizations(id)` ON DELETE CASCADE |                              | Unique constraint                                                           |
| `plan_id`                | UUID FK → `subscription_plans(id)`              |                              |                                                                             |
| `stripe_subscription_id` | TEXT                                            |                              | Stripe integration (nullable)                                               |
| `stripe_customer_id`     | TEXT                                            |                              | Stripe integration (nullable)                                               |
| `status`                 | TEXT NOT NULL                                   | `'active'`                   | CHECK: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete` |
| `trial_start`            | TIMESTAMPTZ                                     |                              |                                                                             |
| `trial_end`              | TIMESTAMPTZ                                     |                              |                                                                             |
| `current_period_start`   | TIMESTAMPTZ NOT NULL                            | `NOW()`                      |                                                                             |
| `current_period_end`     | TIMESTAMPTZ NOT NULL                            | `NOW() + INTERVAL '1 month'` |                                                                             |
| `is_development`         | BOOLEAN                                         | `false`                      | Dev subscriptions flagged                                                   |
| `dev_expires_at`         | TIMESTAMPTZ                                     |                              | Auto-expiry for dev subscriptions                                           |
| `created_at`             | TIMESTAMPTZ                                     | `NOW()`                      |                                                                             |
| `updated_at`             | TIMESTAMPTZ                                     | `NOW()`                      | Auto-updated by trigger                                                     |

**Constraints:**

- `organization_subscriptions_organization_id_key` UNIQUE on `organization_id` (one sub per org)
- `organization_subscriptions_status_check` CHECK on status values

**Indexes:**

- `idx_org_subscriptions_active` ON `(organization_id, status)`

**RLS:** Enabled + FORCE

- `org_subscriptions_select_member`: SELECT for `authenticated` WHERE `is_org_member(organization_id)`
- `org_subscriptions_modify_service`: ALL for `service_role`

---

## 1.3 `subscription_usage`

**Purpose:** Monthly usage tracking for metered limits.

| Column            | Type                                            | Default             | Notes                                         |
| ----------------- | ----------------------------------------------- | ------------------- | --------------------------------------------- |
| `id`              | UUID PK                                         | `gen_random_uuid()` |                                               |
| `organization_id` | UUID FK → `organizations(id)` ON DELETE CASCADE |                     |                                               |
| `feature_key`     | TEXT NOT NULL                                   |                     | Limit key (e.g., `analytics.monthly_exports`) |
| `current_value`   | INTEGER                                         | `0`                 | Usage counter                                 |
| `period_start`    | TIMESTAMPTZ NOT NULL                            |                     | Billing period start                          |
| `period_end`      | TIMESTAMPTZ NOT NULL                            |                     | Billing period end                            |
| `created_at`      | TIMESTAMPTZ                                     | `NOW()`             |                                               |
| `updated_at`      | TIMESTAMPTZ                                     | `NOW()`             | Auto-updated by trigger                       |

**Constraints:**

- UNIQUE on `(organization_id, feature_key, period_start)`

**Indexes:**

- `idx_subscription_usage_lookup` ON `(organization_id, feature_key, period_start, period_end)`

**RLS:** Enabled + FORCE

- `subscription_usage_select_member`: SELECT for `authenticated` WHERE `is_org_member(organization_id)`
- `subscription_usage_modify_service`: ALL for `service_role`

---

## 1.4 `organization_module_addons`

**Purpose:** Per-org module add-ons beyond the base plan.

| Column            | Type                                                     | Default             | Notes                                         |
| ----------------- | -------------------------------------------------------- | ------------------- | --------------------------------------------- |
| `id`              | UUID PK                                                  | `gen_random_uuid()` |                                               |
| `organization_id` | UUID NOT NULL FK → `organizations(id)` ON DELETE CASCADE |                     |                                               |
| `module_slug`     | TEXT NOT NULL                                            |                     | Validated against `modules` table in dev RPCs |
| `status`          | TEXT NOT NULL                                            | `'active'`          | CHECK: `active`, `canceled`                   |
| `starts_at`       | TIMESTAMPTZ NOT NULL                                     | `NOW()`             |                                               |
| `ends_at`         | TIMESTAMPTZ                                              |                     | NULL = no expiry                              |
| `created_at`      | TIMESTAMPTZ NOT NULL                                     | `NOW()`             |                                               |
| `updated_at`      | TIMESTAMPTZ NOT NULL                                     | `NOW()`             | Auto-updated by trigger                       |

**Indexes:**

- `idx_org_module_addons_active` UNIQUE ON `(organization_id, module_slug)` WHERE `status = 'active'`
- `idx_org_module_addons_org` ON `(organization_id)`

**RLS:** Enabled + FORCE

- `org_module_addons_select_member`: SELECT for `authenticated` WHERE `is_org_member(organization_id)`
- `org_module_addons_modify_service`: ALL for `service_role`

---

## 1.5 `organization_limit_overrides`

**Purpose:** Per-org limit overrides (override plan defaults).

| Column            | Type                                                     | Default             | Notes                                     |
| ----------------- | -------------------------------------------------------- | ------------------- | ----------------------------------------- |
| `id`              | UUID PK                                                  | `gen_random_uuid()` |                                           |
| `organization_id` | UUID NOT NULL FK → `organizations(id)` ON DELETE CASCADE |                     |                                           |
| `limit_key`       | TEXT NOT NULL                                            |                     | Flat namespaced: `warehouse.max_products` |
| `override_value`  | INTEGER NOT NULL                                         |                     | -1 = unlimited                            |
| `created_at`      | TIMESTAMPTZ NOT NULL                                     | `NOW()`             |                                           |
| `updated_at`      | TIMESTAMPTZ NOT NULL                                     | `NOW()`             | Auto-updated by trigger                   |

**Indexes:**

- `idx_org_limit_overrides_unique` UNIQUE ON `(organization_id, limit_key)`
- `idx_org_limit_overrides_org` ON `(organization_id)`

**RLS:** Enabled + FORCE

- `org_limit_overrides_select_member`: SELECT for `authenticated` WHERE `is_org_member(organization_id)`
- `org_limit_overrides_modify_service`: ALL for `service_role`

---

## 1.6 `organization_entitlements`

**Purpose:** Compiled entitlements snapshot per organization (single source of truth for SSR).

| Column             | Type                                                   | Default           | Notes                         |
| ------------------ | ------------------------------------------------------ | ----------------- | ----------------------------- |
| `organization_id`  | UUID **PK** FK → `organizations(id)` ON DELETE CASCADE |                   | One row per org               |
| `plan_id`          | UUID FK → `subscription_plans(id)`                     |                   |                               |
| `plan_name`        | TEXT NOT NULL                                          |                   | Denormalized plan name        |
| `enabled_modules`  | TEXT[] NOT NULL                                        | `ARRAY[]::text[]` | Union of plan + active addons |
| `enabled_contexts` | TEXT[] NOT NULL                                        | `ARRAY[]::text[]` | From plan only                |
| `features`         | JSONB NOT NULL                                         | `'{}'::jsonb`     | From plan only                |
| `limits`           | JSONB NOT NULL                                         | `'{}'::jsonb`     | Plan base + overrides applied |
| `updated_at`       | TIMESTAMPTZ NOT NULL                                   | `NOW()`           |                               |

**RLS:** Enabled + FORCE

- `organization_entitlements_select_policy`: SELECT for `authenticated` WHERE `is_org_member(organization_id)`
- `organization_entitlements_modify_policy`: ALL for `service_role`

---

## 1.7 `app_config`

**Purpose:** Single-row system configuration. Controls dev mode gate.

| Column             | Type                 | Default | Notes                                |
| ------------------ | -------------------- | ------- | ------------------------------------ |
| `id`               | INTEGER PK           | `1`     | CHECK `(id = 1)` enforces single row |
| `dev_mode_enabled` | BOOLEAN NOT NULL     | `false` | Must be false in production          |
| `updated_at`       | TIMESTAMPTZ NOT NULL | `NOW()` |                                      |

**Current live value:** `dev_mode_enabled = true`

**RLS:** Enabled + FORCE

- `app_config_select`: SELECT for `authenticated` USING `(true)` (anyone can read)
- `app_config_modify`: ALL for `service_role`

---

# 2. MIGRATIONS

All 8 migrations in order:

| #   | File                                             | Purpose                                                                                                                                                                                                                       |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20260211100000_entitlements_baseline.sql`       | Creates `subscription_plans`, `organization_subscriptions`, `subscription_usage`. Verifies pre-existing `update_updated_at_column()` and `is_org_member()`. Renames un-namespaced limit keys.                                 |
| 2   | `20260211100100_enable_subscription_rls.sql`     | Enables + FORCE RLS on all 3 subscription tables. Creates SELECT policies (authenticated) + ALL policies (service_role).                                                                                                      |
| 3   | `20260211100200_addons_and_overrides.sql`        | Creates `organization_module_addons` and `organization_limit_overrides` with RLS, unique indexes, updated_at triggers.                                                                                                        |
| 4   | `20260211100300_compiled_entitlements.sql`       | Creates `organization_entitlements` table + `recompute_organization_entitlements()` + `trigger_recompute_entitlements()` + `recompute_all_entitlements()`. Creates recompute triggers on subscription/addon/override changes. |
| 5   | `20260211100400_backfill_free_subscriptions.sql` | Seeds/updates free/professional/enterprise plans with namespaced limits. Backfills free subscriptions for all orgs without one. Calls `recompute_all_entitlements()`. Verification queries.                                   |
| 6   | `20260211100500_limit_indexes.sql`               | Creates partial indexes for count queries: products (org + not deleted), locations (org + not deleted), branches (org + not deleted), organization_members (org + active + not deleted).                                      |
| 7   | `20260211100600_dev_mode_gate_and_dev_rpcs.sql`  | Creates `app_config` table, `assert_dev_mode_enabled()`, `is_org_owner()`, 6 dev RPCs. REVOKE/GRANT privilege hardening (no anon access).                                                                                     |
| 8   | `20260212100000_validate_dev_rpcs.sql`           | Adds validation to `dev_add_module_addon` (validates slug exists in `modules` table) and `dev_set_limit_override` (validates against hardcoded allowlist). Re-states REVOKE/GRANT.                                            |

**All migrations are idempotent** — safe to re-run. Use `CREATE TABLE IF NOT EXISTS`, `DO $$ IF NOT EXISTS`, and `DROP TRIGGER IF EXISTS` patterns.

---

# 3. TRIGGERS & FUNCTIONS

## 3.1 Recompute Triggers (Live from Database)

| Trigger Name                       | Table                          | Event                                          | Function                           |
| ---------------------------------- | ------------------------------ | ---------------------------------------------- | ---------------------------------- |
| `recompute_on_subscription_change` | `organization_subscriptions`   | AFTER INSERT OR DELETE OR UPDATE, FOR EACH ROW | `trigger_recompute_entitlements()` |
| `recompute_on_addon_change`        | `organization_module_addons`   | AFTER INSERT OR DELETE OR UPDATE, FOR EACH ROW | `trigger_recompute_entitlements()` |
| `recompute_on_override_change`     | `organization_limit_overrides` | AFTER INSERT OR DELETE OR UPDATE, FOR EACH ROW | `trigger_recompute_entitlements()` |

**Recompute chain:** Any write to subscription/addon/override → `trigger_recompute_entitlements()` → `recompute_organization_entitlements(org_id)` → UPSERT into `organization_entitlements`.

## 3.2 Updated_at Triggers

| Trigger Name                                   | Table                          |
| ---------------------------------------------- | ------------------------------ |
| `update_subscription_plans_updated_at`         | `subscription_plans`           |
| `update_organization_subscriptions_updated_at` | `organization_subscriptions`   |
| `update_subscription_usage_updated_at`         | `subscription_usage`           |
| `update_org_module_addons_updated_at`          | `organization_module_addons`   |
| `update_org_limit_overrides_updated_at`        | `organization_limit_overrides` |

All call `update_updated_at_column()` (BEFORE UPDATE, FOR EACH ROW).

## 3.3 Core Functions (Live from Database)

### `recompute_organization_entitlements(p_org_id UUID) → void`

- **SECURITY DEFINER**, `search_path = ""`
- Takes advisory lock: `pg_advisory_xact_lock(hashtext(p_org_id::text))` — per-org concurrency protection
- Algorithm:
  1. Get active subscription (fallback to free plan if none)
  2. Build modules: plan.enabled_modules + active addons (deduplicated)
  3. Contexts: from plan only
  4. Features: from plan only
  5. Limits: plan.limits + override values applied via `jsonb_set`
  6. UPSERT into `organization_entitlements`

### `trigger_recompute_entitlements() → trigger`

- **SECURITY DEFINER**, `search_path = ""`
- Calls `recompute_organization_entitlements(COALESCE(NEW.organization_id, OLD.organization_id))`
- Returns `COALESCE(NEW, OLD)`

### `recompute_all_entitlements() → integer`

- **SECURITY DEFINER**, `search_path = ""`
- Loops over all organizations WHERE `deleted_at IS NULL`
- Calls `recompute_organization_entitlements()` for each
- Returns count of orgs processed

### `assert_dev_mode_enabled() → void`

- **SECURITY DEFINER**, `search_path = ""`
- Checks `app_config.dev_mode_enabled = true`
- Raises exception if not enabled

### `is_org_owner(p_org_id UUID) → boolean`

- **SECURITY DEFINER**, `search_path = ""`
- Checks `user_role_assignments` + `roles` tables
- Matches `auth.uid()` with `role.name = 'org_owner'` and `scope = 'org'` and `scope_id = p_org_id`
- Does NOT use `organizations.created_by`

---

# 4. RPCs (Dev Mode Gated)

All 6 dev RPCs share this pattern:

1. `PERFORM assert_dev_mode_enabled()` — gate
2. `IF NOT is_org_owner(p_org_id) THEN RAISE EXCEPTION` — authorization
3. Perform operation
4. All are `SECURITY DEFINER`, `search_path = ""`
5. REVOKE from PUBLIC/anon, GRANT to authenticated/service_role

| RPC                                | Arguments                                                     | Returns | Description                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev_set_org_plan`                 | `(p_org_id UUID, p_plan_name TEXT)`                           | `void`  | Upserts subscription with plan, sets `is_development = true`, `dev_expires_at = NOW() + 30 days`. Trigger auto-recomputes.                                |
| `dev_add_module_addon`             | `(p_org_id UUID, p_module_slug TEXT)`                         | `void`  | Validates slug exists in `modules` table. Advisory lock for concurrency. Reactivates existing canceled addon or inserts new. Trigger auto-recomputes.     |
| `dev_remove_module_addon`          | `(p_org_id UUID, p_module_slug TEXT)`                         | `void`  | Sets `status = 'canceled'`, `ends_at = NOW()` for active addon. Trigger auto-recomputes.                                                                  |
| `dev_set_limit_override`           | `(p_org_id UUID, p_limit_key TEXT, p_override_value INTEGER)` | `void`  | Validates limit_key against hardcoded allowlist. Upserts override. Trigger auto-recomputes.                                                               |
| `dev_reset_org_to_free`            | `(p_org_id UUID)`                                             | `void`  | DELETEs all addons and overrides for org. Calls `dev_set_org_plan(p_org_id, 'free')`.                                                                     |
| `dev_simulate_subscription_change` | `(p_org_id UUID, p_event_type TEXT, p_plan_name TEXT)`        | `void`  | Simulates webhook events: `subscription.created`/`subscription.updated` → calls `dev_set_org_plan`, `subscription.canceled` → updates status to canceled. |

### Limit Key Allowlist (hardcoded in `dev_set_limit_override`)

```sql
ARRAY[
  'warehouse.max_products',
  'warehouse.max_locations',
  'warehouse.max_branches',
  'organization.max_users',
  'analytics.monthly_exports'
]
```

---

# 5. RLS POLICIES (All Tables, Live from Database)

All entitlements tables use **Enabled + FORCE** RLS (applies even to table owner).

| Table                          | Policy                                    | Command | Role            | Condition                        |
| ------------------------------ | ----------------------------------------- | ------- | --------------- | -------------------------------- |
| `subscription_plans`           | `subscription_plans_select_authenticated` | SELECT  | `authenticated` | `is_active = true`               |
| `subscription_plans`           | `subscription_plans_modify_service`       | ALL     | `service_role`  | `true`                           |
| `organization_subscriptions`   | `org_subscriptions_select_member`         | SELECT  | `authenticated` | `is_org_member(organization_id)` |
| `organization_subscriptions`   | `org_subscriptions_modify_service`        | ALL     | `service_role`  | `true`                           |
| `subscription_usage`           | `subscription_usage_select_member`        | SELECT  | `authenticated` | `is_org_member(organization_id)` |
| `subscription_usage`           | `subscription_usage_modify_service`       | ALL     | `service_role`  | `true`                           |
| `organization_module_addons`   | `org_module_addons_select_member`         | SELECT  | `authenticated` | `is_org_member(organization_id)` |
| `organization_module_addons`   | `org_module_addons_modify_service`        | ALL     | `service_role`  | `true`                           |
| `organization_limit_overrides` | `org_limit_overrides_select_member`       | SELECT  | `authenticated` | `is_org_member(organization_id)` |
| `organization_limit_overrides` | `org_limit_overrides_modify_service`      | ALL     | `service_role`  | `true`                           |
| `organization_entitlements`    | `organization_entitlements_select_policy` | SELECT  | `authenticated` | `is_org_member(organization_id)` |
| `organization_entitlements`    | `organization_entitlements_modify_policy` | ALL     | `service_role`  | `true`                           |
| `app_config`                   | `app_config_select`                       | SELECT  | `authenticated` | `true` (everyone)                |
| `app_config`                   | `app_config_modify`                       | ALL     | `service_role`  | `true`                           |

**Pattern:** All org-scoped tables use `is_org_member(organization_id)` for SELECT. Only `service_role` can write. Dev RPCs bypass RLS via `SECURITY DEFINER` (function owner has `rolbypassrls`).

**Security model:**

- `is_org_member()` is `SECURITY DEFINER` with `search_path = ''`
- No INSERT/UPDATE/DELETE policies for `authenticated` — writes go through SECURITY DEFINER functions or service_role
- `subscription_plans` allows reading only active plans (no access to inactive/draft plans)

---

# 6. SERVER-SIDE READERS / WRITERS

## 6.1 Readers

### `EntitlementsService` (Primary — Server-Side)

**File:** `src/server/services/entitlements-service.ts`

- `"use server"` directive — safe for server components and server actions
- Uses React `cache()` for request-scoped deduplication of `loadEntitlements(orgId)`
- Reads from `organization_entitlements` table (single row query)

**Methods:**

| Method                 | Signature                                                     | Description                                                                      |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `loadEntitlements`     | `(orgId: string) → OrganizationEntitlements \| null`          | Single row query, request-cached                                                 |
| `hasModuleAccess`      | `(orgId, moduleSlug, entitlements?) → boolean`                | Checks `enabled_modules.includes(slug)`                                          |
| `requireModuleAccess`  | `(orgId, moduleSlug, entitlements?) → void`                   | Throws `EntitlementError("MODULE_ACCESS_DENIED")`                                |
| `hasFeatureAccess`     | `(orgId, featureKey, entitlements?) → boolean`                | Checks `features[key] === true`                                                  |
| `requireFeatureAccess` | `(orgId, featureKey, entitlements?) → void`                   | Throws `EntitlementError("FEATURE_UNAVAILABLE")`                                 |
| `getEffectiveLimit`    | `(orgId, limitKey, entitlements?) → number`                   | Returns limit value (-1 = unlimited, 0 = not set)                                |
| `getCurrentUsage`      | `(orgId, limitKey) → number`                                  | Gets current count (derived or metered)                                          |
| `checkLimit`           | `(orgId, limitKey, entitlements?) → LimitCheckResult \| null` | Returns `{limit, current, canProceed, percentageUsed}` — null on error (UI path) |
| `requireWithinLimit`   | `(orgId, limitKey, entitlements?) → void`                     | **Fail-closed**: throws on ANY error including count failures                    |

**Snapshot resolution pattern:** Methods accept optional `entitlements` parameter:

- `undefined` = "no snapshot provided → load from DB"
- `null` = "snapshot explicitly absent → treat as missing (do NOT auto-load)"

**Derived count strategy:** Uses `supabase.from(table).select("id", { count: "exact", head: true })` with explicit WHERE filters. Supports operators: `eq`, `neq`, `is`.

**Metered usage strategy:** Range query `[periodStart, nextPeriodStart)` with `order+limit(2)` (resilient to duplicate rows). Warns on duplicates.

### `entitlements` Guard Facade

**File:** `src/server/guards/entitlements-guards.ts`

- `"use server"` directive
- Thin wrapper around `EntitlementsService`
- Auto-extracts org context (callers don't pass orgId)
- Uses React `cache()` for request-scoped `getOrgContext()`
- Loads context from `loadAppContextServer()` (V1 loader)
- Trust boundary: verifies `entitlements.organization_id === activeOrgId` before using snapshot

**Exported methods:**

| Method                                          | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| `requireOrgContext()`                           | Returns `{userId, orgId, branchId, entitlements}` |
| `requireModuleAccess(moduleSlug)`               | Auto-context, throws on denial                    |
| `requireFeatureAccess(featureKey)`              | Auto-context, throws on denial                    |
| `requireWithinLimit(limitKey)`                  | Auto-context, fail-closed                         |
| `checkLimit(limitKey)`                          | Auto-context, returns null on error               |
| `requireModuleOrRedirect(moduleSlug, opts?)`    | Redirects to `/upgrade` on MODULE_ACCESS_DENIED   |
| `requireWithinLimitOrRedirect(limitKey, opts?)` | Redirects to `/upgrade` on LIMIT_EXCEEDED         |

**Error mapping:** `mapEntitlementError(error)` converts `EntitlementError` to `{code, message, context}` for UI responses.

### `loadAppContextServer()` (V1 Context Loader)

**File:** `src/lib/api/load-app-context-server.ts`

- `"use server"` directive, React `cache()` wrapped
- **DOES load entitlements** from `organization_entitlements` table (step 8)
- Returns `AppContext` with `entitlements` field
- Used by: entitlements guards, V1 sidebar (`AppSidebar.tsx`), legacy dashboard

### `loadAppContextV2()` (V2 Context Loader)

**File:** `src/server/loaders/v2/load-app-context.v2.ts`

- React `cache()` wrapped
- **DOES NOT load entitlements** — `AppContextV2` type has no subscription/entitlements field
- Returns `AppContextV2` with: `activeOrgId`, `activeBranchId`, `activeOrg`, `activeBranch`, `availableBranches`, `userModules`

### `SubscriptionService` (Legacy Client-Side)

**File:** `src/lib/services/subscription-service.ts`

- **Client-side** (`createClient()` from `@/utils/supabase/client`)
- In-memory cache with TTL (5 min default)
- Reads from `organization_subscriptions` + `subscription_plans` (join query)
- Methods: `getActiveSubscription()`, `hasModuleAccess()`, `hasContextAccess()`, `hasFeature()`, `checkUsageLimit()`, `incrementUsage()`
- Exported as singleton: `subscriptionService`
- **Used by:** `src/modules/index.ts` → `getAllModules()` for module access checking
- **Note:** This is an older service being superseded by `EntitlementsService` for server-side use

## 6.2 Writers

### `EntitlementsAdminService`

**File:** `src/server/services/entitlements-admin.service.ts`

- Calls dev RPCs via `supabase.rpc()`
- Pre-checks: `assertDevModeEnabled()` (reads `app_config`), `assertOrgOwner()` (calls `is_org_owner` RPC)

**Methods:**

| Method                                               | RPC Called                |
| ---------------------------------------------------- | ------------------------- |
| `switchPlan(supabase, orgId, planName)`              | `dev_set_org_plan`        |
| `addModuleAddon(supabase, orgId, moduleSlug)`        | `dev_add_module_addon`    |
| `removeModuleAddon(supabase, orgId, moduleSlug)`     | `dev_remove_module_addon` |
| `setLimitOverride(supabase, orgId, limitKey, value)` | `dev_set_limit_override`  |
| `resetToFree(supabase, orgId)`                       | `dev_reset_org_to_free`   |

### Recompute Triggers (Automatic Writers)

Any INSERT/UPDATE/DELETE on:

- `organization_subscriptions`
- `organization_module_addons`
- `organization_limit_overrides`

...triggers `trigger_recompute_entitlements()` → `recompute_organization_entitlements(org_id)` → UPSERT into `organization_entitlements`.

## 6.3 Client-Side Readers

### `useEntitlements()` Hook

**File:** `src/hooks/use-entitlements.ts`

- `"use client"` directive
- Reads from `useAppStore((state) => state.entitlements)` (Zustand V1 store)
- **UI/UX only** — not a security boundary

**Methods:** `hasModule()`, `lacksModule()`, `hasAnyModule()`, `hasAllModules()`, `hasFeature()`, `getLimit()`, `isUnlimited()`, `getPlanName()`, `getEntitlements()`

### Hydration Path (V1)

```
Server: loadAppContextServer() → loads organization_entitlements row
  ↓
Client: useAppStore.getState().hydrateFromServer(context) → sets entitlements in Zustand
  ↓
Hooks: useEntitlements() → reads from Zustand store
```

### Hydration Path (V2)

```
Server: loadDashboardContextV2() → loadAppContextV2() (NO entitlements loaded)
  ↓
Client: useAppStoreV2.getState().hydrateFromServer(context.app) → NO entitlements field
  ↓
Result: V2 stores do NOT have entitlements. useEntitlements() uses V1 store.
```

**IMPORTANT:** `useEntitlements()` imports from V1 `useAppStore`, not V2. If a page uses the V2 layout exclusively, the entitlements hook will NOT have data unless the V1 loader also runs.

---

# 7. DATA CONTRACT (TypeScript Types & Field Meanings)

## 7.0 Primary Type: `OrganizationEntitlements`

**File:** `src/lib/types/entitlements.ts`

This is the **exact TypeScript shape** used throughout the application:

```typescript
export interface OrganizationEntitlements {
  organization_id: string;
  plan_id: string | null;
  plan_name: string;
  enabled_modules: string[]; // Module slugs allowed by plan + addons
  enabled_contexts: string[]; // Context slugs (warehouse, ecommerce, b2b, pos) - plan only
  features: Record<string, boolean | number | string>; // Feature flags - plan only
  limits: Record<string, number>; // Limit keys with values (-1 = unlimited, plan + overrides)
  updated_at: string;
}
```

**Field Meanings:**

| Field              | Type                                          | Source               | Meaning                                                                                                                      |
| ------------------ | --------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `organization_id`  | `string`                                      | Row key              | UUID of the organization                                                                                                     |
| `plan_id`          | `string \| null`                              | Subscription         | UUID of active plan (null if no subscription)                                                                                |
| `plan_name`        | `string`                                      | Subscription         | Plan name (free/professional/enterprise)                                                                                     |
| `enabled_modules`  | `string[]`                                    | **Plan + Addons**    | Module slugs available (union of plan.enabled_modules + active addon.module_slug)                                            |
| `enabled_contexts` | `string[]`                                    | **Plan only**        | Context slugs for domain switching (warehouse, ecommerce, b2b, pos)                                                          |
| `features`         | `Record<string, boolean \| number \| string>` | **Plan only**        | Feature flags (currently `{}` empty)                                                                                         |
| `limits`           | `Record<string, number>`                      | **Plan + Overrides** | Flat namespaced keys (e.g., `"warehouse.max_products": 100`). Plan base + overrides applied. **-1 = unlimited, 0 = not set** |
| `updated_at`       | `string`                                      | Auto                 | ISO timestamp of last recompilation                                                                                          |

**IMPORTANT:**

- `enabled_modules` is the **ONLY field that merges addons** — all other fields come from the plan only
- `limits` applies **override values** on top of plan base (per-org customization)
- All compilation happens **at write-time** via triggers — this snapshot is pre-computed facts

## 7.1 Limit Keys (`LIMIT_KEYS` from `src/lib/types/entitlements.ts`)

```typescript
export const LIMIT_KEYS = {
  WAREHOUSE_MAX_PRODUCTS: "warehouse.max_products",
  WAREHOUSE_MAX_LOCATIONS: "warehouse.max_locations",
  WAREHOUSE_MAX_BRANCHES: "warehouse.max_branches",
  ORGANIZATION_MAX_USERS: "organization.max_users",
  ANALYTICS_MONTHLY_EXPORTS: "analytics.monthly_exports",
} as const;
```

## 7.2 Limit Strategies (`LIMIT_STRATEGIES` from `src/lib/types/entitlements.ts`)

| Limit Key                   | Strategy  | Table                  | WHERE Filters                                                           |
| --------------------------- | --------- | ---------------------- | ----------------------------------------------------------------------- |
| `warehouse.max_products`    | `derived` | `products`             | `organization_id = $orgId AND deleted_at IS NULL`                       |
| `warehouse.max_locations`   | `derived` | `locations`            | `organization_id = $orgId AND deleted_at IS NULL`                       |
| `warehouse.max_branches`    | `derived` | `branches`             | `organization_id = $orgId AND deleted_at IS NULL`                       |
| `organization.max_users`    | `derived` | `organization_members` | `organization_id = $orgId AND status = 'active' AND deleted_at IS NULL` |
| `analytics.monthly_exports` | `metered` | `subscription_usage`   | Period range query `[start, nextStart)`                                 |

**Derived** = count rows in a table (always current, no drift, requires partial index).
**Metered** = counter in `subscription_usage` (resets per billing period).

## 7.3 Subscription Plans (Live from Database)

### Free Plan

```json
{
  "name": "free",
  "display_name": { "en": "Free Plan", "pl": "Plan Darmowy" },
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "contacts",
    "documentation"
  ],
  "enabled_contexts": ["warehouse"],
  "features": {},
  "limits": {
    "warehouse.max_products": 100,
    "warehouse.max_locations": 5,
    "warehouse.max_branches": 1,
    "organization.max_users": 3
  }
}
```

### Professional Plan

```json
{
  "name": "professional",
  "display_name": { "en": "Professional Plan", "pl": "Plan Profesjonalny" },
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "analytics",
    "development"
  ],
  "enabled_contexts": ["warehouse", "ecommerce"],
  "features": {},
  "limits": {
    "warehouse.max_products": 10000,
    "warehouse.max_locations": 100,
    "warehouse.max_branches": 1,
    "organization.max_users": 50
  }
}
```

### Enterprise Plan

```json
{
  "name": "enterprise",
  "display_name": { "en": "Enterprise Plan", "pl": "Plan Enterprise" },
  "enabled_modules": [
    "home",
    "warehouse",
    "teams",
    "organization-management",
    "support",
    "user-account",
    "analytics",
    "development"
  ],
  "enabled_contexts": ["warehouse", "ecommerce", "b2b", "pos"],
  "features": {},
  "limits": {
    "warehouse.max_products": -1,
    "warehouse.max_locations": -1,
    "warehouse.max_branches": 1,
    "organization.max_users": -1
  }
}
```

**Note:** `analytics.monthly_exports` is added to professional (100) and enterprise (-1) plan limits in migration 5 but not yet visible in the live DB limits (may have been added after the initial seed or the conditional UPDATE didn't match).

## 7.4 Module Slugs (from plans)

All unique module slugs across all plans:

- `home`, `warehouse`, `teams`, `organization-management`, `support`, `user-account` — all plans
- `contacts`, `documentation` — free only
- `analytics`, `development` — professional + enterprise

## 7.5 Context Slugs (from plans)

- `warehouse` — all plans
- `ecommerce` — professional + enterprise
- `b2b`, `pos` — enterprise only

## 7.6 Feature Flags

Currently `{}` (empty) for all plans. No features are defined in the live database. The `hasFeature()` checks use strict `=== true` comparison for boolean values.

## 7.7 Error Codes (`EntitlementErrorCode`)

```typescript
type EntitlementErrorCode =
  | "MODULE_ACCESS_DENIED"
  | "FEATURE_UNAVAILABLE"
  | "LIMIT_EXCEEDED"
  | "LIMIT_CHECK_FAILED" // Count query failed - fail-closed
  | "NO_ACTIVE_SUBSCRIPTION"
  | "ENTITLEMENTS_MISSING";
```

---

# 8. LIVE ENTITLEMENTS SNAPSHOT (Example)

From `organization_entitlements` table (real row):

```json
{
  "organization_id": "4aab690b-45c9-4150-96c2-cabe6a6d8633",
  "plan_name": "professional",
  "enabled_modules": [
    "support",
    "warehouse",
    "user-account",
    "development",
    "analytics",
    "organization-management",
    "home",
    "teams"
  ],
  "enabled_contexts": ["warehouse", "ecommerce"],
  "features": {},
  "limits": {
    "organization.max_users": 50,
    "warehouse.max_branches": 1,
    "warehouse.max_products": 10000,
    "warehouse.max_locations": -1
  },
  "updated_at": "2026-02-12T23:00:00.569111+00:00"
}
```

**Note:** `warehouse.max_locations` is `-1` (unlimited) in this org's snapshot, while the professional plan default is `100`. This indicates a limit override is active for this organization.

---

# 9. PARTIAL INDEXES FOR LIMIT ENFORCEMENT

Created in migration 6 (`20260211100500_limit_indexes.sql`):

| Index Name                      | Table                  | Filter                                           | Supports Limit            |
| ------------------------------- | ---------------------- | ------------------------------------------------ | ------------------------- |
| `idx_products_org_not_deleted`  | `products`             | `WHERE deleted_at IS NULL`                       | `warehouse.max_products`  |
| `idx_locations_org_not_deleted` | `locations`            | `WHERE deleted_at IS NULL`                       | `warehouse.max_locations` |
| `idx_branches_org_not_deleted`  | `branches`             | `WHERE deleted_at IS NULL`                       | `warehouse.max_branches`  |
| `idx_org_members_org_active`    | `organization_members` | `WHERE status = 'active' AND deleted_at IS NULL` | `organization.max_users`  |

These indexes support the `select("id", { count: "exact", head: true })` pattern used by `EntitlementsService.getDerivedCount()`.

---

# 10. DATA FLOW DIAGRAM

```
                    ┌─────────────────────────────────────────┐
                    │            WRITE-TIME COMPILATION        │
                    │                                         │
  subscription_plans ──┐                                      │
                       │                                      │
  organization_        │   trigger_recompute_entitlements()   │
  subscriptions ───────┼──────────────────────────────────────┤
                       │              │                       │
  organization_        │              ▼                       │
  module_addons ───────┤   recompute_organization_            │
                       │   entitlements(org_id)               │
  organization_        │              │                       │
  limit_overrides ─────┘              │                       │
                                      ▼                       │
                              organization_entitlements        │
                              (COMPILED SNAPSHOT)              │
                    └─────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │            READ-TIME (SSR)               │
                    │                                         │
                    │  loadAppContextServer() ──► reads       │
                    │  organization_entitlements (1 row)       │
                    │         │                               │
                    │         ▼                               │
                    │  AppContext.entitlements ──► hydrated    │
                    │  into useAppStore (Zustand)             │
                    │         │                               │
                    │         ▼                               │
                    │  useEntitlements() hook (UI checks)     │
                    │  EntitlementsService (server checks)    │
                    │  entitlements guards (auto-context)     │
                    └─────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │         LIMIT ENFORCEMENT               │
                    │                                         │
                    │  requireWithinLimit(limitKey)            │
                    │         │                               │
                    │         ├── getEffectiveLimit()          │
                    │         │   (from compiled snapshot)     │
                    │         │                               │
                    │         ├── getCurrentUsage()            │
                    │         │   ├── derived: COUNT rows      │
                    │         │   └── metered: subscription_   │
                    │         │              usage counter     │
                    │         │                               │
                    │         └── current >= limit? → THROW    │
                    │              (fail-closed on errors)     │
                    └─────────────────────────────────────────┘
```

---

# 11. NOTES & RISKS

## Known Issues

1. **V2 loader does not load entitlements.** `loadAppContextV2()` has no entitlements field. The `useEntitlements()` hook reads from V1 `useAppStore`. If a page only uses the V2 layout/providers, entitlements data will be absent on the client. The entitlements guards (`src/server/guards/entitlements-guards.ts`) use the V1 loader (`loadAppContextServer()`), so server-side enforcement still works.

2. **`analytics.monthly_exports` limit not in live DB plans.** Migration 5 adds it to professional (100) and enterprise (-1), but the conditional UPDATE may not have matched on already-namespaced plans. Current live plans show only 4 limit keys. This limit exists in the TypeScript `LIMIT_KEYS` constant and the SQL allowlist but may not be in the compiled snapshots.

3. **`warehouse.max_branches` is 1 for ALL plans** (including enterprise). This appears intentional but worth noting — enterprise doesn't get multi-branch by default.

4. **`features` is empty `{}` for all plans.** The feature system is fully wired (types, service methods, client hook) but no features are currently defined. `hasFeature()` will always return `false`.

5. **`enabled_contexts` not consumed by sidebar.** Contexts exist in plans and compiled snapshots but are not used by the sidebar resolver or module registry. They appear to be for future use (ecommerce, b2b, pos context switching).

6. **Dev mode is currently enabled in production database.** `app_config.dev_mode_enabled = true`. This means dev RPCs are callable. The migration seeds it as `false` — someone manually enabled it.

7. **`SubscriptionService` (legacy) coexists with `EntitlementsService`.** Both exist and serve different contexts:
   - `SubscriptionService`: client-side, used by `src/modules/index.ts` for module access in sidebar
   - `EntitlementsService`: server-side, used by guards and server actions
   - They read from different tables (`organization_subscriptions` + `subscription_plans` vs `organization_entitlements`)
   - Results should be equivalent but there's a risk of divergence

8. **Advisory lock strategy:** `recompute_organization_entitlements` uses `pg_advisory_xact_lock(hashtext(org_id::text))`. Hash collisions are theoretically possible (different org IDs hashing to same int4) but probability is negligible for reasonable org counts.

## Security Considerations

### Trust Boundaries: What is Authoritative

**Server-Side (Authoritative — Security Enforcement):**

- `organization_entitlements` table (compiled snapshot) — **single source of truth**
- `EntitlementsService` server-side methods — **authoritative checks**
- `entitlements` guards (auto-context) — **authoritative enforcement**
- RLS policies on all tables — **authoritative access control**
- Server actions with `requireModuleAccess()` / `requireWithinLimit()` — **authoritative gates**

**Client-Side (UI/UX Only — NOT Security Enforcement):**

- `useEntitlements()` hook — **UI feedback only** (hide/show UI elements)
- `useAppStore().entitlements` — **UI state only**
- Sidebar module visibility — **UI convenience only** (NOT an enforcement boundary)
- Client-side `SubscriptionService` — **UI checks only**

**CRITICAL SECURITY POLICY:**

- **Sidebar visibility MUST NOT be used as an enforcement boundary**
- A module being hidden in the sidebar does NOT prevent direct URL access
- **ALL enforcement happens server-side** via:
  1. RLS policies (table-level access control)
  2. Server action guards (`requireModuleAccess`, `requireWithinLimit`)
  3. Page-level guards in server components/layouts
- Client-side checks are **convenience + UX only** — users can bypass by editing localStorage/cookies
- **Never trust client-side entitlements state** for authorization decisions

### Org Context Resolution (Before Entitlement Checks)

**Path:** Request → `loadAppContextServer()` → resolves `activeOrgId` + `activeBranchId` → loads `organization_entitlements` row

**Resolution priority:**

1. `user_preferences.organization_id` (validated against `organizations` table)
2. Oldest org where user is a member (via `user_role_assignments`)
3. Oldest org created by user (via `organizations.created_by`)

**Trust model:**

- Org context is resolved server-side via React `cache()` (request-scoped, deduplicated)
- `entitlements` guards verify `entitlements.organization_id === activeOrgId` before using snapshot
- If mismatch: treats as missing entitlements (fail-closed)

### Additional Security Hardening

- All SECURITY DEFINER functions use `SET search_path TO ''` (hardened against search_path attacks)
- All table references in functions are fully qualified (`public.*`)
- Dev RPCs are REVOKED from `PUBLIC` and `anon`; only `authenticated` and `service_role` can execute
- Double gate: `assert_dev_mode_enabled()` + `is_org_owner()` — both must pass
- FORCE RLS on all tables — even table owner is subject to policies
- Entitlements writes go through SECURITY DEFINER functions (bypass RLS as intended) or service_role

---

# 12. FILES REFERENCED

## Migration Files

1. `supabase/migrations/20260211100000_entitlements_baseline.sql`
2. `supabase/migrations/20260211100100_enable_subscription_rls.sql`
3. `supabase/migrations/20260211100200_addons_and_overrides.sql`
4. `supabase/migrations/20260211100300_compiled_entitlements.sql`
5. `supabase/migrations/20260211100400_backfill_free_subscriptions.sql`
6. `supabase/migrations/20260211100500_limit_indexes.sql`
7. `supabase/migrations/20260211100600_dev_mode_gate_and_dev_rpcs.sql`
8. `supabase/migrations/20260212100000_validate_dev_rpcs.sql`

## TypeScript Source Files

9. `src/lib/types/entitlements.ts` — Types, LIMIT_KEYS, LIMIT_STRATEGIES
10. `src/server/services/entitlements-service.ts` — Primary server-side service
11. `src/server/services/entitlements-admin.service.ts` — Admin RPC wrapper
12. `src/server/guards/entitlements-guards.ts` — Auto-context guards + error mapping
13. `src/lib/api/load-app-context-server.ts` — V1 context loader (loads entitlements)
14. `src/server/loaders/v2/load-app-context.v2.ts` — V2 context loader (no entitlements)
15. `src/lib/services/subscription-service.ts` — Legacy client-side service
16. `src/hooks/use-entitlements.ts` — Client-side hook (reads V1 store)
17. `src/lib/stores/app-store.ts` — V1 Zustand store (has entitlements field)
18. `src/lib/stores/v2/app-store.ts` — V2 Zustand store (no entitlements field)

## Database Queries Executed

- `pg_policies` — All 14 RLS policies across 7 tables
- `pg_trigger` — All 8 triggers on entitlements tables
- `pg_proc` — All 11 function signatures and security attributes
- `subscription_plans` — All 3 active plans with full data
- `organization_entitlements` — Live snapshot example
- `app_config` — Current dev_mode_enabled value

---

# 13. VERIFICATION

To verify this extraction:

1. Run `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY sort_order;` via Supabase MCP
2. Run `SELECT * FROM organization_entitlements LIMIT 5;` via Supabase MCP
3. Run `SELECT dev_mode_enabled FROM app_config WHERE id = 1;` via Supabase MCP
4. Read each file listed in section 12 to confirm contents match
5. Compare `LIMIT_KEYS` in TypeScript against SQL allowlist in `dev_set_limit_override`
6. Verify compiled snapshot limits match plan limits + any overrides
