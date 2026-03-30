# Mobile Module Development Guide

> Canonical guide for adding new modules to `apps/mobile`.
>
> This guide is intentionally mobile-specific. It aligns with the shared contracts,
> permissions, entitlements, and branch-context rules used across the repo, but it
> does **not** copy the web SSR architecture blindly. Mobile is a client app with
> Expo Router, authenticated bootstrap, and app-local launcher registration.

## 1. Core Principles

### Non-Negotiable Rules

1. **Security-first**: mobile UI gating is never the security boundary. RLS and backend checks remain authoritative.
2. **Compiled access only**: module visibility and feature gating must use compiled entitlements and compiled permission snapshots already loaded into `AppContext`.
3. **Branch-aware by default**: any branch-sensitive feature must use the explicit current `activeBranchId`, never infer runtime context from `default_branch_id`.
4. **No feature-before-foundation**: do not add mobile-only product breadth before the underlying contracts, permissions, entitlements, and route shell are stable.
5. **Type-safe and testable**: strict TypeScript, no `any`, and tests added alongside implementation.

### Mobile-Specific Architectural Rules

- Mobile uses **Expo Router** route groups:
  - `app/(auth)` for signed-out flow
  - `app/(app)` for authenticated flow
- `AuthProvider` owns session restore and sign-out lifecycle.
- `AppProvider` owns post-auth bootstrap:
  - org context
  - accessible branches
  - org permission snapshot
  - branch permission snapshot
  - entitlements
- Module tiles in the launcher are driven by `apps/mobile/lib/modules/launcher-registry.ts`.
- Secondary authenticated destinations live under the `(app)` stack and are usually linked from launcher tiles or the More screen.
- React Query is scoped to the authenticated tree in [`apps/mobile/app/(app)/_layout.tsx`](</Users/michal/dev/turbo/amba-system/apps/mobile/app/(app)/_layout.tsx>).

## 2. Trust Boundaries

### What Mobile May Trust

- `AppContext.appState.permissions` for **org-scope UI gating**
- `AppContext.appState.branchPermissions` for **branch-scope UI gating**
- `AppContext.appState.entitlements` for **module and limit UX**
- `AppContext.appState.activeOrgId` / `activeBranchId` for current runtime context

### What Mobile Must Not Treat as Authoritative

- Hidden launcher tiles
- Hidden buttons
- Disabled form controls
- Local route guards
- Anything derived only from client navigation state

These are all **UX conveniences only**. Real enforcement remains:

- RLS
- protected backend reads/writes
- validated server-side mutations

## 3. Current Mobile Architecture

### Entry Flow

1. `AuthProvider` restores the session from Secure Store
2. `(app)/_layout.tsx` gates access:
   - no session -> `/(auth)/welcome`
   - session -> mounts `QueryClientProvider` + `AppProvider`
3. `AppProvider` resolves app bootstrap state and only renders authenticated screens when state is valid

### Authenticated UI Shell

- Launcher tab: [`apps/mobile/app/(app)/(tabs)/index.tsx`](</Users/michal/dev/turbo/amba-system/apps/mobile/app/(app)/(tabs)/index.tsx>)
- More tab: [`apps/mobile/app/(app)/(tabs)/more.tsx`](</Users/michal/dev/turbo/amba-system/apps/mobile/app/(app)/(tabs)/more.tsx>)
- Stack drill-down screens: routes under [`apps/mobile/app/(app)`](</Users/michal/dev/turbo/amba-system/apps/mobile/app/(app)>)

### Access Model

- Module-level access is resolved by `getVisibleModules()` in [`apps/mobile/lib/modules/launcher-registry.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/lib/modules/launcher-registry.ts)
- Registry entries are:
  - flat
  - synchronous
  - pure
  - app-local
- Access checks must use:
  - `hasModuleAccess(entitlements, MODULE_X)`
  - `checkPermission(permissions, MODULE_X_ACCESS)` or feature-level permission constants

### Data Layer Pattern

Use this layering order:

1. `lib/queries/...` or `lib/mutations/...`
2. `hooks/queries/...` or `hooks/mutations/...`
3. screen component under `app/(app)/...`

Current examples:

- queries:
  - [`apps/mobile/lib/queries/organization/org-profile.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/lib/queries/organization/org-profile.ts)
  - [`apps/mobile/lib/queries/organization/org-members-list.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/lib/queries/organization/org-members-list.ts)
- mutations:
  - [`apps/mobile/lib/mutations/organization/update-org-profile.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/lib/mutations/organization/update-org-profile.ts)
- hooks:
  - [`apps/mobile/hooks/queries/organization/use-org-profile-query.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/hooks/queries/organization/use-org-profile-query.ts)
  - [`apps/mobile/hooks/mutations/organization/use-update-org-profile-mutation.ts`](/Users/michal/dev/turbo/amba-system/apps/mobile/hooks/mutations/organization/use-update-org-profile-mutation.ts)

## 4. Module Shape

Every new mobile module should be built in slices:

### Slice 1: Shell

- shared module constant already exists in `@repo/contracts/modules`
- launcher registry entry exists
- route shell exists under `app/(app)/<module>/...`
- placeholder screen compiles
- access check is wired

### Slice 2: Data foundation

- required permission constants exist in shared contracts
- required entitlement behavior exists
- queries/mutations are implemented
- tests cover access and data mapping

### Slice 3: Real workflow/UI

- screens consume hooks
- branch context is explicit
- loading/error/empty states are present
- no fake/stub security assumptions

## 5. File Layout

Recommended mobile module layout:

```text
apps/mobile/
├── app/(app)/<module>/
│   ├── index.tsx
│   ├── edit.tsx              # optional
│   ├── [id].tsx             # optional
│   └── _components/         # optional, only when complexity justifies it
├── lib/queries/<module>/
├── lib/mutations/<module>/
├── lib/normalizers/         # only if response shaping is non-trivial
├── hooks/queries/<module>/
├── hooks/mutations/<module>/
└── __tests__/
    ├── app/
    ├── hooks/
    └── lib/
```

Rules:

- Keep feature code app-local unless it is truly stable and shared across platforms.
- Reuse `@repo/contracts`, `@repo/domain`, `@repo/auth`, `@repo/supabase` instead of duplicating core rules.
- Do not introduce a module-specific global store unless React Query + `AppContext` are clearly insufficient.

## 6. Route and Navigation Rules

- Launcher modules must be reachable by a full Expo Router path such as `/(app)/organization`.
- Secondary non-launcher destinations should be linked from:
  - More screen
  - module screen sub-actions
  - stack drill-down flows
- Do not mix module navigation metadata into shared package config.
- Do not copy web sidebar nesting concepts into mobile. Mobile launcher/module navigation is flatter by design.

## 7. Permissions and Entitlements

### Required Order

1. Define module/feature constants in shared contracts first
2. Ensure database permissions and compiled permission flow exist
3. Ensure entitlements snapshot includes the module when needed
4. Only then expose the module in the mobile launcher

### Mobile Gating Rules

- Module tile visibility:
  - `implemented === true`
  - `showInLauncher === true`
  - `accessCheck(ctx) === true`
- Screen-level actions should still gate locally with `checkPermission(...)` for UX clarity
- Branch-specific actions must use `branchPermissions` when the feature is branch-operational

### Branch Rule

For any branch-aware query or mutation:

- use `appState.activeBranchId`
- validate it is non-null before firing
- never use `default_branch_id` as runtime request context

## 8. Data Fetching and Mutations

### Queries

- Use app-local query functions in `lib/queries`
- Keep functions pure and explicit
- Return normalized data where needed
- Classify expected errors rather than throwing ambiguous failures

### Mutations

- Use app-local mutation functions in `lib/mutations`
- Keep validation close to the boundary
- Invalidate or update React Query cache predictably
- Never optimistically imply authorization that the backend may reject

### Bootstrap Boundary

Do not stuff module-specific feature loading into `AppProvider` unless it is truly part of the global authenticated shell.

Global bootstrap is for:

- org context
- branch context
- permission snapshots
- entitlement snapshot

Module data should be loaded lazily by the module screen/hook itself.

## 9. UX States Required

Every production module screen should intentionally handle:

- loading
- empty
- resolved
- forbidden / unavailable action state
- error / retry

Do not ship a module screen that only works in the happy path.

## 10. Testing Requirements

At minimum, new modules should add:

### Registry / Access

- launcher registry test for visibility rules

### Query / Mutation

- query function tests
- mutation function tests
- normalizer tests when used

### Hook / Screen

- hook tests where logic is non-trivial
- screen tests for loading, success, and key interaction paths

Use current examples under:

- [`apps/mobile/__tests__/lib`](/Users/michal/dev/turbo/amba-system/apps/mobile/__tests__/lib)
- [`apps/mobile/__tests__/hooks`](/Users/michal/dev/turbo/amba-system/apps/mobile/__tests__/hooks)
- [`apps/mobile/__tests__/app`](/Users/michal/dev/turbo/amba-system/apps/mobile/__tests__/app)

## 11. Anti-Patterns

Do not:

- add a launcher tile before entitlement/permission wiring is real
- fetch org-scoped data directly inside random UI components without a hook layer
- hide a button and call the feature “secure”
- make branch-aware features without explicit `activeBranchId`
- create mobile-only permission or entitlement rules that diverge from shared contracts
- overbuild module abstractions before the first real workflow exists
- copy the web SSR module guide line-for-line onto mobile

## 12. Recommended Build Order for a New Mobile Module

1. Shared contract readiness
2. Mobile launcher shell
3. Route placeholder(s)
4. Query/mutation foundation
5. Screen implementation
6. Access tests
7. UX/error-state polish
8. Manual runtime validation on device

## 13. Commands Reference

Typical verification commands:

```bash
pnpm --filter mobile run check-types
pnpm --filter mobile run lint
```

If the module changes route structure or bundling behavior, also verify with the normal mobile dev/build flow used in the repo.
