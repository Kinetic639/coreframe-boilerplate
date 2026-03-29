# MOBILE_MODULE_IMPLEMENTATION_CHECKLIST.md

> Copy this file for each new mobile module and work through it top to bottom.
> Do not mark a box unless it is verifiably true in the current codebase.

---

## 1. Module Definition

- [ ] Human name chosen
- [ ] Shared module slug already exists in `@repo/contracts/modules`
- [ ] Scope is clear:
  - [ ] launcher-visible module
  - [ ] utility-only authenticated screen
  - [ ] branch-aware operational module
- [ ] This module does not widen mobile product scope beyond the agreed roadmap

### Spec

```text
Module name:
Module slug:
Primary route:
Launcher visible: yes / no
Branch-aware: yes / no
Plan-gated: yes / no
```

---

## 2. Shared Contract Readiness

- [ ] Required permission constants exist in `@repo/contracts/permissions`
- [ ] Required module constant exists in `@repo/contracts/modules`
- [ ] Required entitlement keys/types exist in `@repo/contracts/entitlements` if applicable
- [ ] Shared domain helpers from `@repo/domain` are reused instead of duplicated
- [ ] No new mobile-only raw permission strings introduced in TypeScript
- [ ] No new mobile-only raw module strings introduced in TypeScript

---

## 3. Access Model

- [ ] Launcher visibility logic is defined
- [ ] Access rule uses compiled entitlements via `hasModuleAccess(...)` if plan-gated
- [ ] Access rule uses compiled permissions via `checkPermission(...)` when needed
- [ ] Branch-scoped features use `appState.branchPermissions`
- [ ] Org-scoped features use `appState.permissions`
- [ ] Hidden UI is treated as UX only, not as security enforcement

---

## 4. Route Shell

- [ ] Route exists under `apps/mobile/app/(app)/<module>/`
- [ ] Route naming matches current Expo Router conventions
- [ ] Module can be reached from the correct navigation entry point
- [ ] Placeholder or initial screen compiles cleanly before feature logic is added
- [ ] The route does not bypass authenticated app shell structure

---

## 5. Launcher / Navigation Integration

- [ ] `apps/mobile/lib/modules/launcher-registry.ts` updated if launcher-visible
- [ ] `implemented` is false until the screen truly exists
- [ ] `showInLauncher` is correct for the module
- [ ] `route` points to a real Expo Router destination
- [ ] Utility-only screens are linked from More or another explicit entry point instead of the launcher

---

## 6. Data Layer

- [ ] Query functions added under `apps/mobile/lib/queries/<module>/` if needed
- [ ] Mutation functions added under `apps/mobile/lib/mutations/<module>/` if needed
- [ ] Response normalization added only where justified
- [ ] Hook wrappers added under `apps/mobile/hooks/queries/<module>/` or `hooks/mutations/<module>/`
- [ ] Module data is loaded lazily by the screen/hook, not shoved into global bootstrap unnecessarily
- [ ] Any branch-aware query/mutation uses explicit `activeBranchId`

---

## 7. UX States

- [ ] Loading state exists
- [ ] Empty state exists
- [ ] Error state exists
- [ ] Retry path exists where appropriate
- [ ] Forbidden/unavailable actions are handled intentionally
- [ ] Sign-out / session-loss behavior is not broken by this module

---

## 8. Branch Context

- [ ] Confirmed whether the module is branch-aware or not
- [ ] `activeBranchId` is validated before branch-scoped queries/mutations
- [ ] No runtime behavior depends on `default_branch_id`
- [ ] Branch switching behavior is sane after entering/leaving the module

---

## 9. Testing

- [ ] Query tests added
- [ ] Mutation tests added
- [ ] Normalizer tests added if a normalizer was introduced
- [ ] Hook tests added when hook logic is non-trivial
- [ ] Screen/app tests added for main states and key interactions
- [ ] Launcher registry visibility test updated if launcher integration changed

---

## 10. Verification

- [ ] `pnpm --filter mobile run check-types`
- [ ] `pnpm --filter mobile run lint`
- [ ] Manual runtime validation performed on device/simulator as needed
- [ ] Navigation to the module works
- [ ] Access gating behaves correctly for entitled / non-entitled users
- [ ] Branch behavior behaves correctly if branch-aware

---

## 11. Anti-Regression Checks

- [ ] No changes broke `AuthProvider`
- [ ] No changes broke `AppProvider`
- [ ] No changes broke launcher rendering
- [ ] No changes broke More screen routing
- [ ] No new global state added without clear need
- [ ] No web-only architectural assumptions leaked into mobile module design

---

## 12. Ship Decision

- [ ] Module shell only
- [ ] Data foundation complete
- [ ] First real workflow complete
- [ ] Tests and verification are sufficient for the current slice
- [ ] Deferred items are documented explicitly
