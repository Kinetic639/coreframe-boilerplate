# This-Week Execution Plan

Optimized for the product owner's explicit goal: presentation-ready THIS WEEK. Relative sizing only (XS/S/M/L) — no calendar-hour promises, per instruction.

## P0 — must fix/build or the presentation cannot honestly run

### P0-1. Zone 1 branch-switch/cache fix

- **Exact dependency**: none — fully independent of every other item.
- **Repository area**: `apps/web/src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx` (root-cause fix), `apps/web/src/hooks/queries/tools/wdd-matcher.ts` (Matcher cache-key fix), `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx` + `inventory-movements-client.tsx` + `inventory-client.tsx` (Warehouse cache-key fixes).
- **DB migration expected**: NO.
- **Inventory Core architecture change needed**: NO.
- **Nature**: bug fix (query-key/cache-invalidation correction), UI-layer only.
- **Size**: S.
- **Parallelizable**: YES, with everything else.
- **Test type**: unit test on the 2 affected query-key factories + Playwright/manual browser UAT (switch branch while parked on each affected screen, confirm content updates without reload).
- **Manual UAT required**: YES — Zone 1's own doc requires fresh current-build manual verification regardless of code fix; this item's own fix must be exercised live on the exact pitch-path screens.

### P0-2. Receiving + mobile putaway UI

- **Exact dependency**: none technically (backend RPCs already exist and are tested) — but should be sequenced so its own manual UAT happens AFTER P0-1 (branch-switch fix), since the receiving flow itself is branch-scoped and should be tested under a correctly-refreshing branch context.
- **Repository area**: new mobile-oriented UI under `apps/web/src/app/[locale]/dashboard/warehouse/deliveries/` and/or `.../scanning/delivery/` (currently placeholder routes), calling the existing `receive_repair_order_stock`/`putaway_repair_order_stock` RPCs via new server actions.
- **DB migration expected**: NO — RPCs already exist, secured, tested.
- **Inventory Core architecture change needed**: NO — this is pure UI/service-integration work calling already-frozen, accepted RPCs.
- **Nature**: UI + service integration (new screens, new actions wrapping existing RPCs).
- **Size**: L — the largest single item; needs a real scan-part/kit → scan-location → confirm loop, session-close, and a report view sourced from real movement/location data (not the Matcher-only PDF the old report generator reads today).
- **Parallelizable**: YES, with P0-1, P0-3, P0-4/5 decisions.
- **Test type**: manual browser + phone UAT (mandatory — this is a live phone demo item); consider a lightweight Vitest suite for the new actions' own request validation.
- **Manual UAT required**: YES, on the actual presentation phone/device.

### P0-3. Home dashboard

- **Exact dependency**: a scope decision must happen FIRST (which widgets/summaries) — this is itself unstarted, not just the build.
- **Repository area**: `apps/web/src/app/[locale]/dashboard/start/page.tsx` (currently a 15-line static placeholder) + a new server-fetched data source.
- **DB migration expected**: Likely NO — existing data (recent activity, counts, quick links) should be assemblable from already-existing tables/services (e.g. `DashboardStatusBar`'s own activity-feed pattern already exists elsewhere in the app and could be reused/adapted).
- **Inventory Core architecture change needed**: NO.
- **Nature**: scope decision, then UI + service integration.
- **Size**: M.
- **Parallelizable**: YES, with everything else — but the scope decision itself should happen as early as possible since it gates the build.
- **Test type**: manual browser UAT (does it render real, branch/permission-scoped data, no fabricated numbers).
- **Manual UAT required**: YES — this is literally the first screen of every demo run-through.

### P0-4. QR scope decision (parts/containers)

- **Exact dependency**: none — pure decision, does not block or get blocked by anything else.
- **Repository area**: `docs/mvp/ambra-skrypt-prezentacji.md` (script wording, if narrowing) OR `apps/web/src/server/qr/target-registry.ts` (if building a minimal type).
- **DB migration expected**: only if the "build" branch is chosen (a `qr_codes`/`qr_assignments` migration would ALSO need writing, since none currently exists in-repo — see Zone 4's own disclosed schema-drift finding).
- **Inventory Core architecture change needed**: NO — QR targets are a generic app-platform concept, not Inventory Core.
- **Nature**: product decision, then either a documentation/script edit (XS) or a small build (M).
- **Size**: XS (decision + narrow script) — **recommended**, matching the master tracker's own existing recommendation — or M (build a minimal QR target type).
- **Parallelizable**: YES.
- **Test type**: N/A if narrowing; manual UAT if building.
- **Manual UAT required**: only if building.

### P0-5. 201/WZ issue path decision

- **Exact dependency**: none — pure decision point, same shape as P0-4.
- **Repository area**: either `apps/web/src/app/actions/warehouse/inventory/index.ts` (`issueStockAction`, currently a stub) + a new seeded movement type + minimal UI, OR just the presentation choreography (narrate this step rather than perform it live).
- **DB migration expected**: only if building (seed movement type `201`/WZ into the authoritative `apps/web/supabase-target/supabase/migrations` tree).
- **Inventory Core architecture change needed**: NO — this is additive (a new movement type + field policy), matching the accepted design's own scope, not a redesign.
- **Nature**: product decision, then either narration-only (XS) or bug fix/service integration/UI (M).
- **Size**: XS (narrate, don't perform live) — **recommended given the timeline** — or M (build the minimal 201/WZ path per the already-accepted design).
- **Parallelizable**: YES.
- **Test type**: N/A if narrating; manual UAT + a couple of pgTAP/Vitest cases if building.
- **Manual UAT required**: only if building.

## P1 — should finish because it materially reduces demo risk

| Item                             | Dependency                                                                 | Area                                    | Migration? | Architecture change? | Nature       | Size | Parallel?             | Test          | Manual UAT?            |
| -------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | ---------- | -------------------- | ------------ | ---- | --------------------- | ------------- | ---------------------- |
| Zone 6 SKU search fix            | None                                                                       | `InventoryProductsService.listProducts` | No         | No                   | Bug fix      | XS   | Yes                   | Unit + manual | Yes (visible on stage) |
| Zone 6 movement-kind label fix   | None                                                                       | `location-detail-panel.tsx` (~line 311) | No         | No                   | Bug fix      | XS   | Yes                   | Unit + manual | Recommended            |
| Zone 6 `posted_by` display       | None                                                                       | Location history component              | No         | No                   | UI addition  | XS   | Yes                   | Manual        | Recommended            |
| Zone 4 fresh QR manual pass      | Ideally after P0-1 (so a branch switch mid-scan doesn't confound the test) | N/A — verification only                 | No         | No                   | Verification | XS   | Mostly, sequence last | Manual only   | YES                    |
| Zone 3 fresh Phase 7+ manual UAT | None                                                                       | N/A — verification only                 | No         | No                   | Verification | XS-S | Yes                   | Manual only   | YES                    |
| Zone 2 Approve-flow rehearsal    | Depends on confirming script requirement first                             | N/A — verification only                 | No         | No                   | Verification | XS   | Yes                   | Manual only   | YES                    |

## P2 — polish only

- Zone 8 (Tickets) narrow two-account demo rehearsal.
- Zone 9 (Planning) — pick and rehearse the one small example, if used at all.
- Zone 6 container-relocation UI, only if P0-4/P0-5-style narrowing isn't preferred for this item too (recommend narrowing here as well, given timeline — container relocation via UI is genuinely L-sized and not required by the script's literal text, only implied by "przeniesienie zestawu," which can be narrated).

## DEFER — pilot/post-pilot, explicitly excluded from this week

- Everything in `pilot-ready-gate.md`.
- Zone 10 (Notifications) — do not touch; explicitly roadmap-only, and touching it risks introducing new bugs in an area nobody needs working this week.
- Inventory Core's own accepted technical debt (reproducibility, unmeasured performance, audit-trail enhancement, etc.) — already correctly deferred, not reopened by this audit.

## Suggested execution order (respecting dependencies, maximizing parallelism)

1. **Immediately, in parallel**: P0-4 decision (QR scope), P0-5 decision (issue-path scope), P0-1 (branch-switch fix — no dependency), P0-3 scope decision (dashboard widgets).
2. **Once decisions land**: P0-4/P0-5 execution (whichever branch chosen), P0-3 build, P0-2 (receiving/putaway — the largest item, start as early as possible given its size).
3. **In parallel throughout**: all P1 small bug fixes (Zone 6 ×3) — trivial, zero dependency, can be picked up by anyone at any time.
4. **Last, after everything else affecting the same screens is done**: fresh manual UAT passes — Zone 1 (after P0-1), Zone 4 QR (after P0-1, so a branch-switch bug doesn't confound the QR test), Zone 3 Phase 7+, Zone 2 Approve-flow, and finally a full end-to-end rehearsal of the entire minimum pitch flow (see the task's own Section 7 flow, cross-checked in `pitch-script-truth-matrix.md`).

## Safe to start the first implementation/fix pass?

**YES.** This audit is complete, cross-verified across 3 independent research agents plus direct investigation, with zero open contradictions. See the final report for the recommended FIRST pass.
