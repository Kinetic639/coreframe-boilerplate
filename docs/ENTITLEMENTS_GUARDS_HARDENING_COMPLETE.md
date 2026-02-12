# Entitlements Guards - Hardening Complete ✅

## Summary of Changes

All 5 security and correctness fixes have been implemented exactly as specified.

---

## ✅ FIX 1: Removed Module-Level Cache (Security Bug)

**Problem**: Global variable `_cachedOrgContext` could leak context across concurrent requests.

**Solution**: Replaced with React's `cache()` for request-scoped caching.

**Implementation**:

```typescript
import { cache } from "react";

const getOrgContext = cache(async (): Promise<OrgContext> => {
  // Context extraction logic
});

// In entitlements object:
async requireOrgContext(): Promise<OrgContext> {
  return await getOrgContext();
}
```

**Result**: No global state, no cross-request leakage.

---

## ✅ FIX 2: requireModuleOrRedirect - Only Redirect on MODULE_ACCESS_DENIED

**Problem**: Was redirecting on `MODULE_ACCESS_DENIED`, `FEATURE_UNAVAILABLE`, `LIMIT_EXCEEDED`.

**Solution**: Now **only redirects on `MODULE_ACCESS_DENIED`**.

**Implementation**:

```typescript
if (code === "MODULE_ACCESS_DENIED") {
  const ctx = await this.requireOrgContext();
  const planName = context.planName || ctx.entitlements?.plan_name || "unknown";

  const params = new URLSearchParams({
    reason: "module",
    module: moduleSlug,
    plan: planName,
    org: ctx.orgId,
  });

  redirect(`${baseUrl}?${params.toString()}`);
}

// All other errors throw (ENTITLEMENTS_MISSING, LIMIT_CHECK_FAILED, etc.)
throw error;
```

**Redirect URL Example**:

```
/upgrade?reason=module&module=warehouse&plan=professional&org=abc123
```

---

## ✅ FIX 3: requireWithinLimitOrRedirect - Stable Params (No Misleading 0/0)

**Problem**: Was always including `current=0&limit=0` even when context values were missing.

**Solution**: Only include `current`/`limit` params if they're present as numbers.

**Implementation**:

```typescript
if (code === "LIMIT_EXCEEDED") {
  const params = new URLSearchParams({
    reason: "limit",
    key: limitKey,
    plan: planName,
    org: ctx.orgId,
  });

  // Only include current/limit if they're present as numbers
  if (typeof context.current === "number") {
    params.set("current", String(context.current));
  }
  if (typeof context.limit === "number") {
    params.set("limit", String(context.limit));
  }

  redirect(`${baseUrl}?${params.toString()}`);
}
```

**Redirect URL Examples**:

```
// When current/limit present:
/upgrade?reason=limit&key=warehouse.max_locations&plan=free&org=abc123&current=5&limit=5

// When current/limit missing (no misleading 0/0):
/upgrade?reason=limit&key=warehouse.max_locations&plan=free&org=abc123
```

---

## ✅ FIX 4: mapEntitlementError - Strongly Typed

**Problem**: Return type was `{ code: string; message: string; context?: any }`.

**Solution**: Now strongly typed with proper types from `entitlements.ts`.

**Implementation**:

```typescript
import {
  EntitlementError,
  type EntitlementErrorCode,
  type EntitlementErrorContext,
  // ...
} from "@/lib/types/entitlements";

export function mapEntitlementError(error: unknown): {
  code: EntitlementErrorCode; // ✅ Strongly typed
  message: string;
  context?: EntitlementErrorContext; // ✅ Strongly typed
} | null {
  if (!(error instanceof EntitlementError)) {
    return null;
  }

  const messages: Record<EntitlementErrorCode, string> = {
    MODULE_ACCESS_DENIED: "This module is not available on your plan.",
    FEATURE_UNAVAILABLE: "This feature is not available on your plan.",
    LIMIT_EXCEEDED: "You've reached your plan limit.",
    LIMIT_CHECK_FAILED: "Couldn't verify your plan limits. Please try again.",
    ENTITLEMENTS_MISSING: "Subscription configuration is missing. Contact support.",
    NO_ACTIVE_SUBSCRIPTION: "No active subscription found. Contact support.",
  };

  return {
    code: error.code,
    message: messages[error.code] || "An entitlement error occurred.",
    context: error.context,
  };
}
```

**Result**: Full type safety, autocomplete support, compile-time checks.

---

## ✅ FIX 5: No Duplicated Content

**Verification**: File has exactly **363 lines**, single set of exports, no duplication.

**Exports**:

- `export interface OrgContext`
- `export const entitlements = { ... }`
- `export function mapEntitlementError(...)`

**Result**: Clean, compilable, single source of truth.

---

## Final Checklist ✅

- ✅ **No module-level cache** - Uses React's `cache()` for request-scoped caching
- ✅ **Module redirect only on MODULE_ACCESS_DENIED** - Other errors throw
- ✅ **Limit redirect only includes current/limit when present** - No misleading 0/0
- ✅ **mapEntitlementError is strongly typed** - Uses `EntitlementErrorCode` and `EntitlementErrorContext`
- ✅ **No duplicated file content** - Single exports, clean structure

---

## Acceptance Tests

### Test 1: No Cross-Request Context Leakage ✅

**Setup**: Two concurrent requests from different users/orgs.

**Expected**: Each request gets its own context (no sharing).

**Implementation**: React's `cache()` is request-scoped by design.

---

### Test 2: Module Access Redirect ✅

**Scenario**: User on Free plan tries to access Analytics module.

**Expected Redirect**:

```
/upgrade?reason=module&module=analytics&plan=free&org=abc123
```

**Code Path**:

```typescript
await entitlements.requireModuleOrRedirect("analytics");
// Redirects with MODULE_ACCESS_DENIED
```

---

### Test 3: Limit Exceeded Redirect (With Counts) ✅

**Scenario**: User hits 5/5 locations limit.

**Expected Redirect**:

```
/upgrade?reason=limit&key=warehouse.max_locations&plan=free&org=abc123&current=5&limit=5
```

**Code Path**:

```typescript
await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
// Redirects with LIMIT_EXCEEDED, includes current/limit
```

---

### Test 4: Limit Exceeded Redirect (Without Counts) ✅

**Scenario**: Error context missing `current`/`limit` fields.

**Expected Redirect**:

```
/upgrade?reason=limit&key=warehouse.max_locations&plan=free&org=abc123
```

**No `current=0&limit=0` misleading values.**

---

### Test 5: Other Errors Throw (No Redirect) ✅

**Scenario**: System error (`ENTITLEMENTS_MISSING`, `LIMIT_CHECK_FAILED`).

**Expected**: Error thrown, NOT redirected to upgrade page.

**Code Paths**:

```typescript
// Module wrapper - ENTITLEMENTS_MISSING
await entitlements.requireModuleOrRedirect("warehouse");
// Throws, does NOT redirect

// Limit wrapper - LIMIT_CHECK_FAILED
await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
// Throws, does NOT redirect
```

---

## Files Changed

### 1. [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts) ✅

- **Complete rewrite** with all 5 fixes applied
- 363 lines, no duplication
- All exports clean and typed

### 2. [src/lib/types/entitlements.ts](../src/lib/types/entitlements.ts) ✅

- **No changes needed** - types already exported correctly
- `EntitlementErrorCode` and `EntitlementErrorContext` already available

---

## No Other Changes

- ✅ `EntitlementsService` **unchanged** (as required)
- ✅ Database migrations **unchanged**
- ✅ Limit strategies **unchanged**

---

## Ready for Production ✅

All security and correctness issues resolved:

1. **Security**: No global cache leakage
2. **Correctness**: Redirects only on appropriate error codes
3. **UX**: No misleading 0/0 in URLs
4. **Type Safety**: Fully typed error mapping
5. **Code Quality**: Clean, single source of truth

---

## Usage Examples (No Changes)

**Server Action**:

```typescript
import { entitlements } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export async function createLocation(data) {
  const ctx = await entitlements.requireOrgContext();
  await entitlements.requireModuleAccess("warehouse");
  await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
  // Create location...
}
```

**Server Component (Page)**:

```typescript
export default async function AnalyticsPage() {
  await entitlements.requireModuleOrRedirect("analytics");
  // Renders page or redirects to /upgrade
}
```

**Error Mapping**:

```typescript
import { mapEntitlementError } from "@/server/guards/entitlements-guards";

try {
  await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
  return { success: true };
} catch (error) {
  const mapped = mapEntitlementError(error);
  if (mapped) {
    return { success: false, error: mapped };
  }
  throw error;
}
```

---

## Questions?

- **Guards Code**: [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts)
- **Types**: [src/lib/types/entitlements.ts](../src/lib/types/entitlements.ts)
- **Service**: [src/server/services/entitlements-service.ts](../src/server/services/entitlements-service.ts)
