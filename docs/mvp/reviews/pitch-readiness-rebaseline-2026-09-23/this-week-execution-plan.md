# This-Week Execution Plan

Optimized for the product owner's explicit goal: presentation-ready THIS WEEK. Relative sizing only (XS/S/M/L) — no calendar-hour promises.

> **CORRECTED 2026-09-23**: order now reflects the confirmed PITCH-REQUIRED status of container QR/relocation/issue (Phases 10D-F), and Zone 1's fix runs first since it is the smallest, fully independent item and unblocks clean UAT for everything else.

## P0-1. Zone 1 branch-switch/cache fix

- **Dependency**: none — fully independent of every other item.
- **Repository area**: `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx` (root-cause fix), `apps/web/src/hooks/queries/tools/wdd-matcher.ts` (Matcher cache-key fix), `locations-data-view.tsx` + `inventory-movements-client.tsx` + `inventory-client.tsx` (Warehouse cache-key fixes).
- **DB migration expected**: NO.
- **Architecture change expected**: NO.
- **Nature**: bug fix (query-key/cache-invalidation correction), UI-layer only.
- **Size**: S.
- **Parallelizable**: YES, with everything else.
- **Automated test**: unit test on the 2 affected query-key factories.
- **Manual UAT**: YES — switch branch while parked on each affected screen.

## P0-2. Phase 10D — Container QR (in parallel with P0-1, P0-3, P0-5)

- **Dependency**: none.
- **Repository area**: `apps/web/src/server/qr/target-registry.ts` (new `inventory.container` entry, following the existing 3-type pattern), a resolver view, label design.
- **DB migration expected**: possibly — a `qr_codes`/`qr_assignments` migration doesn't exist in-repo at all today (disclosed schema-drift gap); adding a container entry may be the moment to also write that missing migration.
- **Architecture change expected**: NO — additive, follows the existing registry pattern exactly.
- **Nature**: UI + service integration.
- **Size**: M.
- **Parallelizable**: YES.
- **Automated test**: unit test on the new registry entry/resolver.
- **Manual UAT**: YES, on presentation phone.

## P0-3. Receiving + mobile putaway UI

- **Dependency**: none technically; sequence its own UAT AFTER P0-1 lands, so branch-switch bugs don't confound testing.
- **Repository area**: new mobile-oriented UI under `.../warehouse/deliveries/` and/or `.../scanning/delivery/` (currently placeholder routes), calling the existing `receive_repair_order_stock`/`putaway_repair_order_stock` RPCs via new server actions.
- **DB migration expected**: NO — RPCs already exist, secured, tested.
- **Architecture change expected**: NO — pure UI/service-integration work calling already-frozen, accepted RPCs.
- **Nature**: UI + service integration.
- **Size**: L — the largest single item.
- **Parallelizable**: YES, with everything else.
- **Automated test**: lightweight Vitest for the new actions' own request validation.
- **Manual UAT**: YES, mandatory, on the actual presentation phone.

## P0-4. Phase 10E — Container relocation

- **Dependency**: P0-2 (Phase 10D) must land first — relocation via QR scan needs the container QR target to exist.
- **Repository area**: new UI wiring the already-existing `relocateContainerAction` to a scan-container-QR → scan-new-location flow.
- **DB migration expected**: NO — backend RPC already exists.
- **Architecture change expected**: NO.
- **Nature**: UI wiring only.
- **Size**: S-M.
- **Parallelizable**: NO — after P0-2.
- **Automated test**: manual UAT primarily.
- **Manual UAT**: YES.

## P0-5. Phase 10F — 201/WZ issue

- **Dependency**: none.
- **Repository area**: `apps/web/src/app/actions/warehouse/inventory/index.ts` (`issueStockAction`, currently a stub) + a new seeded movement type + minimal UI.
- **DB migration expected**: YES — seed movement type `201`/WZ into the authoritative `apps/web/supabase-target/supabase/migrations` tree, with a recipient field per the accepted design.
- **Architecture change expected**: NO — additive (new movement type + field policy), matching the accepted design's own scope.
- **Nature**: bug fix (stub replacement) + service integration + UI + DB migration.
- **Size**: M.
- **Parallelizable**: YES, with everything else.
- **Automated test**: a couple of pgTAP/Vitest cases.
- **Manual UAT**: YES.

## P1 — should finish because it materially reduces demo risk

| Item                             | Dependency                  | Area                                    | Migration? | Architecture change? | Nature                            | Size | Parallel?             | Test          | Manual UAT? |
| -------------------------------- | --------------------------- | --------------------------------------- | ---------- | -------------------- | --------------------------------- | ---- | --------------------- | ------------- | ----------- |
| Zone 11 minimal home dashboard   | None (scope decision first) | `dashboard/start/page.tsx`              | No         | No                   | Scope decision, then UI + service | M    | Yes                   | Manual        | Yes         |
| Zone 6 SKU search fix            | None                        | `InventoryProductsService.listProducts` | No         | No                   | Bug fix                           | XS   | Yes                   | Unit + manual | Yes         |
| Zone 6 movement-kind label fix   | None                        | `location-detail-panel.tsx` (~line 311) | No         | No                   | Bug fix                           | XS   | Yes                   | Unit + manual | Recommended |
| Zone 6 `posted_by` display       | None                        | Location history component              | No         | No                   | UI addition                       | XS   | Yes                   | Manual        | Recommended |
| Zone 4 fresh QR manual pass      | Ideally after P0-1          | N/A — verification only                 | No         | No                   | Verification                      | XS   | Mostly, sequence last | Manual only   | YES         |
| Zone 3 fresh Phase 7+ manual UAT | None                        | N/A — verification only                 | No         | No                   | Verification                      | XS-S | Yes                   | Manual only   | YES         |
| Zone 2 Approve-flow rehearsal    | None                        | N/A — verification only                 | No         | No                   | Verification                      | XS   | Yes                   | Manual only   | YES         |

## P2 — polish only

- Zone 8 (Tickets) narrow two-account demo rehearsal.
- Zone 9 (Planning) — pick and rehearse the one small example, if used at all.

## Final — demo data, full rehearsal, fallback

- Demo org/data setup per `docs/mvp/presentation-demo-setup.md`.
- Full laptop+phone E2E rehearsal, in script order.
- Script rehearsal on the corrected `docs/mvp/ambra-skrypt-prezentacji.md`.
- Fallback preparation (recorded backup for the highest-risk live-scan/network steps, per `mvp-readiness.md`'s own risk table).

## DEFER — pilot/post-pilot, explicitly excluded from this week

- Everything in `pilot-ready-gate.md`.
- Zone 10 (Notifications) — do not touch; explicitly roadmap-only.
- Inventory Core's own accepted technical debt — already correctly deferred, not reopened.

## Suggested execution order (respecting dependencies, maximizing parallelism)

1. **Immediately, in parallel**: P0-1 (Zone 1 fix), P0-2 (Container QR), P0-3 (Receiving/putaway — start early given its size), P0-5 (201/WZ issue), Zone 11 scope decision.
2. **Once P0-2 lands**: P0-4 (Container relocation).
3. **In parallel throughout**: all P1 small bug fixes (Zone 6 ×3) and Zone 11's own build once scoped.
4. **Last, after everything else affecting the same screens is done**: fresh manual UAT passes — Zone 1 (after P0-1), Zone 4 QR (after P0-1 and P0-2), Zone 3 Phase 7+, Zone 2 Approve-flow, and finally a full end-to-end rehearsal of the entire minimum pitch flow.

## Safe to start the first implementation/fix pass?

**YES.**
