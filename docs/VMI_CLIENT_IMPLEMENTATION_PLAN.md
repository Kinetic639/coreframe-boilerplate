# VMI Client App Implementation Plan

## Progress Tracker

### Phase 0: Planning And Setup

- [x] Save implementation plan in docs
- [x] Confirm final package name: `vmi-client`
- [x] Confirm app path: `apps/vmi-client`
- [x] Confirm V1 scope and deferred features

### Phase 1: App Scaffold

- [x] Create `apps/vmi-client`
- [x] Add package scripts
- [x] Add TypeScript, ESLint, PostCSS, Next config
- [x] Wire app into turborepo checks
- [x] Add base layout and route skeleton

### Phase 1.5: Public Mocked Backend

- [x] Add public marketplace DTO contracts
- [x] Add full prototype fixture-backed repository
- [x] Add supplier search with geo/radius filtering
- [x] Add product search and details lookup
- [x] Add catalogs, promotions, and flyers lookup
- [x] Add full marketplace snapshot endpoint
- [x] Add public REST facade route handlers
- [x] Add partnership request mock submission
- [x] Add quotation request mock submission
- [x] Add repository and API route tests
- [x] Add Playwright e2e smoke tests for public mocked backend

### Phase 2: Design Extraction

- [x] Audit reusable UI from `temp/vmi-client`
- [x] Port visual tokens and layout patterns
- [x] Rebuild public marketplace shell navigation
- [x] Rebuild public marketplace home with typed props
- [x] Rebuild public marketplace home to match prototype visual structure
- [x] Rebuild supplier search route with `nuqs` URL state
- [x] Rebuild supplier search route with prototype-style filters and map preview
- [x] Rebuild supplier search route as mobile-first responsive results experience
- [x] Rebuild supplier directory and profile routes with typed props
- [x] Rebuild product directory and detail routes with typed props
- [x] Rebuild flyer detail route with typed props
- [ ] Rebuild authenticated dashboard UI with typed props
- [x] Remove mock/localStorage coupling from ported public components

### Phase 3: Database And Security

- [ ] Add VMI contracts and permission constants
- [ ] Create Supabase migration
- [ ] Add VMI tables, indexes, RLS, grants
- [ ] Apply migration through Supabase MCP
- [ ] Regenerate Supabase types
- [ ] Add migration regression tests

### Phase 4: Services And Actions

- [ ] Add validation schemas
- [ ] Add service layer
- [ ] Add server actions
- [ ] Add query hooks for client islands
- [ ] Enforce auth, permissions, and client organization scoping

### Phase 5: Core Routes

- [ ] Dashboard
- [ ] Vendors
- [ ] Inventory
- [ ] Stock counts
- [ ] Proposals
- [ ] Orders
- [ ] Messages shell
- [ ] Settings

### Phase 6: Testing And Hardening

- [ ] Unit tests
- [ ] Server action tests
- [ ] RLS/integration tests
- [ ] Mobile viewport checks
- [ ] Type-check
- [ ] Build
- [ ] Supabase advisors

### Phase 7: V1 Acceptance

- [ ] Client user can sign in
- [ ] Client sees only assigned vendors/locations
- [ ] Client can submit stock count
- [ ] Client can review proposal
- [ ] Client can create/order from allowed catalog items
- [ ] Vendor-side Ambra data stays consistent

## Summary

Create a new production app at `apps/vmi-client` and use `temp/vmi-client` only as a visual/product prototype. Do not refactor the prototype in place. The prototype is too client-state-heavy: one giant client page, mock data, `localStorage`, no server actions, no RLS model, no module/service separation. The correct path is to scaffold a clean Next app inside the turborepo, align it with the existing Ambra architecture, then port the UI patterns screen by screen.

Chosen defaults:

- App path: `apps/vmi-client`
- Backend: same Supabase project as Ambra
- Users: external client users, not normal internal Ambra org members
- V1 scope: core VMI portal MVP, not full prototype parity
- Prototype role: design reference and temporary source for UI components only

## Key Architecture

- Scaffold `apps/vmi-client` as a separate Next app using the repo standards:
  - Next 16, React 19, TypeScript strict
  - shared workspace packages where appropriate: `@repo/contracts`, `@repo/auth`, `@repo/supabase`, `@repo/typescript-config`, `@repo/eslint-config`
  - scripts matching `apps/web`: `dev`, `build`, `type-check`, `check-types`, `lint`, `test`, `test:run`
  - own app shell, routes, i18n/messages, tests, and Supabase server/client utilities
- Keep Ambra internal app in `apps/web`; do not merge VMI screens into the existing dashboard shell.
- Add VMI-specific public/client portal routes:
  - `/sign-in`
  - `/`
  - `/vendors`
  - `/inventory`
  - `/stock-counts`
  - `/proposals`
  - `/orders`
  - `/messages`
  - `/settings`
- SSR-first rule:
  - pages load initial data server-side
  - client components only handle interaction, filtering, dialogs, carts, workflow steps, optimistic UI
  - no production persistence in `localStorage` except explicit offline draft buffers

## Shared Package Audit

Already shared and usable by both `apps/web` and `apps/vmi-client`:

- `@repo/contracts`: module, permission, entitlement, and auth contract constants.
- `@repo/auth`: framework-neutral auth service helpers and tests.
- `@repo/supabase`: generated database types and platform-neutral Supabase config interfaces.
- `@repo/typescript-config`: shared TypeScript base/Next/React configs.
- `@repo/eslint-config`: shared ESLint configs for Next, tests, libraries, and Expo.
- `@repo/testing`: shared testing utilities where future VMI tests need them.

Exists but is not yet production-ready as the shared web UI source:

- `@repo/ui`: currently contains only minimal placeholder components. It should become the shared package for cross-app primitives, but the reusable shadcn/Radix wrappers still live in `apps/web/src/components/ui`.

Should be extracted later, not during Phase 1:

- shadcn/Radix primitives from `apps/web/src/components/ui` into `@repo/ui`.
- shared Supabase browser/server client factories if the VMI implementation needs the same SSR cookie behavior as `apps/web`.
- shared permission/auth guard patterns after VMI client access rules are defined.
- shared DataView/table primitives only if VMI needs the same dense data-management UX; the VMI app should not inherit admin-dashboard UI by default.

## Phase 1 Verification Notes

Validated directly for `vmi-client`:

- `pnpm --filter vmi-client run test:run`
- `pnpm --filter vmi-client run type-check`
- `pnpm --filter vmi-client run lint`
- `pnpm --filter vmi-client run build`

Turbo participation check:

- `pnpm turbo run check-types --filter=vmi-client` discovers the app and runs the task graph.
- The graph currently fails in existing package `@repo/eslint-config`, where `next.js` type-checking rejects the `@next/eslint-plugin-next` config shape. The VMI app `check-types` task itself passes.

## Pre-Prototype Import Decision

Before importing UI from `temp/vmi-client`, build the VMI account and relationship backbone first.
The prototype dashboard needs real client/vendor/location context; without it, imported screens would become mock-data islands that later need to be rewired.

Recommended next step:

- Add an Ambra-side VMI vendor module in `apps/web` for internal vendor users.
- Add shared VMI contracts in `packages/contracts`.
- Add VMI domain helpers in `packages/domain` when logic is pure and app-neutral.
- Add VMI tables/RLS/migrations in the same Supabase project.
- Add VMI auth/invite acceptance routes in `apps/vmi-client`.
- Then port prototype components screen-by-screen using real SSR data contracts.

Existing Ambra pieces to reuse as implementation references:

- Organization invitation flow: `OrgInvitationsService`, invitation actions, invite preview page, and auth callback handling.
- CRM parties and contacts: vendors/clients should reference CRM parties instead of duplicating contractor data.
- Warehouse item supplier links: VMI catalog exposure should build from existing supplier/product relationships where possible.
- Organization entity numbers: branch and contractor number lookup already exists for Ambra-side operations.
- Permission and entitlement patterns: module constants, permission constants, RLS-first migrations, and server action guards.
- Supabase SSR utilities: current app-local factories should either be copied into VMI initially or extracted after both apps need identical behavior.

Do not directly import from `apps/web` into `apps/vmi-client`:

- route components
- server actions
- app-local Supabase utilities
- dashboard shell/sidebar components
- app-local shadcn UI primitives until they are intentionally extracted to `@repo/ui`

## Public Mocked Backend

Before importing the public marketplace UI, use a temporary data backend with the same contract shape expected from the future shared REST API.
The fixture provider lives behind repository methods and API route handlers, so screens can be built against stable DTOs now and later switched to real API/database data without rewriting the UI flow.

Implemented temporary public endpoints:

- `GET /api/public/marketplace`
- `GET /api/public/suppliers`
- `GET /api/public/suppliers/[slug]`
- `GET /api/public/categories`
- `GET /api/public/products`
- `GET /api/public/products/[slug]`
- `GET /api/public/catalogs`
- `GET /api/public/catalogs/[id]`
- `GET /api/public/promotions`
- `GET /api/public/flyers`
- `GET /api/public/flyers/[slug]`
- `POST /api/public/partnership-requests`
- `POST /api/public/quotation-requests`

The mocked backend now carries the full marketplace fixture set from the prototype:

- cities
- supplier categories
- brands
- vendors/suppliers
- 100 generated/public products
- catalogs
- promotions
- flyers

Supported supplier search inputs:

- text query
- category
- industry
- city
- latitude/longitude
- radius in kilometers
- VMI-ready only
- verified only
- result limit

Replacement rule:

- Public pages should call typed marketplace data functions or the REST facade.
- Public pages should not import fixture arrays directly.
- When the real API exists, replace the repository implementation/provider, not the page/component contracts.

## Data Model And Integration

Use the same Supabase project so Ambra vendors and VMI clients see the same business state through different RLS policies.

Add VMI foundation tables:

- `vmi_client_accounts`
  - links `auth.users.id` to a client-side identity
  - references CRM contact where possible via `crm_contacts.id`
  - stores status, invited/created metadata, last login metadata

- `vmi_client_organizations`
  - represents the customer/client company using the VMI portal
  - should reference `crm_parties.id` when the client already exists as a CRM party

- `vmi_client_locations`
  - client-side locations/branches/sites being replenished
  - separate from Ambra internal `branches`
  - optional mapping to CRM party address or warehouse/customer delivery address

- `vmi_vendor_relationships`
  - connects supplier/vendor CRM parties to VMI client organizations
  - stores relationship status, account manager/contact, enabled modules, terms

- `vmi_catalog_items`
  - exposes vendor-supplied products to a client
  - references Ambra inventory products/variants where applicable
  - stores client SKU, vendor SKU, pack size, min order qty, visibility/status

- `vmi_inventory_balances`
  - client-visible stock state per client location and catalog item
  - stores current stock, min/target stock, incoming qty, last counted timestamp

- `vmi_stock_counts`
  - stock-count sessions requested by vendor or started by client
  - statuses: draft, in_progress, submitted, accepted, rejected, cancelled

- `vmi_stock_count_lines`
  - counted quantities, variance, notes, unable-to-count reason

- `vmi_replenishment_proposals`
  - vendor-generated replenishment proposals sent to client

- `vmi_replenishment_proposal_lines`
  - suggested quantities, client adjusted quantities, line status, comments

- `vmi_orders`
  - orders created manually or from accepted proposals

- `vmi_order_lines`
  - ordered, confirmed, shipped, delivered quantities

- `vmi_conversations` and `vmi_messages`
  - VMI-specific client/vendor communication, optionally linkable to order/proposal/product/count

V1 can keep promotions/flyers/showrooms as read-only tables or postpone them:

- `vmi_promotions`
- `vmi_digital_flyers`
- `vmi_digital_flyer_pages`

## Security And Access

- Add VMI portal permissions/contracts in `packages/contracts`:
  - `MODULE_VMI_CLIENT = "vmi-client"`
  - `module.vmi-client.access`
  - `vmi-client.read`
  - `vmi-client.inventory.read`
  - `vmi-client.stock-counts.read`
  - `vmi-client.stock-counts.submit`
  - `vmi-client.orders.read`
  - `vmi-client.orders.create`
  - `vmi-client.proposals.read`
  - `vmi-client.proposals.respond`
  - `vmi-client.messages.read`
  - `vmi-client.messages.send`
- RLS must distinguish external client users from internal vendor users.
- Client users can only see rows for their assigned `vmi_client_organization_id` and allowed locations.
- Internal Ambra users manage VMI relationships from `apps/web`; client users operate from `apps/vmi-client`.
- No service-role key in runtime client code.
- Use `supabase.auth.getUser()` server-side, not `getSession()` for auth decisions.

## Implementation Phases

1. Scaffold `apps/vmi-client`
   - Add package, configs, scripts, root layout, route skeleton, test setup.
   - Add app to `pnpm-workspace.yaml` automatically through `apps/*`.
   - Confirm `turbo run build`, `check-types`, and `test:run` include the new app.

2. Extract prototype design system
   - Copy visual language from `temp/vmi-client`: colors, typography direction, mobile bottom nav, desktop sidebar, cards, marketplace feel.
   - Rebuild components using repo standards and shadcn-style primitives.
   - Do not copy the giant `app/page.tsx` orchestration as-is.
   - Convert mock-heavy screens into isolated presentational components with typed props.

3. Add VMI database foundation
   - Create Supabase migration using target migration workflow.
   - Add tables, indexes, RLS, grants, and helper functions.
   - Apply migration through Supabase MCP.
   - Generate Supabase types after migration.

4. Add service and action layer
   - `src/server/services/vmi-*.service.ts`
   - `src/app/actions/vmi/*.ts`
   - Zod validation in `src/lib/validations/vmi.ts`
   - All queries scoped by client organization/location/vendor relationship.
   - Server actions enforce portal access and then rely on RLS as hard boundary.

5. Build SSR routes
   - Dashboard overview with stock health, pending proposals, pending counts, active orders.
   - Vendors list/detail using CRM party/vendor relationships.
   - Inventory list/detail with stock status and reorder info.
   - Stock count workflow with offline draft support as explicit V1 feature.
   - Proposals and orders with real status transitions.
   - Messages shell with conversation list and detail.

6. Port UI from prototype screen by screen
   - First port shell/navigation and dashboard.
   - Then inventory and stock count workflow.
   - Then proposals/orders.
   - Then vendor detail and marketplace-like presentation.
   - Leave flyers/showrooms/promotions for V1.1 unless needed earlier.

## Testing Plan

- Contracts tests:
  - VMI module slug included in module list.
  - VMI permission slugs unique and exported.
- Migration tests:
  - All VMI tables have RLS enabled and forced where appropriate.
  - Client users cannot read other client organizations.
  - Client location scoping works.
  - Hard deletes denied where business records need auditability.
- Service tests:
  - Every list/detail query scopes by client organization.
  - Stock count submit validates ownership and status.
  - Proposal response validates line IDs and status.
  - Order creation only uses allowed catalog items.
- Action tests:
  - unauthenticated rejected
  - missing VMI access rejected
  - wrong client organization rejected
  - invalid input rejected
  - successful stock count/proposal/order flows return typed results
- UI tests:
  - mobile navigation usable at small viewport
  - dashboard SSR renders with initial data
  - stock count workflow handles save/submit states
  - empty/loading/error states for each core route
- Build gates:
  - `pnpm --filter vmi-client run type-check`
  - `pnpm --filter vmi-client run test:run`
  - `pnpm --filter vmi-client run build`
  - relevant `@repo/contracts` tests
  - Supabase MCP verification after migrations

## Assumptions

- The new app package name will be `vmi-client`.
- The prototype in `temp/vmi-client` remains temporary and is not committed as production source.
- VMI client users are external customer-side users, not standard Ambra internal organization members.
- Vendor users continue to use Ambra in `apps/web`.
- Client users use `apps/vmi-client`.
- Same Supabase project is the source of truth.
- V1 focuses on operational VMI workflows: dashboard, vendors, inventory, stock counts, proposals, orders, and messaging shell.
- Marketplace/flyers/promotions are visually important but can be phased after the operational MVP unless they are explicitly promoted into V1.
