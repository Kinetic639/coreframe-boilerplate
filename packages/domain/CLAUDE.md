# @repo/domain — Package Boundary Rules

**Single responsibility:** Pure business logic functions implementing domain rules that are
shared across web and mobile platforms.

## Allowed

- Permission matching functions: `checkPermission`, `matchesAnyPattern`, `clearPermissionRegexCache`
- Organization domain logic: member grouping, branch-member association (pure functions over data structures)
- Event domain logic: visibility rules, scope classification (pure functions)
- Type re-exports from `@repo/contracts` for consumer convenience

## Not Allowed

- Database queries or ORM calls
- HTTP requests
- Supabase client imports (`@supabase/supabase-js`, `@supabase/ssr`)
- Next.js imports (`next/*`)
- Expo imports (`expo-*`)
- Stateful services (caching layers, pub/sub) — those belong in `apps/web/src/server/services/`
- UI components

## Critical Pattern: Data Flows In, Never Out

Domain functions receive data as parameters (e.g., `PermissionSnapshot`, `TokenRole[]`).
They never fetch it. Data fetching always stays in the app layer (server actions,
SSR loaders, mobile context providers).

If you find yourself wanting to add a Supabase call here, that logic belongs in
`apps/web/src/server/services/` instead.

## Consumers

`apps/web` (service layer, server actions), `apps/mobile` (Phase 6 permission checks)

See `docs/package-ownership.md` for the full decision framework.
