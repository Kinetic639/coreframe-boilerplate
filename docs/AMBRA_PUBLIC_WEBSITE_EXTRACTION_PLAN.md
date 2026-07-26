# Ambra Public Website Extraction Plan

## Progress Tracker

- [x] Audit and classify current public, auth, and app-only routes
- [x] Create new `apps/public-web` Next.js app in the Turborepo
- [x] Move Ambra ERP public marketing pages into `apps/public-web`
- [x] Move VMI public marketplace/marketing pages into `apps/public-web`
- [x] Keep ERP auth/app routes on `app.ambra-system.com` and remove/redirect any copied auth routes from `public-web`
- [x] Keep VMI auth/app routes on `vmi.ambra-system.com`
- [x] Review shared public UI/content/data helpers and keep copied VMI marketplace code app-local for v1
- [x] Add domain-aware redirects and canonical SEO metadata
- [x] Add accessibility, performance, SEO, and route validation
- [x] Connect public website deployment to `ambra-system.com` / `www.ambra-system.com`

## Summary

Create a new Turborepo web app at `apps/public-web` that serves the public marketing website for Ambra System on `ambra-system.com` and `www.ambra-system.com`.

The existing apps remain product surfaces:

- `apps/web` becomes the authenticated Ambra ERP app for `app.ambra-system.com`
- `apps/vmi-client` remains the authenticated VMI client app for `vmi.ambra-system.com`
- `apps/mobile` remains the Ambra mobile app

Use the new public website for marketing, product information, SEO landing pages, VMI public discovery pages, and routing users to the correct auth surface.

VMI public marketplace decision:

- Vendor search, vendor detail pages, product search, product detail pages, flyers, and filterable marketplace result pages are public discovery/acquisition surfaces.
- These pages belong on `www.ambra-system.com/vmi/...` because they are browse-before-login content with SEO value.
- `vmi.ambra-system.com` remains the VMI app surface for login and authenticated workflows such as portal dashboard, inventory, orders, proposals, messages, settings, stock counts, and partner panels.
- Public marketplace CTAs must send users to `https://vmi.ambra-system.com/sign-in` or `https://vmi.ambra-system.com/portal` when the action becomes authenticated.

Current implementation checkpoint:

- `apps/public-web` is scaffolded as a Next.js app inside the Turborepo.
- Ambra main app public route tree was copied from `apps/web/src/app/[locale]/(public)` into `apps/public-web/src/app/[locale]/(public)`.
- Shared Ambra source required by those copied public routes was copied from `apps/web` into `apps/public-web` without creating replacement UI.
- `public-web` dependencies, TypeScript aliases, public assets, messages, Supabase generated types, and Next.js config were aligned with `apps/web`.
- Ambra's root routing layer was copied via `apps/public-web/src/proxy.ts`, plus root metadata routes (`manifest.ts`, `robots.ts`, `sitemap.ts`) so unprefixed public URLs resolve through the same locale routing as `apps/web`.
- VMI public marketplace routes were copied from `apps/vmi-client` into `apps/public-web/src/app/[locale]/(public)/vmi`.
- VMI public marketplace components, public marketplace repository/types/schemas/prototype data, and public API routes were copied into `apps/public-web`.
- Copied VMI marketplace links were namespaced under `/vmi`, and app workflow CTAs point to `https://vmi.ambra-system.com`.
- The existing `public-web` header/footer were refactored to include both Ambra and VMI public navigation without replacing them.
- The broad public auth entry in `public-web` was changed to a single animated `Logowanie` dropdown with Ambra ERP and VMI portal choices.
- Logo/branding links in the public headers for `apps/web` and `apps/vmi-client` were pointed to `https://www.ambra-system.com`.
- `pnpm --filter public-web check-types` passes.
- `pnpm --filter public-web build` passes when the same Supabase env values used by `apps/web` are available to the process.
- `pnpm --filter web check-types` and `pnpm --filter vmi-client check-types` pass after the header/branding domain changes.
- Initial Vercel/domain wiring has been completed outside the repo by the project owner: `www.ambra-system.com` for public web, `app.ambra-system.com` for Ambra ERP, and `vmi.ambra-system.com` for VMI.
- Copied Ambra auth route files and orphaned auth form components were removed from `apps/public-web`.
- `apps/public-web` redirects auth/app-owned paths to `https://app.ambra-system.com`.
- `apps/web` redirects old public marketing paths to `https://www.ambra-system.com`.
- `apps/vmi-client` redirects old public marketplace paths to `https://www.ambra-system.com/vmi/...`, while keeping VMI app/auth routes on the VMI subdomain.
- `apps/public-web` metadata, robots, and sitemap now use `NEXT_PUBLIC_SITE_URL` with `https://www.ambra-system.com` as the fallback canonical host.
- The sitemap includes Ambra public routes, VMI marketplace list routes, VMI vendor detail routes, VMI product detail routes, VMI flyer detail routes, and public warehouse maps when enabled.
- VMI marketplace pages now define canonical/OpenGraph metadata using copied marketplace data.
- VMI marketplace code remains app-local inside `apps/public-web` for v1; extracting another shared package is intentionally deferred until more than one app imports that code.
- `pnpm --filter public-web lint` passes with warnings from copied Ambra code.
- Built-route smoke validation passed for `/`, `/features`, `/pricing`, `/vmi`, `/vmi/vendors`, `/vmi/products`, known vendor detail, known product detail, known flyer detail, `/robots.txt`, `/sitemap.xml`, `/sign-in`, and `/dashboard/start`.
- `pnpm --filter web build` and `pnpm --filter vmi-client build` pass after the redirect changes.
- Redirect smoke validation confirmed `apps/web` public marketing routes resolve to `https://www.ambra-system.com/...` and `apps/vmi-client` public marketplace routes resolve to `https://www.ambra-system.com/vmi/...`.
- Original Ambra public marketing route folders were removed from `apps/web`; ERP auth, onboarding, invite, QR, dashboard, and admin routes remain in `apps/web`.
- Original VMI public marketplace pages, public marketplace components, public marketplace library code, and public API routes were removed from `apps/vmi-client`; VMI sign-in, portal, inventory, orders, proposals, messages, settings, and stock-count routes remain in `apps/vmi-client`.
- `pnpm --filter web check-types`, `pnpm --filter vmi-client check-types`, and `pnpm --filter public-web check-types` pass after removing the old source.
- `pnpm --filter web build`, `pnpm --filter vmi-client build`, and `pnpm --filter public-web build` pass after removing the old source.

Default decisions:

- Use `apps/public-web` as the new app name
- Use Next.js App Router, matching the existing repo stack
- Keep Polish as default locale and English as alternate locale
- Put VMI public pages under `/vmi`, for example `/vmi/vendors`, `/vmi/products`, `/vmi/flyers/[slug]`
- Link ERP auth to `https://app.ambra-system.com`
- Link VMI auth to `https://vmi.ambra-system.com/sign-in`

## Route Extraction

Move these Ambra ERP public pages from `apps/web` into `apps/public-web`:

- Home page from `apps/web/src/app/[locale]/(public)/(home-page)/page.tsx`
- Features page from `apps/web/src/app/[locale]/(public)/features/page.tsx`
- Pricing page from `apps/web/src/app/[locale]/(public)/pricing/page.tsx`
- Public WDD matcher marketing/tool entry from `apps/web/src/app/[locale]/(public)/tools/svwms-wdd-matcher/page.tsx`
- Public warehouse maps from `apps/web/src/app/[locale]/(public)/maps/[branchId]/page.tsx`, only if still intended to be publicly indexed

Do not move Ambra ERP auth, invite, onboarding, dashboard, QR assignment, or admin pages into the marketing app. Those stay in `apps/web`.

Move these VMI public pages from `apps/vmi-client` into `apps/public-web` under `/vmi`:

- `/` marketplace home becomes `/vmi`
- `/vendors` becomes `/vmi/vendors`
- `/vendors/[slug]` becomes `/vmi/vendors/[slug]`
- `/products` becomes `/vmi/products`
- `/products/[slug]` becomes `/vmi/products/[slug]`
- `/flyers/[slug]` becomes `/vmi/flyers/[slug]`
- Search/filter states remain public on the same pages, for example `/vmi/vendors?category=...`, `/vmi/vendors?query=...`, `/vmi/products?brand=...`, and `/vmi/products?city=...`

Do not move VMI app/portal pages such as inventory, orders, stock counts, settings, messages, proposals, or `/portal/*`. Those stay in `apps/vmi-client`.

## VMI Domain Boundary

Use this boundary when moving VMI pages:

- `www.ambra-system.com/vmi/*` is public marketplace/discovery content: marketplace home, vendor search, vendor profiles, product search, product details, flyers, public catalog discovery, and SEO-friendly filter result pages.
- `vmi.ambra-system.com/*` is the VMI app: sign-in, portal dashboard, inventory, orders, proposals, messages, settings, stock counts, partner vendor panels, and all client-specific workflows.
- Public marketplace links must stay inside `/vmi/...` when they point to other public marketplace pages.
- Authenticated workflow links and CTAs must use absolute VMI app URLs, for example `https://vmi.ambra-system.com/sign-in`, `https://vmi.ambra-system.com/portal`, or the relevant authenticated VMI route.
- The public website must not expose app-only VMI routes such as `/vmi/inventory`, `/vmi/orders`, `/vmi/settings`, `/vmi/messages`, `/vmi/proposals`, `/vmi/stock-counts`, or `/vmi/portal/*`.

## Detailed Extraction Inventory

This extraction must move existing pages/components/code. Do not create replacement marketing pages or new UI components during extraction.

### Main Ambra App Public Pages To Extract

Move from `apps/web/src/app/[locale]/(public)` into `apps/public-web/src/app/[locale]/(public)` first, preserving route group structure:

- `(public)/layout.tsx`
- `(public)/loading.tsx`
- `(public)/(home-page)/page.tsx`
- `(public)/(home-page)/_components/*`
- `(public)/features/page.tsx`
- `(public)/features/features-client.tsx`
- `(public)/pricing/page.tsx`
- `(public)/pricing/pricing.tsx`
- `(public)/tools/svwms-wdd-matcher/page.tsx`
- `(public)/maps/layout.tsx`
- `(public)/maps/[branchId]/page.tsx`
- `(public)/maps/[branchId]/_components/*`

Keep these auth-related public-group pages in `apps/web`; do not extract them to the marketing/public website:

- `(public)/(auth)/sign-in/page.tsx`
- `(public)/(auth)/sign-up/page.tsx`
- `(public)/(auth)/forgot-password/page.tsx`
- `(public)/(auth)/reset-password/page.tsx`
- `(public)/(auth)/auth-code-error/page.tsx`
- `(public)/(auth)/registration-disabled/page.tsx`
- `(public)/(auth)/layout.tsx`
- `(public)/(auth)/smtp-message.tsx`

Reason: auth screens must live on `app.ambra-system.com`, while `ambra-system.com` should only route users to the correct app/auth subdomain.

### VMI Client Public Pages To Extract

Move from `apps/vmi-client` into `apps/public-web`, namespaced under `/vmi`:

- `src/app/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/page.tsx`
- `src/app/vendors/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/vendors/page.tsx`
- `src/app/vendors/[slug]/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/vendors/[slug]/page.tsx`
- `src/app/products/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/products/page.tsx`
- `src/app/products/[slug]/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/products/[slug]/page.tsx`
- `src/app/flyers/[slug]/page.tsx` -> `apps/public-web/src/app/[locale]/(public)/vmi/flyers/[slug]/page.tsx`

Preserve these public VMI query/search behaviors after namespacing:

- `/vendors?query=...` -> `/vmi/vendors?query=...`
- `/vendors?category=...` -> `/vmi/vendors?category=...`
- `/vendors?view=map` -> `/vmi/vendors?view=map`
- `/products?query=...` -> `/vmi/products?query=...`
- `/products?brand=...` -> `/vmi/products?brand=...`
- `/products?city=...` -> `/vmi/products?city=...`
- `/products?category=...` -> `/vmi/products?category=...`

Reason for moving these search/detail pages: they are public vendor/product discovery content, not authenticated VMI workflow screens. They help users evaluate suppliers and products before login, and they should contribute SEO value to the public Ambra domain.

Move the VMI public API routes with the same API path unless a later step intentionally rewrites the VMI frontend to call local server functions:

- `src/app/api/public/marketplace/route.ts`
- `src/app/api/public/categories/route.ts`
- `src/app/api/public/suppliers/route.ts`
- `src/app/api/public/suppliers/[slug]/route.ts`
- `src/app/api/public/products/route.ts`
- `src/app/api/public/products/[slug]/route.ts`
- `src/app/api/public/catalogs/route.ts`
- `src/app/api/public/catalogs/[id]/route.ts`
- `src/app/api/public/promotions/route.ts`
- `src/app/api/public/flyers/route.ts`
- `src/app/api/public/flyers/[slug]/route.ts`
- `src/app/api/public/partnership-requests/route.ts`
- `src/app/api/public/quotation-requests/route.ts`

Do not extract VMI authenticated/app routes:

- `src/app/sign-in/page.tsx`
- `src/app/portal/**`
- `src/app/inventory/page.tsx`
- `src/app/orders/page.tsx`
- `src/app/stock-counts/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/messages/page.tsx`
- `src/app/proposals/page.tsx`
- `src/app/api/portal/**`

Do not create replacement VMI marketing pages during this extraction. Move existing VMI public marketplace pages/components first, then only adjust links and route paths required by the `/vmi` namespace and domain split.

### Main Ambra Dependencies To Move With Public Pages

Copy existing code that the extracted Ambra public pages already import. Prefer copying first, then only pruning app-bound code after validation.

Public layout/header/footer/theme dependencies:

- `apps/web/src/components/AnnouncementBanner.tsx`
- `apps/web/src/components/footer.tsx`
- `apps/web/src/components/Header/*`
- `apps/web/src/components/public-theme-enforcer.tsx`
- `apps/web/src/components/LocaleSwitcher.tsx`
- `apps/web/src/components/LocaleSwitcherSelect.tsx`
- `apps/web/src/components/theme-switcher.tsx`
- `apps/web/src/server/services/site-settings.service.ts`
- `apps/web/src/utils/supabase/service.ts`

Branding dependencies:

- `apps/web/src/components/branding/*`
- `apps/web/public/branding/ambra-crystal-floating.svg`
- Any other `apps/web/public/branding/*` files referenced by copied components

i18n and metadata dependencies:

- `apps/web/messages/en.json`
- `apps/web/messages/pl.json`
- Any message namespace files referenced by copied components
- `apps/web/src/i18n/routing.ts`
- `apps/web/src/i18n/navigation.ts`
- `apps/web/src/i18n/request.ts`
- `apps/web/src/i18n/localized-pathnames.ts`
- `apps/web/src/lib/metadata.ts`

Main app public page component dependencies:

- `apps/web/src/components/forms/FeaturesContactForm.tsx`
- `apps/web/src/components/tools/svwms-wdd-matcher/*`
- `apps/web/src/app/actions/tools/wdd-matcher-public.ts`
- WDD matcher service/parser dependencies referenced by the public matcher action
- `apps/web/src/app/actions/warehouse/public-maps.ts`
- Warehouse map viewer dependencies used by public maps:
  - `apps/web/src/components/v2/warehouse/warehouse-map-viewer.tsx`
  - `apps/web/src/components/v2/warehouse/warehouse-front-elevation-panel.tsx`
  - `apps/web/src/lib/warehouse/location-tree.ts`
  - `apps/web/src/lib/warehouse/layouts.ts`
  - `apps/web/src/lib/warehouse/map-context.ts`
  - `apps/web/src/lib/warehouse/front-elevation.ts`
  - `apps/web/src/hooks/use-css-var.ts`

UI primitives required by Ambra public pages:

- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/slider.tsx`
- `apps/web/src/components/ui/toggle-group.tsx`
- `apps/web/src/components/ui/toggle.tsx`
- `apps/web/src/components/ui/tabs.tsx`
- `apps/web/src/components/ui/tooltip.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/label.tsx`
- `apps/web/src/components/ui/progress.tsx`
- any transitive UI primitives imported by these files

Utility dependencies:

- `apps/web/src/lib/utils.ts`
- `apps/web/src/utils/index.ts`
- Supabase browser/server clients only where needed by extracted public maps/site settings

### VMI Dependencies To Move With Public Pages

Copy these existing VMI public marketplace modules:

- `apps/vmi-client/src/components/public-marketplace/*`
- `apps/vmi-client/src/lib/public-marketplace/*`
- `apps/vmi-client/src/lib/public-marketplace/prototype/*`
- `apps/vmi-client/src/utils/cn.ts`

VMI shared package dependencies already provided by `@repo/ui`:

- `@repo/ui/ambra-public-header`
- `@repo/ui/ambra-hero-background`
- `@repo/ui/public-footer`
- `@repo/ui/button`
- `@repo/ui/theme-switcher`

Adjust only route paths after copying:

- root VMI links become `/vmi`
- `/vendors/*` becomes `/vmi/vendors/*`
- `/products/*` becomes `/vmi/products/*`
- `/flyers/*` becomes `/vmi/flyers/*`
- auth/app links point to `https://vmi.ambra-system.com`

### Config, Styles, And Package Dependencies Needed

`apps/public-web` must be compatible with both Next apps and the Turborepo:

- Workspace package name: `public-web`
- Scripts: `dev -p 3002`, `dev:turbo -p 3002`, `build`, `start -p 3002`, `lint`, `check-types`, `test:run`
- `next.config.ts`:
  - `reactStrictMode: true`
  - `transpilePackages: ["@repo/ui"]`
  - Turbopack root set to monorepo root
  - image remote patterns from both apps: GitHub avatars, both Supabase hosts, `picsum.photos`
  - `allowedDevOrigins` for localhost/LAN/cloud workstation origins
  - `next-intl` plugin if localized Ambra pages are copied with `[locale]`
- `tsconfig.json`:
  - extend `@repo/typescript-config/nextjs.json`
  - aliases matching both apps: `@/*`, `@app/*`, `@components/*`, `@lib/*`, `@utils/*`
- Tailwind/PostCSS:
  - Tailwind 4 setup from VMI/global public styles
  - `@source "../../../../packages/ui/src"`
  - Ambra/VMI design tokens required by copied pages
- Root layout:
  - import global CSS
  - include providers required by copied pages: `next-intl`, `next-themes`, and `NuqsAdapter` when VMI query state is copied

`apps/public-web/package.json` must include all dependencies needed by copied pages, not just the current blank shell. Known required runtime dependencies:

- `next`, `react`, `react-dom`
- `next-intl`, `next-themes`, `nuqs`
- `@repo/ui`, `@repo/auth`, `@repo/contracts`, `@repo/supabase`
- `@supabase/ssr`, `@supabase/supabase-js`
- `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `zod`
- `framer-motion`, `gsap`
- `react-toastify`
- `@tanstack/react-query`
- `react-konva`, `konva`
- `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-dialog`, `@radix-ui/react-progress`, `@radix-ui/react-label`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-slider`, and any transitive Radix primitives copied from `apps/web/src/components/ui`

Keep heavier app-only dependencies out of `public-web` unless a copied public page directly imports them.

## Shared Code Changes

Create `apps/public-web` with:

- `next@16`, React 19, Tailwind 4, `next-intl`, `next-themes`, `nuqs`
- scripts: `dev -p 3002`, `build`, `start -p 3002`, `lint`, `check-types`, `test:run`
- `transpilePackages: ["@repo/ui"]`
- image remote patterns currently needed by public Ambra/VMI pages

Promote shared public website building blocks into `@repo/ui` or a new lightweight package only when they are reused by more than one app:

- Keep `@repo/ui/ambra-public-header`, `public-footer`, `theme-switcher`, `button`, and shared navigation primitives
- Move duplicated public header/footer configuration into public-site config files
- Extract public metadata helpers from `apps/web/src/lib/metadata.ts` into the new public app or shared helper
- Keep app-specific auth/session loaders inside their owning apps, not in public shared UI
- Keep VMI marketplace repository/types/mock data together, preferably under `apps/public-web/src/lib/vmi-marketplace` for v1 unless another app still imports them

Replace in-app public auth CTAs with external links:

- ERP login/register: `https://app.ambra-system.com/sign-in` and `https://app.ambra-system.com/sign-up`
- VMI login/register: `https://vmi.ambra-system.com/sign-in`
- Public website CTAs should offer both ERP and VMI choices where context is broad

## SEO, Accessibility, And Domain Behavior

Implement production-grade public website basics in `apps/public-web`:

- `metadataBase` set from `NEXT_PUBLIC_SITE_URL=https://ambra-system.com`
- canonical URLs for every public route
- `hreflang` alternates for `pl`, `en`, and `x-default`
- OpenGraph and Twitter metadata
- `robots.ts` and `sitemap.ts`
- structured data for organization, software product, breadcrumbs, and selected marketplace pages
- mobile-first layouts with accessible headings, landmarks, keyboard navigation, visible focus states, and WCAG AA color contrast
- no indexing for auth redirects or any non-marketing utility pages
- redirects from old public paths to new paths:
  - `app.ambra-system.com` public marketing paths -> `ambra-system.com`
  - `vmi.ambra-system.com/vendors/*` -> `ambra-system.com/vmi/vendors/*`
  - `vmi.ambra-system.com/products/*` -> `ambra-system.com/vmi/products/*`
  - `vmi.ambra-system.com/flyers/*` -> `ambra-system.com/vmi/flyers/*`

## Remaining Work

No required work remains for the v1 extraction plan.

Optional hardening after the deployment has real production traffic:

- Add a dedicated `apps/public-web` Playwright suite. The repo currently has Playwright coverage under `apps/vmi-client`, while this extraction was validated with type checks, lint, production build, and built-route HTTP smoke checks.
- Revisit dependency pruning after observing production bundle output. Some copied Ambra modules still carry warnings because the public maps/tools extraction depends on existing Ambra code paths.
- Decide whether VMI public API endpoints should remain duplicated in `apps/vmi-client` for backward compatibility or eventually redirect/proxy to `apps/public-web`.
- Move repeated public config/helpers into `@repo/ui` or a small shared package only if a second app starts importing the same public-web code.

## Documentation File

Create `docs/AMBRA_PUBLIC_WEBSITE_EXTRACTION_PLAN.md` containing this plan, with the checkbox tracker at the top.

The document should include:

- route ownership table
- extraction checklist
- shared code checklist
- SEO/accessibility checklist
- test checklist
- deployment/domain checklist

## Test Plan

Run these checks before accepting the implementation:

- `pnpm --filter public-web check-types`
- `pnpm --filter public-web lint`
- `pnpm --filter public-web build`
- existing affected app checks:
  - `pnpm --filter web check-types`
  - `pnpm --filter vmi-client check-types`
- Playwright smoke tests for:
  - public home page mobile and desktop
  - `/features`
  - `/pricing`
  - `/vmi`
  - `/vmi/vendors`
  - `/vmi/vendors/[slug]`
  - `/vmi/products`
  - `/vmi/products/[slug]`
  - auth CTAs route to the correct subdomains
- Accessibility checks for keyboard navigation, focus visibility, headings, labels, and color contrast
- SEO checks for canonical, `hreflang`, sitemap, robots, OpenGraph, and no duplicate indexed content

## Assumptions

- The public website should be the only indexed marketing surface.
- Auth screens stay in their product apps, not in the marketing website.
- VMI public marketplace pages should move under `/vmi` to avoid URL collisions with global Ambra ERP marketing pages.
- Polish remains the default locale, with English supported for enterprise SEO.
- VMI marketplace data can remain mock/prototype-backed during extraction unless a later implementation task explicitly connects it to production data.
