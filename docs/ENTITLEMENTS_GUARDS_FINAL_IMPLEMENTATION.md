# Entitlements Guards - Final Implementation

## ✅ POINT 1: Guards as Thin Wrapper with App-Specific Behavior

### What Changed

**Before**: Guards duplicated logic by querying `organization_entitlements` directly.

**After**: Guards are thin wrappers that delegate all logic to `EntitlementsService`.

### Implementation Details

#### 1. Single Namespace Export ✅

```typescript
// Export ONE object for consistent imports
export const entitlements = {
  requireOrgContext(),
  requireModuleAccess(moduleSlug),
  requireFeatureAccess(featureKey),
  requireWithinLimit(limitKey),
  checkLimit(limitKey),
  requireModuleOrRedirect(moduleSlug, opts?),
  requireWithinLimitOrRedirect(limitKey, opts?),
};
```

#### 2. Auto-Context Extraction ✅

All methods auto-extract `orgId` internally. Callers **never pass orgId**.

```typescript
// ✅ Correct Usage
await entitlements.requireModuleAccess("warehouse");
await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

// ❌ Old Usage (no longer supported)
await requireModuleAccess(orgId, "warehouse");
await requireWithinLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
```

**How it works**:

- `requireOrgContext()` extracts and caches `{ userId, orgId, branchId, entitlements }`
- Subsequent calls return cached context (no redundant queries)
- All other methods call `requireOrgContext()` internally

#### 3. Redirect on Failure ✅

```typescript
// Redirect with query params
await entitlements.requireModuleOrRedirect("analytics");
// Redirects to: /upgrade?reason=module&module=analytics&plan=free

await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
// Redirects to: /upgrade?reason=limit&key=warehouse.max_locations&current=5&limit=5
```

**Redirect Logic**:

- Only redirects on "upgrade needed" errors: `MODULE_ACCESS_DENIED`, `FEATURE_UNAVAILABLE`, `LIMIT_EXCEEDED`
- System errors (`ENTITLEMENTS_MISSING`, `LIMIT_CHECK_FAILED`) throw (not redirect)
- Query params include context for upgrade page to show details

#### 4. Error Mapping for UI ✅

```typescript
export function mapEntitlementError(error: unknown): { code; message; context } | null;
```

**Messages** (exact as specified):

- `MODULE_ACCESS_DENIED`: "This module is not available on your plan."
- `FEATURE_UNAVAILABLE`: "This feature is not available on your plan."
- `LIMIT_EXCEEDED`: "You've reached your plan limit."
- `LIMIT_CHECK_FAILED`: "Couldn't verify your plan limits. Please try again."
- `ENTITLEMENTS_MISSING`: "Subscription configuration is missing. Contact support."

---

## ✅ POINT 3: Locations Limit is Org-Wide

### Verification

**Strategy Definition** (unchanged, already correct):

```typescript
[LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: {
  type: "derived",
  table: "locations",
  where: [
    { col: "organization_id", op: "eq", value: "$orgId" },  // ✅ Org-wide
    { col: "deleted_at", op: "is", value: null },           // ✅ Excludes soft-deleted
    // ✅ NO branch_id filter
  ],
}
```

**What This Means**:

- Limit counts **all locations** across **all branches** in the organization
- UI loads locations by branch (fine for display)
- Enforcement is org-wide (as required)

**Example**:

- Professional plan: 100 locations limit
- Branch A: 60 locations
- Branch B: 40 locations
- **Total: 100 locations** → At limit (cannot create more in ANY branch)

### Removed Branch-Scoped Logic

1. **Removed `$branchId` from `WhereFilter` type**:

   ```typescript
   // Before: value: string | null | "$orgId" | "$branchId"
   // After:  value: string | null | "$orgId"
   ```

2. **Removed `$branchId` handling from service**:

   ```typescript
   // Removed this code block:
   // else if (value === "$branchId") {
   //   throw new Error("Branch-scoped limits not yet implemented");
   // }
   ```

3. **Updated documentation** to clarify: "All limits are org-wide (no branch-scoped limits)"

---

## Files Changed

### 1. [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts)

- **COMPLETE REWRITE** - now exports single `entitlements` object
- All methods auto-extract `orgId` (no orgId parameter)
- Added redirect wrappers with query params
- Added `mapEntitlementError` helper
- Zero duplication - all logic delegated to service

### 2. [src/server/services/entitlements-service.ts](../src/server/services/entitlements-service.ts)

- Removed `$branchId` handling (lines 312-314)
- Service remains pure (no routing, no redirects)

### 3. [src/lib/types/entitlements.ts](../src/lib/types/entitlements.ts)

- Removed `$branchId` from `WhereFilter` type
- Updated comment to clarify org-wide limits

---

## Call-Site Migration Guide

### Search Terms for Finding Old Usage

```bash
# Find files using old guard imports
grep -r "requireOrgContext\|requireModuleAccess\|requireWithinLimit" src/app/actions --include="*.ts"

# Find files passing orgId to guards
grep -r "requireModuleAccess(orgId" src/app --include="*.ts"
grep -r "requireWithinLimit(orgId" src/app --include="*.ts"

# Find files importing individual guard functions
grep -r "from.*entitlements-guards.*{" src/app --include="*.ts"
```

### Migration Examples

#### Example 1: Server Action with Module + Limit Check

**Before**:

```typescript
import {
  requireOrgContext,
  requireModuleAccess,
  requireWithinLimit,
} from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export async function createLocation(data: LocationData) {
  const { orgId, userId } = await requireOrgContext();
  await requireModuleAccess(orgId, "warehouse");
  await requireWithinLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

  // Create location...
}
```

**After**:

```typescript
import { entitlements } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export async function createLocation(data: LocationData) {
  const ctx = await entitlements.requireOrgContext();
  await entitlements.requireModuleAccess("warehouse");
  await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

  // Create location using ctx.orgId, ctx.userId
}
```

#### Example 2: Server Action with Error Mapping

**Before**:

```typescript
export async function createProduct(data: ProductData) {
  try {
    const { orgId } = await requireOrgContext();
    await requireWithinLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
    // Create product...
    return { success: true, data: product };
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { success: false, error: error.toJSON() };
    }
    throw error;
  }
}
```

**After**:

```typescript
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";

export async function createProduct(data: ProductData) {
  try {
    await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
    // Create product...
    return { success: true, data: product };
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) {
      return { success: false, error: mapped };
    }
    throw error;
  }
}
```

#### Example 3: Server Component (Page) with Redirect

**Before**:

```typescript
import { requireOrgContext, requireModuleAccess } from "@/server/guards/entitlements-guards";

export default async function AnalyticsPage() {
  const { orgId } = await requireOrgContext();

  try {
    await requireModuleAccess(orgId, "analytics");
  } catch (error) {
    redirect("/upgrade");
  }

  // Render page...
}
```

**After**:

```typescript
import { entitlements } from "@/server/guards/entitlements-guards";

export default async function AnalyticsPage() {
  // Auto-redirects to /upgrade if denied
  await entitlements.requireModuleOrRedirect("analytics");

  // Render page...
}
```

#### Example 4: Check Limit for UI Display

**Before**:

```typescript
import { requireOrgContext, checkLimit } from "@/server/guards/entitlements-guards";

export async function getProductsData() {
  const { orgId } = await requireOrgContext();
  const limitStatus = await checkLimit(orgId, LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);

  return { products: await getProducts(), limitStatus };
}
```

**After**:

```typescript
import { entitlements } from "@/server/guards/entitlements-guards";

export async function getProductsData() {
  const limitStatus = await entitlements.checkLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);

  return { products: await getProducts(), limitStatus };
}
```

---

## Updated LIMIT_STRATEGIES Snippet

**No functional changes** - locations strategy was already org-wide:

```typescript
export const LIMIT_STRATEGIES: Record<string, LimitStrategy> = {
  [LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS]: {
    type: "derived",
    table: "products",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS]: {
    type: "derived",
    table: "locations",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" }, // ✅ Org-wide
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  [LIMIT_KEYS.WAREHOUSE_MAX_BRANCHES]: {
    type: "derived",
    table: "branches",
    where: [
      { col: "organization_id", op: "eq", value: "$orgId" },
      { col: "deleted_at", op: "is", value: null },
    ],
  },
  // ... other strategies
};
```

---

## Validation Checklist ✅

- ✅ No `redirect()` import inside `EntitlementsService`
- ✅ `entitlements-guards.ts` calls `EntitlementsService.*` for enforcement
- ✅ Locations limit counting uses org-wide filters only
- ✅ Callers no longer pass `orgId` into entitlement checks
- ✅ All entitlement errors can be mapped via `mapEntitlementError()`
- ✅ No silent "fail-open": enforcement throws on failure
- ✅ Single namespace export: `entitlements` object
- ✅ Redirect wrappers include query params
- ✅ Error messages match specification exactly
- ✅ No `$branchId` placeholder or branch-scoped logic

---

## Summary: POINT 1 + POINT 3 Solved

### POINT 1: Architecture ✅

**Problem**: Guards duplicated logic by querying entitlements directly.

**Solution**:

1. **Thin wrapper**: All guards delegate to `EntitlementsService`
2. **Auto-context**: Methods extract `orgId` internally (no parameter)
3. **App behaviors**: Added redirects, error mapping, query params

**How It Works**:

- Import: `import { entitlements } from "@/server/guards/entitlements-guards"`
- Usage: `await entitlements.requireModuleAccess("warehouse")`
- No `orgId` passed - extracted automatically
- Service stays pure (no routing/redirects)

### POINT 3: Locations Org-Wide ✅

**Problem**: Needed to verify locations limit is org-wide, not branch-scoped.

**Solution**:

1. **Verified strategy is correct**: Filters by `organization_id` only (no `branch_id`)
2. **Removed `$branchId`**: Deleted from types, service, documentation
3. **Confirmed behavior**: Limit counts ALL locations across ALL branches

**How It Works**:

- Professional plan: 100 locations limit
- Counts locations where `organization_id = orgId` AND `deleted_at IS NULL`
- UI loads by branch (fine for display)
- Enforcement is org-wide (user cannot exceed 100 total across all branches)

---

## Next Steps (For Developers)

1. **Update existing server actions**:
   - Search for old guard imports
   - Migrate to `entitlements` namespace
   - Remove `orgId` parameters from calls

2. **Update existing pages**:
   - Replace try/catch with redirect wrappers
   - Use `requireModuleOrRedirect()` for cleaner code

3. **Standardize error handling**:
   - Use `mapEntitlementError()` in all server actions
   - Remove scattered toast messages
   - Consistent error responses for UI

4. **Test org-wide limits**:
   - Switch to Free plan (5 locations)
   - Create 5 locations in Branch A
   - Try creating 6th in Branch B → should fail
   - Verify error: "You've reached your plan limit."

---

## Questions?

- **Guards Code**: [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts)
- **Service Code**: [src/server/services/entitlements-service.ts](../src/server/services/entitlements-service.ts)
- **Types/Strategies**: [src/lib/types/entitlements.ts](../src/lib/types/entitlements.ts)
