# @repo/testing — Package Boundary Rules

**Single responsibility:** Test data factories and builder functions for shared types.
No assertion helpers, no mocks, no app-specific test infrastructure.

## Allowed

- Factory functions that construct test instances of shared types:
  `PermissionSnapshot`, `TokenRole`, `OrganizationEntitlements`, event payloads, org structures
- Builder patterns for composing complex test data from shared domain types
- Pure data construction — no I/O, no assertions, no network calls

## Not Allowed

- Assertion helpers or custom matchers (those belong in each app's test utilities)
- Supabase client mocks or RLS integration test infrastructure (belong in `apps/web`)
- Next.js or Expo test utilities (`@testing-library/react`, server-action test helpers, etc.)
- Vitest or Jest configuration — goes in each app's own `vitest.config.ts`
- Any import that requires a live runtime or environment (process.env reads, etc.)
- App-specific fixtures that depend on `apps/web` database schemas or route structure

## What This Package Is Not

The name `@repo/testing` might imply general-purpose test infrastructure.
It is specifically for **shared type factories**. It has no assertion logic
and does not configure test runners.

## Consumers

`apps/web` test suites, `apps/mobile` test suites (Phase 6+)

See `docs/package-ownership.md` for the full decision framework.
