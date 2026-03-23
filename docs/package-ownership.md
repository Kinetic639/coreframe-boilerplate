# Package Ownership and Architectural Boundaries

This document defines what belongs in each shared package, what is explicitly excluded,
and the decision rules for placing new code in the monorepo.

---

## The Three-Tier Boundary

```
packages/          — platform-neutral, no runtime deps on Next.js or Expo
apps/*/lib or      — platform-specific adapters (Supabase client per app,
apps/*/utils         session adapters, storage strategies)
apps/*/src         — app business logic, server actions, routes, UI
```

**A piece of code belongs in a shared package only if:**

1. It has no import from `next/*`, `expo-*`, or any Supabase client runtime.
2. It is — or is clearly going to be — used by more than one app.
3. It is a pure function, a type definition, or a factory builder with no I/O.

**Keep it app-local if:**

- It does database queries, HTTP calls, or cookie access.
- It depends on Next.js middleware, server components, or server actions infrastructure.
- It depends on Expo native modules (`expo-secure-store`, `expo-router`, etc.).
- It is only needed by one app and there is no concrete plan for the other.

---

## Package Inventory

### `@repo/contracts`

**Purpose:** TypeScript constants and type definitions that reflect backend database contracts.

**Owns:**

- Permission slug constants — must match `slug` column in `permissions` table
- Module slug constants — must match `enabled_modules` values in DB
- Shared interfaces: `PermissionSnapshot`, `TokenRole`, `RoleValidationOptions`
- Entitlement types: `OrganizationEntitlements`, `AdminEntitlement`

**Does not own:**

- Runtime functions
- Supabase client imports
- Next.js or Expo imports
- Any code requiring a running server or browser

**Consumers:** `apps/web`, `apps/mobile`, `@repo/auth`, `@repo/domain`, `@repo/testing`

**Key constraint:** Never add a constant for a permission slug that does not exist in the
target database migrations. Always verify against `MISMATCHES.md` first.
See `change-control.md` before adding or changing any constant.

---

### `@repo/auth`

**Purpose:** Pure JWT token parsing utilities with no side effects and no runtime dependencies.

**Owns:**

- `AuthService` — static methods: `getUserRoles`, `hasRole`, `getUserOrganizations`, `getUserBranches`
- Role normalization between target token shape (`app_metadata.roles`) and legacy shape (`claims.roles`)

**Does not own:**

- Supabase client creation or session management
- Cookie access, browser storage, or device-specific storage APIs
- Auth state (sessions, token refresh, login/logout flows)
- Next.js imports (`next/*`)
- Expo imports (`expo-*`)

**Consumers:** `apps/web` (SSR loaders, middleware), `apps/mobile` (AppContext role derivation)

**Note on legacy fallback:** The dual decode path must remain until the legacy JWT hook is
retired. Do not remove the legacy path without a coordinated schema and hook migration.

---

### `@repo/domain`

**Purpose:** Pure business logic functions implementing domain rules shared across platforms.

**Owns:**

- Permission matching: `checkPermission`, `matchesAnyPattern`, `clearPermissionRegexCache`
- Organization domain: member grouping, branch-member association
- Event domain: visibility rules, scope classification
- Type re-exports from `@repo/contracts` for consumer convenience

**Does not own:**

- Database queries or ORM calls
- HTTP requests
- Supabase client imports
- Next.js or Expo imports
- Stateful services — those belong in `apps/web/src/server/services/`
- UI components

**Consumers:** `apps/web` (service layer, server actions), `apps/mobile` (Phase 6 permission checks)

**Critical pattern:** Domain functions receive data (e.g., `PermissionSnapshot`) as parameters.
They never fetch it. Data fetching always stays in the app layer.

---

### `@repo/supabase`

**Purpose:** Generated Supabase database types and platform-neutral client configuration interfaces.

**Owns:**

- `Database` — generated TypeScript types from the Supabase schema (`supabase gen types`)
- `SupabaseClientConfig` — `{ url, anonKey }` — safe for browser and mobile runtimes
- `SupabaseServiceConfig` — `{ url, serviceRoleKey }` — interface only, documented as server-only

**Does not own:**

- Actual Supabase client creation (`createClient`, `createServerClient`, etc.)
- Cookie-based session adapters
- Service-role runtime code
- Next.js or Expo imports

**Consumers:** `apps/web` (all four Supabase clients), `apps/mobile` (client config interface),
other `@repo/*` packages that reference generated DB types

**CRITICAL:** `SupabaseServiceConfig` is an interface boundary — never add a service-role
client implementation to this package. The service-role client must remain app-local at
`apps/web/src/utils/supabase/service.ts` (server-only, never imported from any shared package).

**Type regeneration:** Run `supabase gen types typescript --project-id <ref>` from `apps/web/`,
then update `packages/supabase/src/database.types.ts`. See `change-control.md`.

---

### `@repo/testing`

**Purpose:** Test data factories and builders for shared types. No assertion helpers.

**Owns:**

- Factory functions that build test instances of shared types:
  `PermissionSnapshot`, `TokenRole`, `OrganizationEntitlements`, event payloads, org structures
- Builder patterns for composing test data

**Does not own:**

- Assertion helpers or custom test matchers (belong in app test utilities)
- Supabase client mocks or RLS integration test infrastructure (belong in `apps/web`)
- Next.js or Expo test utilities
- Vitest or Jest configuration (goes in each app's `vitest.config.ts`)
- Any import that requires a live runtime

**Consumers:** `apps/web` test suites, `apps/mobile` test suites (Phase 6+)

---

### Tooling Packages

These packages contain no runtime business logic. Their purpose is self-evident.

| Package                   | Purpose                             | Consumers                |
| ------------------------- | ----------------------------------- | ------------------------ |
| `@repo/eslint-config`     | Shared ESLint presets               | All apps and packages    |
| `@repo/typescript-config` | Shared `tsconfig.json` bases        | All apps and packages    |
| `@repo/ui`                | Shared cross-platform UI components | `apps/mobile` (Phase 6+) |
| `@repo/ui-web`            | Web-specific UI components          | `apps/web`               |

---

## Decision Flowchart for New Code

```
Is this code used (or clearly going to be used) by more than one app?
  No  → keep it app-local
  Yes → does it import from next/*, expo-*, or Supabase client runtime?
          Yes → keep it app-local (create a platform-specific adapter per app)
          No  → does it perform I/O (DB queries, HTTP, cookies, storage)?
                  Yes → keep it app-local
                  No  → candidate for a shared package
                        → pick the most specific package that fits (contracts → auth → domain → supabase → testing)
                        → if nothing fits, discuss before creating a new package
```

---

## What Stays App-Local Forever

The following categories must never move into shared packages:

- **Next.js Supabase clients** — `apps/web/src/utils/supabase/` (browser, server, service-role, proxy/middleware)
- **Service-role clients** — app-local, never shared; bypass RLS and must remain server-only
- **Server actions** — Next.js-specific, cannot be platform-neutral
- **Route handlers** — Next.js-specific
- **SSR loaders** — Next.js-specific
- **Expo session storage** — device-specific (SecureStore, AsyncStorage)
- **Mobile auth bootstrap** — Expo Router-specific
- **Web-only UI composition** — sidebar, layout shells, navigation

---

## Adding a New Shared Package

Before creating a new package:

1. Verify it has at least two concrete consumers (web + mobile, or a clear near-term plan).
2. Confirm it has no `next/*` or `expo-*` imports.
3. Add it to this document under the Package Inventory section.
4. Add a `CLAUDE.md` in the package root with boundary rules.
5. Follow the checklist in `change-control.md`.
