# Entitlements Quick Reference

## Import

```typescript
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";
```

---

## Core Methods

### Get Context

```typescript
const ctx = await entitlements.requireOrgContext();
// Returns: { userId, orgId, branchId, entitlements }
```

### Check Module Access

```typescript
await entitlements.requireModuleAccess("warehouse");
// Throws EntitlementError if denied
```

### Check Feature Access

```typescript
await entitlements.requireFeatureAccess("advanced_exports");
// Throws EntitlementError if unavailable
```

### Check Limit

```typescript
await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
// Throws EntitlementError if exceeded
```

### Check Limit (Non-Throwing)

```typescript
const status = await entitlements.checkLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
// Returns: { limit, current, canProceed, percentageUsed } or null
```

---

## Redirect Wrappers (Pages)

### Module Access with Redirect

```typescript
await entitlements.requireModuleOrRedirect("analytics");
// Redirects to /upgrade?reason=module&module=analytics&plan=free
```

### Limit Check with Redirect

```typescript
await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
// Redirects to /upgrade?reason=limit&key=...&current=5&limit=5
```

### Custom Redirect URL

```typescript
await entitlements.requireModuleOrRedirect("analytics", { redirectTo: "/pricing" });
```

---

## Error Mapping

```typescript
try {
  await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
  // Success path
} catch (error) {
  const mapped = mapEntitlementError(error);
  if (mapped) {
    // { code, message, context }
    return { success: false, error: mapped };
  }
  throw error;
}
```

**Error Messages**:

- `MODULE_ACCESS_DENIED`: "This module is not available on your plan."
- `FEATURE_UNAVAILABLE`: "This feature is not available on your plan."
- `LIMIT_EXCEEDED`: "You've reached your plan limit."
- `LIMIT_CHECK_FAILED`: "Couldn't verify your plan limits. Please try again."
- `ENTITLEMENTS_MISSING`: "Subscription configuration is missing. Contact support."

---

## Usage Examples

### Server Action Pattern

```typescript
export async function createLocation(data: LocationData) {
  const ctx = await entitlements.requireOrgContext();
  await entitlements.requireModuleAccess("warehouse");
  await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

  const location = await db.createLocation({
    ...data,
    organization_id: ctx.orgId,
    created_by: ctx.userId,
  });

  return { success: true, data: location };
}
```

### Server Component (Page) Pattern

```typescript
export default async function AnalyticsPage() {
  await entitlements.requireModuleOrRedirect("analytics");

  // User has access, render page
  return <AnalyticsDashboard />;
}
```

### UI Feedback Pattern

```typescript
export async function getProductsData() {
  const limitStatus = await entitlements.checkLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);

  return {
    products: await getProducts(),
    limitStatus, // Show in UI: "75 / 100 products"
  };
}
```

---

## Limit Keys

```typescript
LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS; // "warehouse.max_products"
LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS; // "warehouse.max_locations"
LIMIT_KEYS.WAREHOUSE_MAX_BRANCHES; // "warehouse.max_branches"
LIMIT_KEYS.ORGANIZATION_MAX_USERS; // "organization.max_users"
LIMIT_KEYS.ANALYTICS_MONTHLY_EXPORTS; // "analytics.monthly_exports"
```

---

## Key Rules

✅ **Always import from guards** (not service directly)
✅ **Never pass orgId** (auto-extracted internally)
✅ **Use redirect wrappers in pages** (cleaner than try/catch)
✅ **Use mapEntitlementError** (consistent error messages)
✅ **Limits are org-wide** (count across all branches)

❌ **Don't query entitlements tables** (use guards/service)
❌ **Don't bypass guards** (no direct service calls in actions)
❌ **Don't use branch_id for limits** (all limits are org-wide)
