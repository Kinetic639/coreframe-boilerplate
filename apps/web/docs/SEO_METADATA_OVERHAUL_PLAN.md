# SEO Metadata Overhaul — apps/web (Ambra)

## Context

`apps/web` is the public-facing Ambra site/marketplace (Next.js App Router + next-intl, locales `pl`/`en`, `pl` default with no prefix). A metadata helper already exists at `src/lib/metadata.ts` (`generatePageMetadata` / `generateDashboardMetadata` / `generatePublicMetadata`) and a `metadata.*` translation namespace already exists in `messages/en.json` / `messages/pl.json`. Home, pricing, and features pages already use it correctly. Gaps: several pages bypass the helper with ad-hoc/missing metadata, a public dynamic page (`maps/[branchId]`) has zero metadata, there's no `sitemap.ts`/`robots.ts`/`manifest.ts`, and no Open Graph image is wired up.

Scope: **public pages + SEO infrastructure only** (per decision — dashboard/admin stay noindex at the layout level, no per-page metadata work there).

## Progress Tracker

### 1. Extend `lib/metadata.ts`

- [x] Add `alternates.canonical` + `alternates.languages` (hreflang) built from `routing.pathnames` (shared helper extracted to `src/i18n/localized-pathnames.ts`)
- [x] Add optional per-page `image` override for OG/Twitter — **correction**: a proper 1200×600 `opengraph-image.png`/`twitter-image.png` already exists at `src/app/[locale]/` and is picked up automatically by Next.js's file-convention fallback for every page that doesn't override it, so the helper no longer forces a hardcoded default image (an earlier version of this pass wrongly overrode that with a random showcase photo — reverted)
- [x] Added `generateAuthMetadata` helper (noindex, no OG — auth forms aren't share-worthy)

### 2. Wire up public pages through the helper

- [x] `(public)/tools/svwms-wdd-matcher/page.tsx` → `generatePublicMetadata`
- [x] `(public)/maps/[branchId]/page.tsx` → added `generateMetadata` with per-branch title/description (lightweight branch-name lookup, not the full bundle)
- [x] `sign-in`, `sign-up`, `forgot-password`, `reset-password` → `generateAuthMetadata` (noindex, OG off); `reset-password` previously had **no metadata at all**
- [x] `auth-code-error/page.tsx` → fixed missing `locale` param bug + noindex metadata
- [x] `registration-disabled/page.tsx` → noindex metadata via helper

### 3. New SEO infra route files

- [x] `src/app/sitemap.ts` (static public routes + dynamic public branch-map entries)
- [x] `src/app/robots.ts` (disallows dashboard/admin/auth/onboarding/invite/qr in both locale slugs)
- [x] `src/app/manifest.ts`

### 4. Translations (en.json + pl.json)

- [x] `metadata.public.tools.svwmsWddMatcher`
- [x] `metadata.public.maps` (interpolated `{branchName}`)
- [x] `metadata.auth.authCodeError`, `metadata.auth.registrationDisabled`, `metadata.auth.resetPassword`
- [x] Removed the unused leftover `Manifest: { name: "next-intl example" }` boilerplate key (confirmed unreferenced anywhere in code; `manifest.ts` is locale-agnostic and static instead)

### 5. Dashboard/admin noindex

- [x] Admin layout: added `robots: { index: false, follow: false }`
- [x] Dashboard layout: **had no metadata export at all** (real gap beyond admin) — added the same layout-level `robots: noindex`

### 6. Verification

- [x] `pnpm --filter web type-check` (clean)
- [x] `pnpm --filter web lint` (0 errors; only pre-existing unrelated warnings)
- [x] Manual check: public pages in en + pl (title, description, OG, canonical, hreflang via view-source) — verified `/pricing`, `/en/pricing`, `/maps/[branchId]` with a real branch
- [x] Manual check: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` — all 200, correct content-type, correct bodies
- [x] Manual check: dashboard/admin pages still noindex — confirmed `noindex, nofollow` on both
- [x] `pnpm --filter web build` (succeeded; sitemap/robots/manifest all statically generated)

**Bug found and fixed during verification**: `src/proxy.ts`'s middleware matcher excluded `api`, `auth`, `_next`, `favicon.ico`, and image extensions, but not `robots.txt`/`sitemap.xml`/`manifest.webmanifest`. next-intl's middleware was rewriting those to `/pl/robots.txt` etc., which fell into the `[locale]/[...rest]` catch-all instead of the new root route handlers — `/robots.txt` was silently serving the homepage HTML. Fixed by adding those three filenames to the negative-lookahead in the matcher regex.
