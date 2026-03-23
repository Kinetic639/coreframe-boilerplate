# @repo/supabase — Package Boundary Rules

**Single responsibility:** Generated Supabase database types and platform-neutral client
configuration interfaces. No client creation, no runtime I/O.

## Allowed

- `Database` — generated TypeScript types from `supabase gen types typescript`
- `SupabaseClientConfig` — `{ url, anonKey }` — safe for browser and mobile runtimes
- `SupabaseServiceConfig` — `{ url, serviceRoleKey }` — interface only, documented as server-only

## Not Allowed

- Actual Supabase client creation (`createClient`, `createServerClient`, `createBrowserClient`, etc.)
- Cookie-based session adapters
- Service-role runtime code of any kind
- Next.js imports (`next/*`, `@supabase/ssr`)
- Expo imports (`expo-*`)
- HTTP requests or network calls

## CRITICAL: Service-Role Boundary

`SupabaseServiceConfig` is an interface that documents the shape of service-role configuration.
It must never become an implementation. The service-role client that bypasses RLS must remain
app-local at `apps/web/src/utils/supabase/service.ts` and must never be imported from any
shared package or mobile app.

If you find yourself wanting to create a `createServiceClient` function in this package,
that is incorrect — keep it in `apps/web/src/utils/supabase/service.ts`.

## Type Regeneration

When the Supabase schema changes:

1. Run: `supabase gen types typescript --project-id <ref> > packages/supabase/src/database.types.ts`
   (from `apps/web/` with an authenticated Supabase CLI)
2. Run `check-types` on all consumers: `apps/web`, `apps/mobile`, `@repo/domain`
3. Follow the full checklist in `docs/change-control.md`

## Consumers

`apps/web` (browser, server, service-role, and proxy clients), `apps/mobile` (client config),
`@repo/domain`, `@repo/auth`, `apps/web` server services (via `Database` types)

See `docs/package-ownership.md` for the full decision framework.
