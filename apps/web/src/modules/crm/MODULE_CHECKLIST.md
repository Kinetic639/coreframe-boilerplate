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
- [x] Party detail supports basic editing and role editing
- [x] Party detail supports linking existing contacts as contact people
- [x] Party detail supports adding addresses
- [x] Contact detail supports basic editing and visibility editing
- [x] Party and contact detail panels expose archive actions when permitted
- [x] Warehouse movement party fields resolve CRM kontrahenci by plain integer number
- [x] Warehouse movement party details persist CRM party id, number, and snapshot in JSON

## Security

- [x] Migration creates permissions and role assignments
- [x] CRM tables have RLS enabled
- [x] PII tables use FORCE RLS
- [x] Server actions enforce module entitlement
- [x] Server actions check permission snapshot before service calls
- [x] Hard delete denied by RLS
- [x] Soft delete uses `deleted_at`

## Remaining Verification

- [ ] Regenerate Supabase types after applying migration
- [x] Run contracts tests
- [x] Run sidebar SSR tests
- [x] Add/expand CRM action and service tests
- [x] Add CRM migration invariant tests for storage policies
- [ ] Add real RLS integration tests
- [ ] Run `npm run type-check` after unrelated rich-text `@tiptap/core` issue is resolved
- [x] Run focused CRM `npx vitest run` equivalent through `pnpm --filter web run test:run` — 7 files, 71 tests
- [ ] Run full `npx vitest run`
- [ ] Run `npm run build`
- [ ] Run Supabase advisors through MCP or CLI after DDL is applied
