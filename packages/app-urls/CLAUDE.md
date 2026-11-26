# @repo/app-urls — Package Boundary Rules

**Single responsibility:** where each Ambra app lives, how they share one sign-in, and
which return addresses a sign-in may send a user back to. Pure functions over env vars.

## Model

- One registrable domain, one subdomain per app: `ambra-system.com` (public site),
  `app.` (ERP, also the only sign-in page), `zgloszenia.`, `vmi.`.
- One Supabase session for all of them: the auth cookie is named `AUTH_COOKIE_NAME` and,
  in production, set on `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` (`.ambra-system.com`), so every
  subdomain reads the same session.
- An app without a session sends the user to `buildSignInUrl(<where they were>)`; the
  ERP sign-in sends them back only if `resolveReturnUrl` accepts the address.
- After sign-in the ERP shows the app chooser (`buildAppChooserUrl`). `decideLanding` picks
  what it does: no app, open the only one (or the last one if the user ticked "open my last
  app"), or let them choose. Which apps a user may open comes from the database rule
  `get_my_ambra_apps` (plan module AND permission), never from this package.
- `LAST_APP_COOKIE` (set by each app's proxy) and `OPEN_LAST_APP_COOKIE` are shared across
  the subdomains with `getSharedCookieOptions()`.

## Allowed

- Reading `NEXT_PUBLIC_*` env vars **by literal property access** (`process.env.NEXT_PUBLIC_X`),
  so Next.js can inline them into browser bundles.
- URL building and validation.

## Not Allowed

- Next.js, Supabase or React imports. Each app passes `getAuthCookieOptions()` to its own
  `createServerClient` / `createBrowserClient`.
