# SUBSCRIPTIONS / PLANS / MODULE ACCESS — CURRENT STATE AUDIT

## 0) Executive summary

- **Subscription system infrastructure EXISTS** but is **NOT fully enabled**. Tables exist, migration is disabled (.sql.disabled), RLS is OFF for all subscription tables.
- **Module access control is SPLIT** between two systems: (1) subscription-based filtering via `getAllModules()` and (2) legacy role/permission-based filtering via `requiredPermissions` on menu items.
- **Current state is functional but incomplete**: sidebar filters modules by subscription, but no server-side/database-side enforcement. Limits tracking exists but not enforced.
- **Biggest risks**: (1) No RLS on subscription tables (anyone can read/write), (2) Subscription data loaded client-side only (bypassable), (3) Module filtering happens only at UI layer, (4) Migration is disabled but tables exist (schema drift risk).

---

## 1) Data model inventory (DB / Supabase)

### **subscription_plans**

- **Purpose**: Catalog of available subscription tiers (free, professional, enterprise)
- **Key columns**:
  - `id` (uuid, PK), `name` (text, unique - "free", "professional", "enterprise")
  - `enabled_modules` (text[] - module slugs like "home", "warehouse", "analytics")
  - `enabled_contexts` (text[] - context slugs like "warehouse", "ecommerce", "b2b")
  - `features` (jsonb - feature flags), `limits` (jsonb - usage limits like max_products, max_users)
  - `price_monthly`, `price_yearly` (integer, cents), `is_active`, `sort_order`
- **RLS status**: ❌ **RLS DISABLED** (`rowsecurity: false`) — NO policies active
- **Current data**: 3 plans exist (free, professional, enterprise) with defined module lists and limits
- **Where referenced**:
  - `src/lib/services/subscription-service.ts` (SubscriptionService class)
  - `src/hooks/use-subscription.ts` (client-side SWR hooks)
  - `src/modules/index.ts` (getAllModules checks enabled_modules)

### **organization_subscriptions**

- **Purpose**: Active subscription assignment per organization
- **Key columns**:
  - `id` (uuid, PK), `organization_id` (uuid, FK → organizations, UNIQUE)
  - `plan_id` (uuid, FK → subscription_plans)
  - `status` (text - "active", "trialing", "canceled", etc.)
  - `current_period_start`, `current_period_end` (timestamptz)
  - `is_development` (boolean - dev subscriptions flag), `dev_expires_at` (timestamptz)
  - `stripe_subscription_id`, `stripe_customer_id` (text, nullable)
- **RLS status**: ❌ **RLS DISABLED** (`rowsecurity: false`) — NO policies active (migration defines policies but not applied)
- **Current data**: 1 active development subscription (org → professional plan)
- **Where referenced**:
  - `src/lib/services/subscription-service.ts` (getActiveSubscription)
  - `src/lib/stores/app-store.ts` (subscription field in AppContext)
  - `src/lib/api/load-app-context-server.ts` (set to null, not loaded in SSR)

### **subscription_usage**

- **Purpose**: Monthly usage tracking for limits (products created, users added, etc.)
- **Key columns**:
  - `id` (uuid, PK), `organization_id` (uuid, FK)
  - `feature_key` (text - e.g., "max_products"), `current_value` (integer)
  - `period_start`, `period_end` (timestamptz - monthly periods)
  - UNIQUE constraint: `(organization_id, feature_key, period_start)`
- **RLS status**: ❌ **RLS DISABLED** (`rowsecurity: false`)
- **Where referenced**:
  - `src/lib/services/subscription-service.ts` (checkUsageLimit, incrementUsage)
  - `src/hooks/use-subscription.ts` (useUsageLimit hook)

### **modules** (legacy system)

- **Purpose**: Global module registry (predates subscription system)
- **Key columns**: `id` (uuid, PK), `slug` (text, unique), `label`, `description`, `settings` (jsonb)
- **RLS status**: Unknown (not queried)
- **Current data**: 5 modules (home, warehouse, teams, organization-management, analytics)
- **Where referenced**:
  - `src/lib/api/load-app-context-server.ts` (loads user_modules with merged settings)
  - Does NOT relate to subscription gating (parallel system)

### **user_modules** (legacy system)

- **Purpose**: User-specific module settings/overrides (NOT access control)
- **Key columns**: `user_id`, `module_id` (FK → modules), `setting_overrides` (jsonb)
- **RLS status**: Unknown
- **Where referenced**: `src/lib/api/load-app-context-server.ts` (loads for feature gating)

### **user_preferences**

- **Purpose**: User preferences including default org/branch
- **Key columns**: 19 columns including `organization_id`, `default_branch_id`
- **RLS status**: Unknown
- **Where referenced**: `src/lib/api/load-app-context-server.ts` (determines activeOrgId)

### **SQL Functions (from disabled migration)**

Migration defines but are **NOT deployed**:

- `get_organization_subscription(org_id)` — Returns plan details with enabled modules/contexts/limits
- `has_module_access(org_id, module_name)` — Boolean check if org can access module (hardcodes default modules)
- `has_context_access(org_id, context_name)` — Boolean check for contexts (always true for "warehouse")
- `has_feature_access(org_id, feature_name)` — Boolean check for feature flags

**Note**: These functions are defined in migration file but **NOT actually deployed** to database.

---

## 2) Current "module registry" and config system (code)

### **Module definition locations**

- **Configs**: `src/modules/[module]/config.ts` for each module
  - Examples: `src/modules/warehouse/config.ts`, `src/modules/analytics/config.ts`
  - Async functions: `getWarehouseModule()`, `getAnalyticsModule()` return `ModuleConfig`
- **Module aggregation**: `src/modules/index.ts`
  - `getAllModules(activeOrgId?, subscription?)` → `ModuleWithAccess[]`
  - `getAccessibleModules(activeOrgId?, subscription?)` → filters by `hasAccess` flag
  - `getLockedModules(activeOrgId?, subscription?)` → filters by `!hasAccess && isPremium`

### **Key types** (`src/lib/types/module.ts`)

```typescript
interface ModuleConfig {
  id: string; // e.g., "warehouse"
  slug: string; // e.g., "warehouse"
  title: string; // i18n key: "modules.warehouse.title"
  icon?: string; // Lucide icon name
  color?: string; // HEX color
  items: MenuItem[]; // Sidebar menu items
  widgets?: Widget[]; // Dashboard widgets
}

interface MenuItem {
  id: string;
  label: string; // i18n key
  path?: string; // Route path
  icon: string;
  allowedUsers?: AllowedUser[]; // Legacy role-based filter
  requiredPermissions?: string[]; // Permission-based filter (e.g., "warehouse.products.read")
  submenu?: MenuItem[];
}
```

### **Extended interface for access control** (`src/modules/index.ts`)

```typescript
interface ModuleWithAccess extends ModuleConfig {
  hasAccess: boolean; // Whether user's org can access this module
  isPremium: boolean; // If module requires paid plan
  requiredPlan?: string; // Plan name ("free", "professional", etc.)
  isAlwaysAvailable?: boolean; // Hardcoded free modules
}
```

### **Module access logic** (`src/modules/index.ts:30-81`)

```typescript
const allModulesConfig = [
  // Free tier modules (alwaysAvailable: true)
  { module: homeModule, alwaysAvailable: true, requiredPlan: "free" },
  { module: warehouseModule, alwaysAvailable: true, requiredPlan: "free" },
  // ... 6 more free modules

  // Professional tier modules (alwaysAvailable: false)
  { module: analyticsModule, alwaysAvailable: false, requiredPlan: "professional" },
];

for (const config of allModulesConfig) {
  let hasAccess = true;

  if (!config.alwaysAvailable && activeOrgId) {
    if (subscription) {
      // Use subscription from context (SSR path)
      hasAccess = subscription.plan.enabled_modules.includes(config.module.id);
    } else {
      // Fetch from service (client path)
      hasAccess = await subscriptionService.hasModuleAccess(activeOrgId, config.module.id);
    }
  }

  modulesWithAccess.push({
    ...config.module,
    hasAccess,
    isPremium: !config.alwaysAvailable,
    requiredPlan: config.requiredPlan,
  });
}
```

**Critical observations**:

- **Hardcoded module list**: "Always available" modules defined in code, not database
- **Dual-path access check**: (1) From `subscription` param (SSR), (2) From `subscriptionService` (client-side)
- **Default modules**: home, warehouse, contacts, teams, org-management, support, user-account, documentation (all "free")
- **Premium modules**: analytics (requires "professional")

### **Sidebar assembly** (`src/components/Dashboard/sidebar/AppSidebar.tsx:38`)

```typescript
const modules = await getAccessibleModules(activeOrgId, appContext?.subscription);
```

- Calls `getAccessibleModules()` which filters `getAllModules()` by `hasAccess: true`
- **Problem**: `appContext.subscription` is **NULL** (see loadAppContextServer line 179)
- So sidebar falls back to `subscriptionService.hasModuleAccess()` which is **client-side only**

### **Menu item filtering** (`src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx:54-80`)

After modules are filtered by subscription, menu items are filtered by:

1. **requiredPermissions**: User must have ALL permissions (AND logic)
2. **allowedUsers**: User must match role + scope (OR logic with legacy system)

**Two-layer filtering**:

- **Layer 1**: Module-level (subscription-based)
- **Layer 2**: Menu item-level (permission/role-based)

### **Localization keys**

All module/menu labels use i18n keys:

- `modules.warehouse.title` → "Magazyn" (pl) / "Warehouse" (en)
- Loaded via `getTranslations("modules")` (next-intl)

---

## 3) Current subscription/plan logic (code)

### **Subscription loading** (`src/lib/api/load-app-context-server.ts:179`)

```typescript
return {
  // ... other context fields
  subscription: null, // ❌ ALWAYS NULL in SSR
};
```

**Critical issue**: Subscription is explicitly set to `null` in server-side context loader.

**Comment in file (line 30)**:

```typescript
// - subscription set to null
```

**Why this matters**:

- SSR-rendered pages get `subscription: null` → fallback to client-side fetch
- No subscription data available during initial page render
- Sidebar module filtering happens after hydration (flicker risk)

### **Client-side subscription service** (`src/lib/services/subscription-service.ts`)

**SubscriptionService class**:

- **getSubscriptionPlans()**: Fetches all active plans from `subscription_plans` (cached 5min)
- **getActiveSubscription(orgId)**: Fetches org's subscription + plan details (cached 5min)
- **hasModuleAccess(orgId, moduleName)**:
  - Hardcoded defaults: `["home", "warehouse"]` always true
  - Otherwise checks `subscription.plan.enabled_modules.includes(moduleName)`
- **hasContextAccess(orgId, contextName)**:
  - Hardcoded default: `"warehouse"` always true
  - Otherwise checks `subscription.plan.enabled_contexts.includes(contextName)`
- **checkUsageLimit(orgId, limitKey)**:
  - Fetches current period usage from `subscription_usage`
  - Returns `{ current, limit, isAtLimit, canProceed }`
  - Limit `-1` means unlimited
- **incrementUsage(orgId, featureKey, increment)**:
  - Checks limit first (via `checkUsageLimit`)
  - Upserts to `subscription_usage` (monthly period)
  - **Problem**: Uses `CONFLICT` resolution without service_role bypass

**Cache behavior**:

- In-memory Map cache with 5min TTL
- Cache key: `subscription:${orgId}`
- No cross-request persistence (resets on server restart)

### **Hooks** (`src/hooks/use-subscription.ts`)

Client-side SWR hooks for fetching subscription data:

- `useSubscription(orgId)` — Fetches active subscription (1min dedup)
- `useModuleAccess(moduleName, orgId)` — Boolean check (5min dedup)
- `useFeatureAccess(featureName, orgId)` — Boolean check (5min dedup)
- `useUsageLimit(limitKey, orgId)` — Limit check with auto-refresh (30s dedup, 60s refresh)
- `useDevelopmentSubscription(orgId)` — Dev-only plan switcher

**Fallback behavior** (e.g., `useModuleAccess`):

```typescript
hasModuleAccess: (moduleName: string) => {
  if (!subscription) return ["home", "warehouse"].includes(moduleName);
  return subscription.plan.enabled_modules.includes(moduleName);
};
```

### **Dev-only subscription switcher** (`src/lib/services/subscription-service.ts:274-314`)

```typescript
async setDevelopmentSubscription(orgId: string, planName: string) {
  // Upserts organization_subscriptions with is_development: true
  // Sets 30-day expiration
}
```

Used by development module to test different plans.

### **Hardcoded assumptions**:

1. **Default modules**: "home", "warehouse" — always accessible (ignores subscription)
2. **Default context**: "warehouse" — always accessible
3. **Free plan fallback**: If no subscription found, assume free plan (no modules)
4. **Development flag**: `is_development: true` allows temporary plan assignments

---

## 4) Current enforcement points (security + limits)

### **A) UI enforcement (sidebar/components)**

**Location**: `src/components/Dashboard/sidebar/AppSidebar.tsx:38`

```typescript
const modules = await getAccessibleModules(activeOrgId, appContext?.subscription);
```

- **What's enforced**: Module visibility in sidebar
- **How**: Filters modules where `hasAccess: true`
- **Bypassable**: ✅ Yes — direct URL navigation bypasses sidebar
- **Failure mode**: Module not shown in sidebar (silent)

**Location**: `src/components/Dashboard/sidebar/ModuleSectionWrapper.tsx:76-78`

```typescript
if (item.requiredPermissions) {
  if (!hasRequiredPermissions(userPermissions, item.requiredPermissions)) {
    return null; // Filter out this item
  }
}
```

- **What's enforced**: Menu item visibility (permission-based)
- **How**: Checks user's effective permissions array (from JWT)
- **Bypassable**: ✅ Yes — direct URL navigation bypasses menu
- **Failure mode**: Menu item not shown (silent)

**Location**: `src/components/subscription/subscription-gate.tsx`

```tsx
<SubscriptionGate module="analytics" feature="advanced_reports">
  {/* Protected content */}
</SubscriptionGate>
```

- **What's enforced**: Component-level access gating
- **How**: Client-side hooks check subscription/features
- **Bypassable**: ✅ Yes — client-side only, no server validation
- **Failure mode**: Shows upgrade prompt or fallback UI

### **B) Server action enforcement**

**Location**: Searched in `src/app/actions/**` for `hasModuleAccess|hasFeature|checkUsageLimit`
**Result**: ❌ **NONE FOUND** — No server actions currently enforce subscription checks

**Example action** (`src/app/actions/news-actions.ts:8-25`):

```typescript
export async function getNewsPosts(limit?: number, offset?: number) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthorized");

  const appContext = await loadAppContextServer();
  if (!appContext?.activeOrgId) throw new Error("No active organization");

  // ❌ NO subscription check here
  // ❌ NO module access check
  // ❌ NO usage limit check

  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .eq("organization_id", appContext.activeOrgId);
  // ...
}
```

**Pattern across all actions**:

1. Check session (authentication)
2. Load app context (org/branch)
3. ❌ **Missing**: Check subscription/module access
4. Execute query with RLS enforcement (authorization)

### **C) Service layer enforcement**

**SubscriptionService methods** (`src/lib/services/subscription-service.ts`):

- **checkUsageLimit()**: Returns `{ canProceed: boolean }` but doesn't throw
- **incrementUsage()**: Returns `false` if at limit, but doesn't prevent action
- **hasModuleAccess()**: Returns boolean, but no built-in enforcement

**Pattern**: Service provides **check functions** but doesn't enforce — enforcement is caller's responsibility.

### **D) DB enforcement (RLS, triggers, constraints)**

**RLS status on subscription tables**: ❌ **DISABLED** (see section 1)

**Expected policies (from migration, not deployed)**:

```sql
-- subscription_plans: Public read (is_active = true)
CREATE POLICY "subscription_plans_select_policy" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- organization_subscriptions: Org members read, admins modify
CREATE POLICY "organization_subscriptions_select_policy" ON organization_subscriptions
  FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "organization_subscriptions_modify_policy" ON organization_subscriptions
  FOR ALL USING (public.authorize('manage_subscriptions', organization_id));

-- subscription_usage: Org members read, service_role write
CREATE POLICY "subscription_usage_service_policy" ON subscription_usage
  FOR ALL USING (auth.role() = 'service_role');
```

**Status**: ❌ Policies defined but NOT applied (migration disabled)

**Constraints**:

- `organization_subscriptions.organization_id` — UNIQUE (one subscription per org)
- `subscription_usage.(organization_id, feature_key, period_start)` — UNIQUE (monthly tracking)
- No CHECK constraints on limits enforcement

**Triggers**:

- `update_updated_at_column()` — Updates `updated_at` on row changes (defined but not deployed)

**Current DB enforcement**: ⚠️ **NONE** — All subscription tables have no RLS, anyone with DB access can read/write.

---

## 5) What's already close to "entitlements-first"

### **Existing patterns to reuse**

**1. subscription_plans.enabled_modules** (text[])

- Already structured as array of module slugs
- ✅ Ready for: "Plan includes these modules"
- Gap: No add-on support (can't add single module to plan)

**2. subscription_plans.limits** (jsonb)

- Already structured as `{ "max_products": 100, "max_users": 3 }`
- ✅ Ready for: Per-module limits
- Gap: No org-level overrides (custom limits for enterprise)

**3. subscription_usage** table

- Already tracks `(org_id, feature_key, period, current_value)`
- ✅ Ready for: Usage metering and enforcement
- Gap: No increment triggers (manual incrementUsage calls)

**4. organization_subscriptions** (one per org)

- Already UNIQUE constraint on `organization_id`
- ✅ Ready for: Single source of truth for org's plan
- Gap: No add-ons support (can't have plan + add-on modules)

**5. AppContext.subscription** field

- Already defined in `src/lib/stores/app-store.ts:65`
- Type: `OrganizationSubscriptionWithPlan | null`
- ✅ Ready for: SSR-loaded entitlements
- Gap: Currently set to `null` in `loadAppContextServer()`

**6. ModuleWithAccess.hasAccess** flag

- Already computed in `getAllModules()`
- ✅ Ready for: UI filtering
- Gap: No per-org custom modules (all modules hardcoded)

### **Alignment with entitlements model**

**Minimal changes needed**:

| Current                                               | Target Entitlements-First                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `subscription_plans.enabled_modules` (text[])         | ✅ Keep as-is for plan bundles                                                |
| No add-ons support                                    | ➕ Add `organization_module_addons` table                                     |
| Hardcoded "always available" in code                  | ➕ Add `subscription_plans.always_included_modules` or infer from "free" plan |
| No custom modules                                     | ➕ Add `organization_custom_modules` table                                    |
| `subscription_plans.limits` (jsonb)                   | ✅ Keep as base limits, add org overrides                                     |
| No compiled entitlements view                         | ➕ Add `org_effective_entitlements` table/view                                |
| `loadAppContextServer()` returns `subscription: null` | ✅ Load subscription in SSR (1 query)                                         |
| Client-side `SubscriptionService`                     | ⚠️ Move to server-side service with RLS                                       |
| UI-only filtering                                     | ➕ Add server-side enforcement in actions                                     |
| No RLS on subscription tables                         | ✅ Enable RLS policies from migration                                         |

**Recommended compiled output** (`org_effective_entitlements`):

```sql
CREATE TABLE org_effective_entitlements (
  organization_id UUID PRIMARY KEY,
  enabled_modules TEXT[],      -- Plan modules + add-ons + custom
  enabled_contexts TEXT[],     -- From plan
  features JSONB,              -- From plan
  limits JSONB,                -- Plan limits + org overrides
  updated_at TIMESTAMPTZ,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Recompile trigger**: When org subscription changes, plan changes, or add-ons change.

---

## 6) Gaps + risks (must be concrete)

### **Gaps blocking core features**

**Gap 1: Subscription not loaded in SSR**

- **Blocks**: "Org owner can see plan, enabled modules, limits" page
- **Location**: `src/lib/api/load-app-context-server.ts:179` (hardcoded `null`)
- **Fix**: Add join query to load `organization_subscriptions` + `subscription_plans` in SSR
- **Estimate**: 1 query (~50ms overhead)

**Gap 2: No server-side enforcement in actions**

- **Blocks**: Module/feature access can be bypassed via direct API calls
- **Location**: All files in `src/app/actions/**` lack subscription checks
- **Fix**: Add `enforceModuleAccess(orgId, moduleName)` guard in every protected action
- **Estimate**: ~15-20 actions need updates

**Gap 3: No limit enforcement**

- **Blocks**: "Limits enforced safely server-side + DB-side"
- **Location**: `subscription_usage` table exists but no enforcement triggers
- **Fix**: Add `incrementUsage` calls in create actions + DB CHECK constraints
- **Estimate**: ~5-8 create actions need usage tracking

**Gap 4: RLS disabled on subscription tables**

- **Blocks**: Anyone with DB access can modify subscriptions
- **Location**: `subscription_plans`, `organization_subscriptions`, `subscription_usage` have `rowsecurity: false`
- **Fix**: Enable RLS and apply policies from disabled migration
- **Estimate**: Run 1 migration to enable RLS + 6 policies

**Gap 5: No sidebar filtering with SSR subscription**

- **Blocks**: "Sidebar shows only entitled modules" (with correct SSR data)
- **Location**: `AppSidebar.tsx:38` calls `getAccessibleModules()` with `null` subscription
- **Fix**: Pass `appContext.subscription` (non-null) after Gap 1 is fixed
- **Estimate**: No code change needed after Gap 1

**Gap 6: No add-ons or custom modules**

- **Blocks**: "Org can purchase individual modules" or "Admin can enable custom modules"
- **Location**: No `organization_module_addons` table exists
- **Fix**: Add table + update `getAllModules()` to merge add-ons
- **Estimate**: 1 migration + 20 lines of code

### **Risks**

**Risk 1: Inconsistent naming between plan and module IDs**

- **Evidence**:
  - Plans use `enabled_modules: ["analytics"]` (string slugs)
  - Modules use `id: "analytics"` (string IDs)
  - But also `slug: "analytics"` (duplicate field)
- **Impact**: If ID ≠ slug, access checks fail silently
- **Mitigation**: Standardize on `slug` for matching (already de facto standard)

**Risk 2: Module configs depend on old routes**

- **Evidence**: `warehouse/config.ts` has paths like `/dashboard-old/warehouse/products`
- **Impact**: If routes change, sidebar links break (no enforcement on real routes)
- **Mitigation**: Use route constants or auto-generate from Next.js router

**Risk 3: Duplicate module systems**

- **Evidence**:
  - `modules` table (DB) — 5 rows for home, warehouse, teams, org-management, analytics
  - `src/modules/index.ts` (code) — 10 hardcoded modules in `allModulesConfig`
- **Impact**: Module list split between DB (legacy) and code (current)
- **Mitigation**: Deprecate `modules` table, use code-based configs as source of truth

**Risk 4: Client-side service can't enforce RLS**

- **Evidence**: `SubscriptionService` uses `createClient()` (anon key)
- **Impact**: RLS policies apply to service queries (no service_role bypass)
- **Mitigation**: Move subscription checks to server-side actions with proper auth

**Risk 5: Migration disabled but tables exist**

- **Evidence**:
  - `20250925120000_create_subscription_system.sql.disabled` — NOT applied
  - But `subscription_plans` table EXISTS and has data
- **Impact**: Schema drift (manual changes without migration tracking)
- **Mitigation**: Create migration that matches current schema state (idempotent)

**Risk 6: No fallback plan assignment**

- **Evidence**: Disabled migration includes `INSERT INTO organization_subscriptions ... WHERE sp.name = 'free'` for existing orgs
- **Impact**: Orgs created before subscription system have no subscription row
- **Current state**: Query shows only 1 org has subscription (likely test org)
- **Mitigation**: Run backfill to assign free plan to all orgs without subscription

---

## 7) Recommended target state (high-level only)

### **Tables we should have**

**Core (already exist, need RLS)**:

- ✅ `subscription_plans` — Enable RLS with public read policy
- ✅ `organization_subscriptions` — Enable RLS with org-member policies
- ✅ `subscription_usage` — Enable RLS with org-member read, service write

**Add-ons (NEW)**:

- ➕ `organization_module_addons` — (org_id, module_slug, added_at, expires_at)
- ➕ `organization_custom_modules` — (org_id, module_slug, config_override)

**Overrides (NEW)**:

- ➕ `organization_limit_overrides` — (org_id, limit_key, override_value) for custom limits

**Compiled view (RECOMMENDED)**:

- ➕ `org_effective_entitlements` — Materialized or cached computed entitlements

### **SSR should load entitlements**

**Location**: `src/lib/api/load-app-context-server.ts`

**Add to query**:

```typescript
const { data: subscription } = await supabase
  .from("organization_subscriptions")
  .select(
    `
    *,
    plan:subscription_plans(*)
  `
  )
  .eq("organization_id", activeOrgId)
  .eq("status", "active")
  .single();

return {
  // ... existing fields
  subscription: subscription
    ? {
        ...subscription,
        plan: { ...subscription.plan /* parse jsonb fields */ },
      }
    : null,
};
```

**Result**: `AppContext.subscription` populated on SSR, sidebar uses it immediately.

### **Sidebar filtering should work SSR-first**

**Current flow**:

1. SSR: `loadAppContextServer()` → `subscription: null`
2. SSR: `getAccessibleModules(orgId, null)` → falls back to client fetch
3. Client: `useSubscription(orgId)` → fetches subscription
4. Client: Re-render sidebar with correct modules

**Target flow**:

1. SSR: `loadAppContextServer()` → `subscription: { plan: {...} }`
2. SSR: `getAccessibleModules(orgId, subscription)` → filters by `enabled_modules`
3. SSR: Render sidebar with correct modules (no client fetch needed)
4. Client: Hydrate with same data (no flicker)

### **Limits should be tracked + enforced**

**Server-side** (in create actions):

```typescript
export async function createProduct(data: ProductFormData) {
  const appContext = await loadAppContextServer();

  // Check limit before creation
  const limitCheck = await subscriptionService.checkUsageLimit(
    appContext.activeOrgId,
    "max_products"
  );
  if (!limitCheck.canProceed) {
    throw new Error("Product limit reached. Upgrade plan.");
  }

  // Create product
  const { data: product } = await supabase.from("products").insert(data);

  // Increment usage
  await subscriptionService.incrementUsage(appContext.activeOrgId, "max_products");

  return product;
}
```

**Database-side** (trigger):

```sql
CREATE FUNCTION enforce_product_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM products WHERE organization_id = NEW.organization_id)
     >= (SELECT limits->>'max_products' FROM org_effective_entitlements WHERE organization_id = NEW.organization_id)::int
  THEN
    RAISE EXCEPTION 'Product limit exceeded for organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_limit_check BEFORE INSERT ON products
FOR EACH ROW EXECUTE FUNCTION enforce_product_limit();
```

### **Module configs should reference entitlements**

**Instead of hardcoded**:

```typescript
const allModulesConfig = [
  { module: analyticsModule, alwaysAvailable: false, requiredPlan: "professional" },
];
```

**Use computed access**:

```typescript
const subscription = await getActiveSubscription(orgId);
const enabledModules = new Set([
  ...subscription.plan.enabled_modules,
  ...getOrgAddons(orgId),
  ...getOrgCustomModules(orgId),
]);

const allModules = await getAllModuleConfigs(); // Load all configs
return allModules.map((m) => ({
  ...m,
  hasAccess: enabledModules.has(m.slug),
}));
```

**Benefit**: No hardcoded module lists, supports add-ons and custom modules.

---

**END OF REPORT**
