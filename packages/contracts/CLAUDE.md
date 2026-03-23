# @repo/contracts — Package Boundary Rules

**Single responsibility:** TypeScript constants and type definitions that reflect backend
database contracts. No runtime logic.

## Allowed

- Permission slug constants — must match `slug` column in `permissions` table
- Module slug constants — must match `enabled_modules` values in `subscription_plans` and `organization_entitlements`
- Shared interfaces and types: `PermissionSnapshot`, `TokenRole`, `RoleValidationOptions`, `OrganizationEntitlements`, `AdminEntitlement`

## Not Allowed

- Runtime functions that call APIs or databases
- Supabase client imports (`@supabase/supabase-js`)
- Next.js imports (`next/*`)
- Expo imports (`expo-*`)
- Anything that requires a running server, browser, or device

## Before Adding a Permission Constant

1. Confirm the slug exists in `apps/web/supabase-target/supabase/migrations/`
2. Check `MISMATCHES.md` — if the slug is already documented as a known gap, note it there
3. Do NOT add constants for slugs that are not yet seeded in the target database

## Before Changing a Type

1. Check all consumers: `apps/web`, `apps/mobile`, `@repo/auth`, `@repo/domain`, `@repo/testing`
2. Run `check-types` across all affected packages and apps
3. Follow the checklist in `docs/change-control.md`

## Consumers

`apps/web`, `apps/mobile`, `@repo/auth`, `@repo/domain`, `@repo/testing`

See `docs/package-ownership.md` for the full decision framework.
See `docs/change-control.md` before adding or modifying any constant or type.
