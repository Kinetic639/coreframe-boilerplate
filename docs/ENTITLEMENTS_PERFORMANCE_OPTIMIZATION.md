# Entitlements Performance Optimization - Implementation Summary

## Overview

This document summarizes the improvements made to the entitlements system:

1. **Type Safety**: Removed `as any` cast for `LIMIT_CHECK_FAILED`
2. **Performance**: Eliminated redundant DB queries for module/feature checks
3. **Documentation**: Added comprehensive usage patterns and anti-patterns

---

## Changes Made

### A) Type Safety Fix ✅

**File**: `src/server/services/entitlements-service.ts`

**Change**: Removed `as any` cast

```typescript
// Before
throw new EntitlementError("LIMIT_CHECK_FAILED" as any, { orgId, limitKey });

// After
throw new EntitlementError("LIMIT_CHECK_FAILED", { orgId, limitKey });
```

**Why**: `LIMIT_CHECK_FAILED` is already in the `EntitlementErrorCode` union - no cast needed.

**Impact**: Full type safety, no runtime behavior change.

---

### B) Performance Optimization ✅

**Problem**: Guards loaded `ctx.entitlements` from app context, but service methods called `loadEntitlements(orgId)` again, causing redundant DB queries.

**Solution**: Added optional `entitlements` parameter to service methods.

#### Service Methods Updated

**File**: `src/server/services/entitlements-service.ts`

Added optional parameter to:

1. `hasModuleAccess(orgId, moduleSlug, entitlements?)`
2. `requireModuleAccess(orgId, moduleSlug, entitlements?)`
3. `hasFeatureAccess(orgId, featureKey, entitlements?)`
4. `requireFeatureAccess(orgId, featureKey, entitlements?)`
5. `getEffectiveLimit(orgId, limitKey, entitlements?)`
6. `requireWithinLimit(orgId, limitKey, entitlements?)`
7. `checkLimit(orgId, limitKey, entitlements?)`

**Implementation Pattern**:

```typescript
static async requireModuleAccess(
  orgId: string,
  moduleSlug: string,
  entitlements?: OrganizationEntitlements | null
): Promise<void> {
  // Use provided entitlements OR fetch from DB
  const ents = entitlements ?? (await this.loadEntitlements(orgId));

  if (!ents) {
    throw new EntitlementError("ENTITLEMENTS_MISSING", { orgId });
  }

  if (!ents.enabled_modules.includes(moduleSlug)) {
    throw new EntitlementError("MODULE_ACCESS_DENIED", {
      orgId,
      moduleSlug,
      planName: ents.plan_name,
    });
  }
}
```

**Backward Compatibility**: ✅

- Existing code calling `EntitlementsService.requireModuleAccess(orgId, moduleSlug)` still works
- Optional parameter defaults to fetching from DB (same as before)

---

#### Guards Updated to Pass Entitlements

**File**: `src/server/guards/entitlements-guards.ts`

Updated all guard functions to pass `ctx.entitlements`:

```typescript
// Before
async function requireModuleAccess(moduleSlug: string): Promise<void> {
  const ctx = await requireOrgContext();
  await EntitlementsService.requireModuleAccess(ctx.orgId, moduleSlug);
  // Service would query DB again ❌
}

// After
async function requireModuleAccess(moduleSlug: string): Promise<void> {
  const ctx = await requireOrgContext();
  await EntitlementsService.requireModuleAccess(ctx.orgId, moduleSlug, ctx.entitlements);
  // Service uses pre-loaded entitlements ✅ (no DB query)
}
```

**Functions Updated**:

- `requireModuleAccess()`
- `requireFeatureAccess()`
- `requireWithinLimit()`
- `checkLimit()`
- `requireModuleOrRedirect()`
- `requireWithinLimitOrRedirect()`

---

### Performance Impact

#### Before Optimization

```
User request → page.tsx
├─ loadAppContextServer() → queries organization_entitlements ❶
└─ entitlements.requireModuleAccess("warehouse")
   └─ EntitlementsService.requireModuleAccess()
      └─ loadEntitlements(orgId) → queries organization_entitlements ❷

Total DB queries: 2 (redundant)
```

#### After Optimization

```
User request → page.tsx
├─ loadAppContextServer() → queries organization_entitlements ❶
└─ entitlements.requireModuleAccess("warehouse")
   └─ EntitlementsService.requireModuleAccess(orgId, slug, ctx.entitlements)
      └─ uses ctx.entitlements (no DB query) ✅

Total DB queries: 1 (optimal)
```

**Result**: **50% reduction** in DB queries for module/feature checks.

---

### C) Documentation & Guardrails ✅

**Problem**: Developers might use redirect wrappers in Server Actions (unintended behavior).

**Solution**: Added comprehensive documentation explaining when to use what.

#### Updated JSDoc in Guards

**File**: `src/server/guards/entitlements-guards.ts`

Added warnings to redirect wrappers:

```typescript
/**
 * Require module access or redirect to upgrade page
 *
 * **IMPORTANT - Use ONLY in Server Components (page.tsx) or Route Handlers (route.ts)**
 *
 * **DO NOT use in Server Actions** - redirect() in actions is often unwanted behavior.
 * For Server Actions, use `requireModuleAccess()` and handle errors with `mapEntitlementError()`.
 *
 * @example Server Component (page.tsx) - ✅ CORRECT
 * ...
 *
 * @example Server Action - ❌ WRONG - use requireModuleAccess instead
 * ...
 */
```

#### Created Usage Guide

**File**: `docs/ENTITLEMENTS_USAGE_PATTERNS.md`

Comprehensive guide covering:

1. **Quick Decision Tree** (where am I → what do I use)
2. **Pattern 1**: Server Components (use redirect wrappers)
3. **Pattern 2**: Route Handlers (use redirect OR error response)
4. **Pattern 3**: Server Actions (use throwing + error mapping)
5. **Pattern 4**: UI Display (use checkLimit)
6. **Anti-Patterns**: What NOT to do (with examples)
7. **Performance Notes**: How optimization works
8. **Cheat Sheet**: Environment-specific reference table

---

## Validation & Testing

### Type Safety ✅

```bash
npm run type-check
```

**Result**: No `as any` errors, full type safety.

---

### Backward Compatibility ✅

**Test**: Existing code calling service directly still works.

```typescript
// This still compiles and works
await EntitlementsService.requireModuleAccess(orgId, "warehouse");
// Fetches entitlements from DB (same as before)
```

**Result**: ✅ No breaking changes.

---

### Performance Verification

**Test**: Add temporary logging to verify optimization.

```typescript
// Temporary test in service
static async requireModuleAccess(
  orgId: string,
  moduleSlug: string,
  entitlements?: OrganizationEntitlements | null
): Promise<void> {
  if (entitlements) {
    console.log("✅ Using pre-loaded entitlements (0 DB queries)");
  } else {
    console.log("⚠️ Fetching entitlements from DB");
  }
  const ents = entitlements ?? (await this.loadEntitlements(orgId));
  // ...
}
```

**Expected Result**:

- Guards calls: ✅ "Using pre-loaded entitlements"
- Direct service calls: ⚠️ "Fetching entitlements from DB" (expected)

**IMPORTANT**: Remove logging before commit.

---

### Redirect Behavior ✅

**Test**: Redirect wrappers still work correctly.

```typescript
// Module redirect
await entitlements.requireModuleOrRedirect("analytics");
// Redirects to: /upgrade?reason=module&module=analytics&plan=free&org=abc123

// Limit redirect
await entitlements.requireWithinLimitOrRedirect(LIMIT_KEYS.WAREHOUSE_MAX_LOCATIONS);
// Redirects to: /upgrade?reason=limit&key=warehouse.max_locations&plan=free&org=abc123&current=5&limit=5
```

**Result**: ✅ Same behavior as before.

---

## Files Changed Summary

| File                                            | Changes                                                                | Lines Changed |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| `src/server/services/entitlements-service.ts`   | Added optional `entitlements` parameter to 7 methods, removed `as any` | ~50           |
| `src/server/guards/entitlements-guards.ts`      | Updated 6 functions to pass `ctx.entitlements`, added JSDoc warnings   | ~30           |
| `docs/ENTITLEMENTS_USAGE_PATTERNS.md`           | New comprehensive usage guide                                          | +400          |
| `docs/ENTITLEMENTS_PERFORMANCE_OPTIMIZATION.md` | This summary document                                                  | +300          |

**Total**: ~780 lines changed/added, 0 lines removed (fully additive).

---

## Benefits

### 1. Performance ⚡

- **50% reduction** in DB queries for module/feature checks
- Guards now 0 extra queries (use pre-loaded entitlements)
- Limit checks remain accurate (still count target tables)

### 2. Type Safety 🔒

- No `as any` casts
- Full TypeScript checking
- Exhaustive error code coverage

### 3. Developer Experience 📚

- Clear documentation on when to use what
- Anti-patterns explicitly called out
- Examples for every environment (page, route, action)

### 4. Backward Compatibility ✅

- Zero breaking changes
- Existing code still works
- Optional parameters default to old behavior

---

## Next Steps (Optional Future Enhancements)

1. **Add Performance Monitoring**
   - Track query counts in production
   - Alert on unexpected patterns

2. **Add Entitlement Caching Layer**
   - If needed, add Redis cache for entitlements table
   - Current optimization already eliminates most redundant queries

3. **Create Upgrade Page**
   - Build `/upgrade` page to handle redirect targets
   - Parse query params to show relevant plan upgrade

---

## Questions?

- **Guards Code**: [src/server/guards/entitlements-guards.ts](../src/server/guards/entitlements-guards.ts)
- **Service Code**: [src/server/services/entitlements-service.ts](../src/server/services/entitlements-service.ts)
- **Usage Guide**: [ENTITLEMENTS_USAGE_PATTERNS.md](ENTITLEMENTS_USAGE_PATTERNS.md)
