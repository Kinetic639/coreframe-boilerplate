# CRM Module Checklist

## Purpose

- [x] Module identity: `crm`
- [x] Domain objects documented in `MODULE.md`
- [x] Kontrahent numbers are plain integers and server-assigned
- [x] Parties and contacts are separate object types
- [x] Suppliers/clients/contractors are roles, not separate tables

## Architecture

- [x] Contracts constants added in `@repo/contracts`
- [x] Sidebar V2 registry entry uses constants only
- [x] Module config is metadata only
- [x] Pages are Server Components by default
- [x] Client components receive SSR initial data
- [x] Server actions route all mutations through services
- [x] CRM settings route scaffold exists
- [x] Parties, contacts, and settings have route-level loading/error boundaries
- [x] Private CRM storage buckets and policies are included in the CRM migration
- [x] CRM logo/avatar upload and signed URL server actions exist
- [x] CRM logo/avatar upload controls exist in party/contact detail panels
- [x] CRM supplier search action exists for warehouse item supplier pickers
- [x] CRM supplier management panel exists on warehouse item edit page
- [x] Warehouse item edit CRM supplier panel captures supplier SKU, lead time, MOQ, purchase price, and currency
- [x] Warehouse item detail page shows assigned CRM suppliers when CRM read permission is present
- [x] Warehouse item create flow can attach initial CRM suppliers after product creation
- [x] Party detail supports basic editing and role editing
- [x] Party detail supports linking existing contacts as contact people
- [x] Party detail supports adding addresses
- [x] Party detail supports unlinking contact people through soft delete
- [x] Party detail supports removing addresses through soft delete
- [x] Contact detail supports basic editing and visibility editing
- [x] Contact create/edit supports optional linked organization users when member read access is present
- [x] Party and contact detail panels expose archive actions when permitted
- [x] Warehouse movement party fields resolve CRM kontrahenci by plain integer number
- [x] Warehouse movement party details persist CRM party id, number, and snapshot in JSON
- [x] Warehouse audit supplier-scope flow reviewed; it remains on legacy supplier ids until a CRM bridge/migration exists

## Security

- [x] Migration creates permissions and role assignments
- [x] CRM tables have RLS enabled
- [x] PII tables use FORCE RLS
- [x] Server actions enforce module entitlement
- [x] Server actions check permission snapshot before service calls
- [x] Hard delete denied by RLS
- [x] Soft delete uses `deleted_at`

## Verification

- [x] Apply CRM DDL to `ambra-prod` through Supabase MCP
- [x] Apply CRM advisor FK indexes through Supabase MCP
- [x] Run Supabase security and performance advisors through MCP
- [x] Document accepted advisor finding for authenticated `SECURITY DEFINER` number allocator
- [x] Regenerate Supabase target types after applying migration
- [x] Run contracts tests
- [x] Run sidebar SSR tests
- [x] Add/expand CRM action and service tests
- [x] Add CRM migration invariant tests for storage policies
- [x] Add CRM migration invariant coverage for RLS/FORCE RLS, hard-delete denial, branch/private visibility, secure number allocation, and cross-org link prevention
- [x] Run `pnpm --filter web run type-check`
- [x] Run focused CRM `npx vitest run` equivalent through `pnpm --filter web run test:run` — 8 files, 98 tests
- [x] Run full `pnpm --filter web run test:run` attempt and document unrelated project-wide blockers
- [x] Run `pnpm --filter web run build`

## Known Non-CRM Verification Blockers

- [x] Full web Vitest currently times out after 300 seconds with unrelated failures in public header, DataView, signup, QR labels/PDF generation, admin sidebar registry, loading tests, branch context, and audit visual taxonomy. The focused CRM/service/action/sidebar/RLS suite passes.
