# Monorepo Extraction Plan

## Progress Tracker

### Phase 0 - Foundation

- [x] Audit and freeze current monorepo baseline before extraction
- [x] Consolidate Prettier into a shared workspace config
- [x] Consolidate ESLint presets for Next.js, Expo, shared packages, and tests
- [x] Consolidate TypeScript base configs for Next.js, Expo, Node, and package libraries
- [x] Consolidate lint-staged and Husky conventions at the root
- [x] Standardize root scripts for lint, typecheck, build, and test orchestration
- [x] Verify `apps/web` still works in local dev and production-style build
- [x] Verify `apps/mobile` still works in Expo after config extraction

Phase 0 completion notes:

- Root Prettier now provides the monorepo default, while `apps/web/.prettierrc` intentionally remains app-local to preserve current web formatting behavior and plugin compatibility.
- Shared ESLint coverage now includes Next.js, Expo, shared packages, and test files. `apps/mobile` now consumes the shared Expo preset directly.
- Shared TypeScript coverage now includes Next.js, Expo, React-library, and Node variants. `apps/mobile` now consumes the shared Expo preset directly.
- Root test orchestration currently targets `apps/web`, which is the only workspace with a real test suite in Phase 0.
- `apps/web` production-style build was verified up to `next build`, but external Google Fonts fetching can fail in restricted-network environments. This is an environmental build dependency, not a Phase 0 tooling regression.

### Phase 1 - Canonical Contracts

- [ ] Create `@repo/contracts`
- [ ] Extract canonical permission constants
- [ ] Extract canonical module constants
- [ ] Extract entitlement keys and limit identifiers
- [ ] Extract portable auth-related schemas and DTOs
- [ ] Extract shared business-safe Zod schemas
- [ ] Compare extracted constants against live `supabase-target`
- [ ] Resolve or document all code-vs-database contract mismatches

### Phase 2 - Shared Auth and Supabase Contracts

- [ ] Create `@repo/supabase`
- [ ] Create `@repo/auth`
- [ ] Move generated database types into a shared package
- [ ] Move JWT claim and role-parsing logic into shared auth package
- [ ] Create platform-neutral client factory interfaces
- [ ] Keep web SSR Supabase adapter in `apps/web`
- [ ] Design Expo/mobile Supabase adapter boundary without implementing app logic yet
- [ ] Verify no shared package imports platform-specific runtime APIs

### Phase 3 - Shared Domain Layer

- [ ] Create `@repo/domain`
- [ ] Extract pure permission evaluation rules
- [ ] Extract entitlement domain logic
- [ ] Extract organization and branch domain models
- [ ] Extract invitation domain contracts
- [ ] Extract platform event/audit domain contracts
- [ ] Keep infrastructure and DB access adapters app-local until stable
- [ ] Verify extracted domain code is framework-agnostic

### Phase 4 - Shared Testing Platform

- [ ] Create `@repo/testing`
- [ ] Move pure-domain test helpers and factories into shared package
- [ ] Move reusable permission/entitlement assertion helpers into shared package
- [ ] Keep app integration tests in each app
- [ ] Add contract tests around shared packages
- [ ] Add package-level CI verification for shared contracts

### Phase 5 - Mobile Enablement

- [ ] Define mobile app architecture based on extracted shared packages
- [ ] Add Expo-compatible auth/session adapter for Supabase
- [ ] Reuse shared contracts, auth, and domain packages in `apps/mobile`
- [ ] Extract only truly cross-platform presentation logic where justified
- [ ] Keep web-only UI patterns out of mobile packages
- [ ] Validate mobile auth, org selection, permissions, and entitlements against shared backend

### Phase 6 - Hardening and Enterprise Readiness

- [ ] Add documentation for package ownership and architectural boundaries
- [ ] Add change-control checklist for shared backend contracts
- [ ] Add verification workflow for permission/module constants against Supabase
- [ ] Review service-role usage and ensure it is isolated
- [ ] Review auth settings and security posture for mobile rollout
- [ ] Add release/rollback guidance for future extractions

---

## 1. Objective

This document defines the gradual extraction plan for moving the current standalone-style Next.js application inside `apps/web` into a real Turborepo monorepo architecture that can safely support:

- `apps/web` as the SSR-first production web application
- `apps/mobile` as the Expo-based mobile client
- Supabase as the shared backend and auth platform
- enterprise-grade standards for security, performance, maintainability, and change control

This plan is intentionally incremental. The goal is not to aggressively move everything into packages up front. The goal is to extract only the layers that are truly shared, stable, and valuable for both web and mobile, while preserving the working production behavior of the web app.

That matters because the current codebase is not yet a cleanly separated platform architecture. It is a working Next.js application that has been moved into a monorepo, but most of the business logic, contracts, infrastructure, and runtime concerns still live inside `apps/web`.

The right strategy is therefore:

1. stabilize the monorepo foundation,
2. define the canonical shared contracts,
3. isolate shared backend and auth boundaries,
4. extract pure domain logic,
5. enable mobile against those extracted layers,
6. harden the whole system for long-term production use.

---

## 2. Current State Summary

### 2.1 Monorepo State

The repository already has:

- Turborepo configured at the root
- a workspace layout using `apps/*` and `packages/*`
- a fresh Expo app in `apps/mobile`
- the copied and working Next.js app in `apps/web`
- starter shared packages for ESLint, TypeScript, and UI

At the same time, the current monorepo is still in an early migration shape:

- only a small portion of tooling is actually centralized
- most business logic still lives in `apps/web`
- app-local config still exists in multiple places
- package boundaries do not yet map to platform-independent responsibilities
- Supabase contracts are not yet fully elevated into shared workspace packages

### 2.2 What Is Already Good

Several architectural choices are already strong and should be preserved:

- the web app is SSR-first
- Supabase is already treated as the system of record
- RLS is enabled on core backend tables
- permission and entitlement logic already has pure-function seams
- there is meaningful test coverage around services and permission behavior
- the backend already includes custom auth hooks and JWT enrichment

### 2.3 What Is Not Yet Ready for Shared Reuse

The current codebase still mixes these concerns too tightly inside `apps/web`:

- canonical contracts and product constants
- Next.js-specific runtime adapters
- browser-only and server-only Supabase code
- domain rules and infrastructure access
- package-worthy utilities and app-local utilities

Because of that, extracting everything directly would be risky and would create brittle packages that are coupled to the wrong runtime.

---

## 3. Guiding Principles

### 3.1 Extract by Stability, Not by File Count

Do not move code into `packages/*` just because it looks reusable. Move code only when:

- it represents a stable business contract,
- it is platform-agnostic,
- or it clearly belongs to shared tooling.

### 3.2 Do Not Extract Runtime Coupling Too Early

Anything that depends directly on:

- `next/headers`
- Next.js route handlers
- Server Actions
- Expo storage/session behavior
- browser-specific runtime APIs

should remain app-local until the shared contract below it is stable.

### 3.3 Supabase Is the Backend Source of Truth

Shared constants and contracts must not drift from the live backend. In practice that means:

- permissions must match the `permissions` table
- modules must match live entitlements and plan/module data
- auth claim assumptions must match the custom access token hook
- shared DTOs must reflect the live schema and authoritative RPCs

### 3.4 Mobile Should Reuse Contracts and Logic, Not Web Runtime

The mobile app should reuse:

- contracts
- domain rules
- auth claim parsing
- Supabase types
- shared business validations

It should not reuse:

- web SSR loaders
- Next.js route infrastructure
- server-only cookie adapters
- Radix/shadcn web UI

### 3.5 Enterprise Standards Mean Controlled Change

For this repo, enterprise-grade means:

- explicit boundaries
- auditable contracts
- security-first Supabase usage
- predictable release sequencing
- no accidental service-role exposure
- no silent contract drift between app code and database

---

## 4. Proposed Target Package Architecture

This is the recommended package map for the monorepo.

### 4.1 `@repo/tooling`

Purpose:

- shared developer tooling conventions
- prettier config exports
- optional lint-staged helpers
- optional repo-wide config helpers

What should live here:

- shared Prettier config
- formatting rules documentation
- optional shared helper config used by scripts

What should not live here:

- app runtime code
- platform code
- business logic

### 4.2 `@repo/eslint-config`

Purpose:

- central lint policy for the whole monorepo

What should live here:

- base JS/TS rules
- Next.js-specific config
- Expo/React Native config
- React library config
- Node package config
- testing config

What should not live here:

- app business rules
- hardcoded per-feature exceptions unless truly necessary

### 4.3 `@repo/typescript-config`

Purpose:

- central TS config strategy

What should live here:

- `base.json`
- `nextjs.json`
- `expo.json`
- `node.json`
- `react-library.json`

What should not live here:

- app-local path aliases that only make sense inside one app

### 4.4 `@repo/contracts`

Purpose:

- canonical shared product and backend contracts

What should live here:

- permission slug constants
- module slug constants
- entitlement keys
- shared enum-like identifiers
- contract-level Zod schemas
- platform-neutral DTOs

This package should become the first real shared business package, because both web and mobile will need the same meaning for:

- permissions
- modules
- entitlements
- auth payloads
- scope identifiers

### 4.5 `@repo/supabase`

Purpose:

- shared Supabase contract layer

What should live here:

- generated TypeScript database types
- canonical table/view/RPC/storage identifiers
- env schema definitions related to Supabase
- neutral client-factory interfaces

What should not live here:

- `next/headers` cookies adapters
- Expo secure storage
- browser session persistence behavior
- service-role operational code used by app-specific infrastructure

### 4.6 `@repo/auth`

Purpose:

- shared auth-domain logic

What should live here:

- JWT claim types
- role parsing helpers
- permission-check primitives
- auth schemas and DTOs
- cross-platform auth domain helpers

This package is a good extraction target because the repo already has pure logic around token claims and roles that does not inherently belong to Next.js.

### 4.7 `@repo/domain`

Purpose:

- pure business/domain logic shared across applications

What should live here:

- domain types and interfaces for organizations, branches, invitations, permissions, entitlements, and events
- policy evaluation logic
- framework-agnostic service interfaces
- pure transformations and derivations

What should not live here:

- actual DB query implementations tightly coupled to one runtime
- web route behavior
- mobile navigation behavior

### 4.8 `@repo/testing`

Purpose:

- shared testing support for reusable packages

What should live here:

- test factories
- shared mocks for pure-domain units
- contract verification helpers
- permission/entitlement test utilities

What should not live here:

- app integration tests that depend on web routing or Expo runtime

### 4.9 Optional Future Packages

Possible later packages:

- `@repo/ui-web`
- `@repo/ui-native`
- `@repo/config`
- `@repo/i18n`

These should only be created after the contracts and domain layers are stable. They are not phase-one priorities.

---

## 5. What Should Be Extracted First

The first extractions should focus on low-risk, high-leverage shared assets.

### 5.1 Shared Tooling

Extract first:

- Prettier config
- ESLint presets
- TypeScript configs
- root lint/typecheck/test ergonomics
- lint-staged/Husky conventions

Why first:

- low business risk
- immediate monorepo consistency
- easier future package creation
- reduces configuration drift between web and mobile

### 5.2 Canonical Contracts

Extract next:

- permission constants
- module constants
- auth DTOs
- shared Zod schemas
- entitlement keys and shared contract types

Why second:

- mobile cannot safely grow until the core language of the product is shared
- these contracts are needed by both apps
- they are easier to validate against Supabase than high-level app behavior

### 5.3 Shared Auth and Supabase Contract Layer

Extract after contracts:

- DB types
- claim shapes
- runtime-neutral client boundaries
- shared environment schema

Why:

- web and mobile will both depend on Supabase
- the backend shape should not be duplicated in multiple apps
- the current app has enough auth/backend logic that formalizing the boundary is now worth it

---

## 6. What Must Stay in `apps/web` for Now

These areas should remain web-local during the early extraction phases:

- Next.js SSR Supabase cookie adapter
- route handlers
- server actions
- layout loaders
- Next-specific internationalization wiring
- web-only UI components
- web-only sidebar rendering and navigation presentation
- any direct `next/*` runtime integration

This is important because forcing these pieces into shared packages too early creates packages that are not truly shared. It only hides web coupling behind package boundaries.

---

## 7. Supabase Findings That Must Shape the Plan

The extraction roadmap should reflect the real backend, not just the current app code.

### 7.1 Backend Strengths Confirmed

From `supabase-target` verification:

- core public tables have RLS enabled
- roles, permissions, user effective permissions, organizations, branches, members, and entitlements are already formalized
- custom auth hooks are in place
- an auth email edge function exists
- backend function contracts such as `accept_invitation_and_join_org`, `custom_access_token_hook`, and `user_has_effective_permission` exist

This is good enough to treat Supabase as the shared system of record for both web and mobile.

### 7.2 Contract Drift Exists Today

There are mismatches between current app code and live backend contracts.

Examples:

- live permissions include more wildcard and module-access slugs than the current TypeScript constants model
- live active plan modules are narrower than the current TypeScript module list
- parts of web subscription logic appear to assume schema details that do not fully match the live target schema

This means the first shared extraction phase must include a contract reconciliation step.

Do not blindly move current constants into shared packages without checking them against Supabase.

### 7.3 Security Hardening Still Needed

Current findings indicate areas to improve before full mobile rollout:

- leaked password protection is disabled
- local auth config uses weak minimum password length
- secure password change is disabled in local config
- MFA is not enabled

These are not blockers for extraction planning, but they are part of enterprise readiness and should be tracked as hardening work.

---

## 8. Detailed Phase Plan

## Phase 0 - Foundation

### Goal

Turn the repo from a migrated folder structure into a real monorepo foundation without touching business logic.

### Deliverables

- shared Prettier config
- centralized ESLint presets
- centralized TypeScript config variants
- root-level developer workflow consistency
- app-level configs simplified to thin wrappers or package imports

### Detailed Tasks

1. Review current config ownership:
   - root `package.json`
   - root `turbo.json`
   - current app-local ESLint configs
   - app-local Prettier config
   - Husky and lint-staged setup

2. Expand `@repo/eslint-config`:
   - add Next.js preset
   - add Expo preset
   - add shared-library preset
   - add test preset if useful

3. Expand `@repo/typescript-config`:
   - define base TS behavior
   - separate app/runtime configs from package/library configs

4. Centralize Prettier:
   - move current web formatting defaults into a shared config package or shared root config
   - ensure both web and mobile use the same formatting source of truth

5. Review lint-staged:
   - make sure it works consistently for apps and packages
   - avoid hardcoding behavior that will break as more shared packages appear

6. Verify command ergonomics:
   - root lint
   - root typecheck
   - per-app lint
   - per-app typecheck

### Exit Criteria

- web app behavior unchanged
- mobile app still lintable
- no duplicate configuration logic that obviously belongs in shared packages

---

## Phase 1 - Canonical Contracts

### Goal

Create a single shared source of truth for product/backend contracts needed by all apps.

### Deliverables

- new `@repo/contracts` package
- extracted shared constants
- extracted shared types and DTOs
- extracted shared business-safe schemas
- documented code-vs-backend mismatches

### Detailed Tasks

1. Extract canonical constants:
   - permissions
   - modules
   - entitlement keys
   - scope identifiers

2. Extract shared contract types:
   - auth claim payloads
   - permission snapshot types
   - entitlement payload types
   - organization/branch identifiers where stable

3. Extract Zod schemas that are not web-form specific:
   - auth DTOs if portable
   - shared API input/output schemas
   - contract-level validation logic

4. Compare against live Supabase target:
   - permission slugs
   - module slugs
   - relevant RPC naming assumptions

5. Document mismatches instead of silently normalizing them.

### Exit Criteria

- both web and future mobile can import the same canonical constants
- contract package has no web-only imports
- all intentional mismatches are visible and tracked

---

## Phase 2 - Shared Auth and Supabase Contracts

### Goal

Define the reusable backend and auth contract boundary without mixing platform-specific runtime details into shared packages.

### Deliverables

- `@repo/supabase`
- `@repo/auth`
- shared DB types
- shared auth claim logic
- shared env schemas and backend identifiers
- explicit platform adapter boundaries

### Detailed Tasks

1. Create `@repo/supabase`:
   - move generated database types here
   - define canonical names for tables/RPCs if useful
   - define env schema for public URL, anon key, and server-only requirements

2. Create `@repo/auth`:
   - move JWT role parsing helpers
   - move auth-related domain types
   - move shared permission-check helpers if ownership fits better here than in contracts/domain

3. Preserve runtime separation:
   - `apps/web` keeps SSR cookie-based client creation
   - `apps/mobile` will later get its own session/storage adapter
   - service-role operational code remains isolated

4. Ensure no shared package directly depends on:
   - `next/headers`
   - Expo secure storage
   - browser local storage
   - route handlers

### Exit Criteria

- Supabase types are not duplicated across apps
- auth claim handling is shared
- platform runtime code is still separated cleanly

---

## Phase 3 - Shared Domain Layer

### Goal

Extract pure domain logic from the web app so that business behavior can be reused safely across web and mobile.

### Deliverables

- `@repo/domain`
- shared business logic for permissions, entitlements, organizations, branches, invitations, and events
- framework-agnostic interfaces

### Detailed Tasks

1. Identify pure domain code:
   - permission matching rules
   - entitlement decision helpers
   - organization and branch selection rules
   - invitation data contracts
   - event payload shaping where framework-agnostic

2. Keep infrastructure app-local:
   - DB query orchestration
   - web SSR loaders
   - route wiring
   - request-scoped caching tied to React/Next runtime

3. Introduce clear interfaces:
   - repositories or query adapters
   - service inputs/outputs
   - domain policies independent of transport/runtime

### Exit Criteria

- domain package can be imported by both web and mobile
- no framework/runtime dependencies leak into pure domain code

---

## Phase 4 - Shared Testing Platform

### Goal

Make shared packages independently verifiable and reduce duplicated test scaffolding.

### Deliverables

- `@repo/testing`
- shared test helpers for contracts and domain code
- package-level tests for extracted logic

### Detailed Tasks

1. Move reusable test utilities:
   - permission test fixtures
   - entitlement test fixtures
   - auth claim builders
   - pure mock data factories

2. Keep app integration tests where they belong:
   - Next.js route tests stay in `apps/web`
   - Expo runtime tests stay in `apps/mobile`

3. Add package verification:
   - lint
   - typecheck
   - unit tests

### Exit Criteria

- shared packages can be tested without booting a full app runtime
- app-specific tests remain focused on integration behavior

---

## Phase 5 - Mobile Enablement

### Goal

Start building the mobile application on top of extracted shared architecture, not by re-creating web internals.

### Deliverables

- mobile app consuming `@repo/contracts`, `@repo/supabase`, `@repo/auth`, and `@repo/domain`
- Expo-specific Supabase auth adapter
- shared backend semantics between web and mobile

### Detailed Tasks

1. Create mobile runtime adapters:
   - session storage strategy
   - auth bootstrap flow
   - mobile-safe API access boundary

2. Reuse shared contracts:
   - permissions
   - modules
   - entitlement semantics
   - organization and branch selection logic where portable

3. Build mobile-specific presentation on top of shared domain rules.

4. Avoid dragging over:
   - web sidebar UI
   - web SSR loaders
   - web-only navigation assumptions

### Exit Criteria

- mobile is using shared architecture, not duplicated constants
- backend auth/permission behavior is consistent across platforms

---

## Phase 6 - Hardening and Enterprise Readiness

### Goal

Move from “it works in a monorepo” to “it is safe to scale and maintain as a production system.”

### Deliverables

- documented package ownership
- verification workflow for backend contract drift
- security review of shared backend/auth setup
- release checklist for future extractions

### Detailed Tasks

1. Add architecture ownership notes:
   - what belongs in apps
   - what belongs in packages
   - how to decide when new code is shared

2. Add Supabase contract verification workflow:
   - compare shared permission/module constants against live backend
   - verify generated types refresh flow
   - define how RPC/table changes are propagated

3. Review security:
   - isolate service-role usage
   - review auth settings
   - improve password security
   - define MFA roadmap
   - verify redirect policies and auth edge function assumptions

4. Add rollback/change-control notes for risky extractions.

### Exit Criteria

- the shared architecture is governable
- contract drift is detectable
- backend usage is safer for multi-app production

---

## 9. Extraction Priority Matrix

### Extract Early

- tooling configs
- canonical constants
- shared contract types
- auth claim parsing
- pure permission logic
- generated Supabase types
- shared Zod schemas that are business contracts

### Extract Later

- domain services with app-specific data access
- UI primitives
- i18n abstractions
- shared API/query client wrappers

### Keep App-Local for the Foreseeable Future

- Next.js SSR cookie client
- route handlers
- server actions
- Expo-specific session storage logic
- web-only UI/navigation composition

---

## 10. Risks and How to Avoid Them

### Risk 1 - Packaging Web Coupling

If code that depends on Next.js is moved into a “shared” package too early, that package becomes fake-shared and blocks mobile progress.

Mitigation:

- enforce no `next/*` imports in platform-neutral packages
- keep runtime adapters local to each app

### Risk 2 - Drift Between Shared Constants and Live Backend

If the repo extracts current constants without checking the live database, mobile and web can both end up sharing the wrong contract.

Mitigation:

- verify contracts against `supabase-target`
- document all mismatches before normalizing them

### Risk 3 - Service-Role Leakage

If service-role helpers are moved into a shared package used by app runtimes, the architecture can become unsafe and confusing.

Mitigation:

- isolate service-role clients to server-only, explicitly privileged layers
- do not expose them through general shared packages

### Risk 4 - Over-Extraction Too Early

Trying to build the final architecture in one pass will likely break the working web app and slow mobile progress.

Mitigation:

- use PR-sized extractions
- preserve web runtime behavior at every phase
- move stable contracts before moving orchestration logic

---

## 11. Definition of Done for the Overall Initiative

The extraction initiative should be considered successful when:

- web and mobile share canonical contracts instead of duplicating them
- Supabase types and auth semantics are centralized cleanly
- pure business logic is framework-agnostic and reusable
- web-specific and mobile-specific runtime code remains separated
- the backend remains the single source of truth for permissions, modules, and entitlements
- service-role usage is isolated and auditable
- the repository has clear rules for what belongs in apps vs packages
- new mobile development can proceed on shared architecture without destabilizing production web

---

## 12. Recommended Working Process

For each extraction slice:

1. identify one narrow extraction target,
2. verify whether it is truly platform-agnostic,
3. compare any backend contracts against `supabase-target`,
4. extract with minimal runtime behavior changes,
5. update imports,
6. add or move tests,
7. verify web still works,
8. only then move to the next slice.

This should be executed as a sequence of small, reviewable steps, not one big migration.

---

## 13. Initial Recommended Extraction Order

This is the recommended implementation sequence for the next several iterations:

1. shared monorepo tooling foundation
2. canonical contracts package
3. shared auth package
4. shared Supabase contract package
5. shared testing helpers
6. shared domain package for permissions/entitlements/org context rules
7. mobile Supabase adapter and first shared mobile integrations

This order keeps the current working web app safe while creating the backbone that the mobile app actually needs.
