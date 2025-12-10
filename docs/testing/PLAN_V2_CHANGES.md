# Test Plan V2.0 - Changes Summary

**Date**: 2025-12-10
**Status**: All reviewer feedback implemented

---

## Critical Fixes Implemented

### ✅ 1. Environment Correction (CRITICAL)

**V1.0 Problem**: Referenced "Happy-DOM" throughout
**V2.0 Fix**: Corrected to **jsdom** (default) + node override

All references to Happy-DOM removed and replaced with correct environment:

- Default: `jsdom` (no annotation needed)
- Override: `@vitest-environment node` (for server code)

---

### ✅ 2. Timeline Made Realistic

**V1.0 Problem**: Unrealistic 15-week mega-plan
**V2.0 Fix**: 3 incremental milestones (5-8 weeks total)

| Milestone | Focus                      | Duration      |
| --------- | -------------------------- | ------------- |
| 1         | Foundation (post-refactor) | 1-2 weeks     |
| 2         | Core Business Logic        | 2-3 weeks     |
| 3         | User-Facing Features       | 2-3 weeks     |
| **Total** | **Realistic scope**        | **5-8 weeks** |

---

### ✅ 3. Refactor-Aware Sequencing

**V1.0 Problem**: Tests AppStore BEFORE refactor complete
**V2.0 Fix**: **DO NOT START TESTING YET** warning

Added critical blocking section:

```
⚠️ CRITICAL: Read This First

DO NOT START TESTING YET

Prerequisites:
1. ✅ Complete AppContext refactor
2. ✅ Finalize AppContextSpec
3. ✅ Freeze RLS contract
4. ✅ Freeze service signatures
5. ➡️ THEN start testing
```

---

### ✅ 4. Corrected Dependency Order

**V1.0 Problem**: Some tests violated dependency flow
**V2.0 Fix**: Strict order enforced

```
AppContext → Auth → Services → Actions → Hooks → UI
```

**Verification checklist added**:

```bash
# Before ANY testing
ls src/lib/api/app-context-spec.ts
git log --oneline src/lib/api/load-app-context-server.ts | head -5
git log --oneline src/server/services/ | head -10
```

---

### ✅ 5. Test Features, Not Files

**V1.0 Problem**: Attempted to test every file (60+ components, 40+ actions)
**V2.0 Fix**: Test behaviors and critical paths only

**New philosophy**:

- ❌ Test every internal helper
- ❌ Test implementation details
- ✅ Test public APIs and user-facing behavior
- ✅ Test critical business rules
- ✅ Aim for 80% behavioral coverage (not 100% line coverage)

**Reduced scope**:

- Components: 20-30 (down from 60+)
- Actions: 20-30 (down from 40+)
- Hooks: 10-12 (down from 19+)
- Integration tests: 3-5 (down from 15-20)

---

### ✅ 6. Integration Tests Minimized

**V1.0 Problem**: 15-20 integration tests planned
**V2.0 Fix**: **3 maximum** critical workflows

**Why**: Integration tests are expensive and fragile.

**Only test**:

1. Stock receipt workflow (business critical)
2. Permission-gated access (security critical)
3. Branch switching (multi-tenancy critical)

---

### ✅ 7. Migration-Aware Approach

**V1.0 Problem**: Ignored active refactor state
**V2.0 Fix**: Explicit alignment with migration

**Current State Assessment** section added:

- ✅ What's Complete (infrastructure)
- ⚠️ What's In Progress (AppContext refactor)
- 🚫 What's Blocking Testing (5 items)

---

### ✅ 8. Enhanced Permission Tests

**V1.0 Problem**: Missing critical permission scenarios
**V2.0 Fix**: Added missing tests

**NEW tests added**:

- ✅ Permission cache invalidation
- ✅ Role change triggers refetch
- ✅ Org switch → permission reload
- ✅ Token refresh handling
- ✅ Nested RLS checks

---

### ✅ 9. AppContext SSR Tests Enhanced

**V1.0 Problem**: Generic AppStore tests
**V2.0 Fix**: Separate SSR vs Client tests

**SSR Tests** (`@vitest-environment node`):

- Authentication handling
- Organization detection fallback chain
- Branch switching behavior
- React cache() deduplication

**Client Store Tests** (`jsdom`):

- SSR hydration
- Branch switching with data invalidation
- Organization switching triggers reload

---

### ✅ 10. Realistic Coverage Targets

**V1.0**: Progressive 40% → 90% over 15 weeks
**V2.0**: Realistic 50% → 80% over 5-8 weeks

| Milestone | Coverage | What's Tested    |
| --------- | -------- | ---------------- |
| 1         | 50%      | Foundation only  |
| 2         | 70%      | + Business logic |
| 3         | 80%      | + User features  |

**Key insight**: 80% coverage of critical paths > 90% coverage of everything

---

## New Sections Added

### 1. Testing Philosophy

Explains:

- Test features, not files
- Test pyramid (80% unit, 15% integration, 5% E2E)
- Environment usage table

### 2. Current State Assessment

Shows:

- What's complete ✅
- What's in progress ⚠️
- What's blocking 🚫

### 3. Phase 0: Verify Refactor Complete

Checklist before ANY testing:

```bash
ls src/lib/api/app-context-spec.ts
git log --oneline src/lib/api/load-app-context-server.ts
# etc.
```

### 4. FAQ Section

Answers:

- Can I start testing now?
- Why not test everything?
- What about E2E tests?
- Can I test during migration?

---

## Side-by-Side Comparison

| Aspect           | V1.0               | V2.0                      |
| ---------------- | ------------------ | ------------------------- |
| **Environment**  | Happy-DOM ❌       | jsdom ✅                  |
| **Timeline**     | 15 weeks ❌        | 5-8 weeks ✅              |
| **Refactor**     | Ignore ❌          | Block until complete ✅   |
| **Scope**        | Test all files ❌  | Test critical features ✅ |
| **Integration**  | 15-20 tests ❌     | 3-5 tests ✅              |
| **Coverage**     | 90% goal ❌        | 80% goal ✅               |
| **Dependencies** | Some violations ❌ | Strict order ✅           |
| **Realism**      | Assumes stable ❌  | Migration-aware ✅        |

---

## What Stays The Same

✅ Testing infrastructure setup (complete)
✅ Vitest configuration (correct)
✅ MSW handlers (working)
✅ Test harnesses (functional)
✅ Mock utilities (comprehensive)
✅ General test patterns (sound)

---

## Immediate Next Steps

**Before ANY coding**:

1. ✅ Review V2.0 plan with team
2. ✅ Verify AppContext refactor status
3. ✅ Confirm RLS policies frozen
4. ✅ Wait for architecture stabilization

**Once ready**:

1. ➡️ Start with Milestone 1, Phase 1.1 (Auth Utilities)
2. ➡️ Follow strict dependency order
3. ➡️ Track coverage weekly

---

## Key Takeaways

1. **Don't test during refactor** - Wait for stability
2. **Test features, not files** - Focus on behavior
3. **Minimize integration tests** - They're expensive
4. **80% coverage is enough** - Quality over quantity
5. **Follow dependency order** - No shortcuts

---

**This V2.0 plan is production-ready and aligned with your actual project state.**
