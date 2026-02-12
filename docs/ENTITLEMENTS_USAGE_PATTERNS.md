# Entitlements Usage Patterns

This guide explains **when and how** to use entitlements in different Next.js environments.

---

## Quick Decision Tree

**Where are you?**

1. **Server Component (page.tsx, layout.tsx)** → Use redirect wrappers
2. **Route Handler (route.ts, API routes)** → Use redirect wrappers
3. **Server Action (action.ts)** → Use throwing guards + error mapping

---

## Pattern 1: Server Components (Pages) ✅

**Use**: Redirect wrappers (`requireModuleOrRedirect`, `requireWithinLimitOrRedirect`)

**Why**: In page rendering, redirecting to `/upgrade` is the desired behavior when access is denied.

### Example: Analytics Page

```typescript
// app/[locale]/analytics/page.tsx
import { entitlements } from "@/server/guards/entitlements-guards";

export default async function AnalyticsPage() {
  // Redirects to /upgrade if MODULE_ACCESS_DENIED
  await entitlements.requireModuleOrRedirect("analytics");

  // User has access, render page
  return (
    <div>
      <h1>Analytics Dashboard</h1>
      {/* ... */}
    </div>
  );
}
```

### Example: Locations Page (with Limit Check)

```typescript
// app/[locale]/warehouse/locations/page.tsx
import { entitlements } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export default async function LocationsPage() {
  // Redirect if over limit (prevents viewing page at all)
  await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

  // User within limit, render page
  return <LocationsManager />;
}
```

**Benefits**:

- Clean, declarative code
- Automatic redirect with context (query params include plan, org, etc.)
- User sees upgrade page immediately

---

## Pattern 2: Route Handlers (API Routes) ✅

**Use**: Redirect wrappers or throwing guards (depending on desired behavior)

**Why**: Route handlers can either redirect or return error responses.

### Example A: Redirect on Denial

```typescript
// app/api/analytics/route.ts
import { entitlements } from "@/server/guards/entitlements-guards";

export async function GET() {
  // Redirects to /upgrade if denied
  await entitlements.requireModuleOrRedirect("analytics");

  // Generate report...
  return Response.json({ data: report });
}
```

### Example B: Return Error Response

```typescript
// app/api/analytics/route.ts
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";

export async function GET() {
  try {
    await entitlements.requireModuleAccess("analytics");
    // Generate report...
    return Response.json({ data: report });
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) {
      return Response.json(
        { error: mapped },
        { status: mapped.code === "MODULE_ACCESS_DENIED" ? 403 : 500 }
      );
    }
    throw error;
  }
}
```

**Choose redirect** when: API is called by navigation (user clicks link)
**Choose error response** when: API is called by client-side code (fetch/axios)

---

## Pattern 3: Server Actions ✅

**Use**: Throwing guards (`requireModuleAccess`, `requireWithinLimit`) + `mapEntitlementError`

**Why**: Redirect in actions is often unwanted - you want to return error to client for handling.

### Example: Create Location Action

```typescript
// src/app/actions/warehouse/locations.ts
"use server";

import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export async function createLocation(data: LocationFormData) {
  try {
    // 1. Get context
    const ctx = await entitlements.requireOrgContext();

    // 2. Check module access
    await entitlements.requireModuleAccess("warehouse");

    // 3. Check limit (throws if exceeded)
    await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);

    // 4. Create location
    const location = await db.locations.create({
      ...data,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
    });

    return { success: true, data: location };
  } catch (error) {
    // Map to user-friendly error
    const mapped = mapEntitlementError(error);
    if (mapped) {
      return { success: false, error: mapped };
    }
    throw error; // Unknown error, re-throw
  }
}
```

### Client-Side Usage

```typescript
"use client";

import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export function CreateLocationButton() {
  const router = useRouter();

  async function handleCreate() {
    const result = await createLocation(formData);

    if (!result.success) {
      // Show error message
      toast.error(result.error.message);

      // Optionally redirect to upgrade for entitlement errors
      if (result.error.code === "MODULE_ACCESS_DENIED" ||
          result.error.code === "LIMIT_EXCEEDED") {
        router.push("/upgrade");
      }
      return;
    }

    // Success
    toast.success("Location created!");
    router.refresh(); // Refresh SSR data
  }

  return <button onClick={handleCreate}>Create Location</button>;
}
```

**Benefits**:

- Client controls redirect timing (can show toast first)
- Client decides whether to redirect at all
- Action returns structured error (not abrupt redirect)

---

## Pattern 4: UI Display (Limit Status) ✅

**Use**: `checkLimit()` for non-blocking status display

**Why**: Show limit status without enforcing (user can see they're near limit).

### Example: Products Page with Limit Display

```typescript
// app/[locale]/warehouse/products/page.tsx
import { entitlements } from "@/server/guards/entitlements-guards";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export default async function ProductsPage() {
  // Check limit (doesn't throw, returns status)
  const limitStatus = await entitlements.checkLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);

  return (
    <div>
      <h1>Products</h1>

      {/* Show limit status */}
      {limitStatus && limitStatus.limit !== -1 && (
        <div className="limit-badge">
          {limitStatus.current} / {limitStatus.limit} products
          {!limitStatus.canProceed && (
            <span className="text-red-500"> - Limit reached!</span>
          )}
        </div>
      )}

      {/* Product list */}
      <ProductsList />
    </div>
  );
}
```

**Benefits**:

- User sees status without being blocked
- Can display progress bar, percentage, etc.
- Page still renders even if limit check fails (returns null)

---

## Anti-Patterns ❌

### ❌ DON'T: Use redirect wrappers in Server Actions

```typescript
// ❌ BAD - redirect in action
export async function createProduct(data) {
  await entitlements.requireModuleOrRedirect("warehouse"); // Redirects immediately!
  // User loses form data, abrupt behavior
}
```

**Why bad**: Redirect happens mid-action, user loses context/form state.

**Do instead**: Use throwing guard + error mapping (see Pattern 3).

---

### ❌ DON'T: Pass orgId manually

```typescript
// ❌ BAD - manual orgId passing
const { orgId } = await entitlements.requireOrgContext();
await EntitlementsService.requireModuleAccess(orgId, "warehouse");
```

**Why bad**: Bypasses guard optimization (no pre-loaded entitlements).

**Do instead**:

```typescript
// ✅ GOOD - guards auto-extract context
await entitlements.requireModuleAccess("warehouse");
```

---

### ❌ DON'T: Destructure without understanding

```typescript
// ⚠️ WORKS but be aware:
const { requireWithinLimit } = entitlements;
await requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
```

**Why warning**: Works because guards use standalone functions (no `this`), but:

- If you destructure, you lose namespace clarity
- Prefer `entitlements.requireWithinLimit()` for readability

**Do instead**: Use full namespace for clarity.

---

## Environment-Specific Cheat Sheet

| Environment                     | Use                                                    | Example                                                   |
| ------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| **Server Component** (page.tsx) | `requireModuleOrRedirect`                              | `await entitlements.requireModuleOrRedirect("analytics")` |
| **Route Handler** (route.ts)    | `requireModuleOrRedirect` OR throwing + error response | See Pattern 2                                             |
| **Server Action** (action.ts)   | `requireModuleAccess` + `mapEntitlementError`          | See Pattern 3                                             |
| **UI Display** (limit badge)    | `checkLimit`                                           | `const status = await entitlements.checkLimit(...)`       |

---

## Performance Notes

### ✅ Optimized: Guards pass pre-loaded entitlements

Guards automatically pass `ctx.entitlements` to the service layer, **eliminating redundant DB queries**:

```typescript
// Internal implementation (you don't write this)
async function requireModuleAccess(moduleSlug: string): Promise<void> {
  const ctx = await requireOrgContext(); // Loads entitlements once
  await EntitlementsService.requireModuleAccess(
    ctx.orgId,
    moduleSlug,
    ctx.entitlements // ✅ Passed to service (no DB re-query)
  );
}
```

**Result**: Module/feature checks are **0 additional DB queries** when called through guards.

### Limit Checks Still Query Target Tables

```typescript
await entitlements.requireWithinLimit(LIMIT_KEYS.WAREHOUSE_MAX_PRODUCTS);
// ✅ Loads limit from ctx.entitlements (no DB query)
// ✅ Still counts products table (1 DB query - necessary)
```

**Why**: Limit counts must be real-time (count actual rows in `products` table).

---

## Questions?

- **Guards Code**: [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts)
- **Service Code**: [src/server/services/entitlements-service.ts](../src/server/services/entitlements-service.ts)
- **Types**: [src/lib/types/entitlements.ts](../src/lib/types/entitlements.ts)
