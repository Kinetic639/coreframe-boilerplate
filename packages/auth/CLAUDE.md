# @repo/auth — Package Boundary Rules

**Single responsibility:** Pure JWT token parsing utilities with no side effects and no
runtime dependencies on Next.js, Expo, or any Supabase client library.

## Allowed

- Static methods for decoding JWT access tokens (via `jwtDecode`)
- Role normalization between target token shape (`app_metadata.roles`) and legacy shape (`claims.roles`)
- Pure utility functions: input is a string (JWT), output is typed values (`TokenRole[]`, `boolean`, `string[]`)

## Not Allowed

- Supabase client creation or any `@supabase/supabase-js` runtime imports
- Session management (storage, retrieval, refresh)
- Cookie access, browser storage, or device-specific storage (`SecureStore`, `AsyncStorage`)
- Next.js imports (`next/*`, `@supabase/ssr`)
- Expo imports (`expo-*`)
- Auth state management — that belongs in each app's context/provider layer

## Note on the Legacy Fallback Path

`AuthService.getUserRoles` has a dual decode path (target `app_metadata.roles` + legacy `claims.roles`).
This fallback must remain until the legacy JWT hook is retired. Do not remove it without a
coordinated schema migration and confirmation that all issued tokens use the target shape.

## Consumers

`apps/web` (SSR loaders, middleware), `apps/mobile` (AppContext role derivation)

See `docs/package-ownership.md` for the full decision framework.
