# Presentation Ready Gate

Only what must exist to safely perform the internal pitch this week. Pilot-only requirements are explicitly excluded — see `pilot-ready-gate.md`.

> **CORRECTED 2026-09-23** (Final MVP/Pitch Documentation Consolidation pass) — two corrections from the original version of this gate: (1) Container QR (Phase 10D), container relocation (Phase 10E), and 201/WZ issue (Phase 10F) are **PITCH REQUIRED**, confirmed by the product owner's own 2026-09-10 scope-expansion directive — no longer presented as "narrow the script instead" optional decisions. (2) The home dashboard is reclassified from a hard blocker to **PITCH SHOULD / HIGH FIRST-IMPRESSION RISK** — the current master script does not itself require lingering on the dashboard screen.
>
> **CORRECTED AGAIN 2026-09-24** (Dashboard/Container Product Clarification pass) — the home dashboard's "PITCH SHOULD" item below (item 1 in "PRESENTATION SHOULD-FIX") is now **REMOVED**: product-owner decision, current dashboard experience is DEMO SUFFICIENT, no further work required before pitch. See `docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/dashboard-current-status.md`. The Phase 10D/10E/10F PITCH REQUIRED classification from the correction above is unchanged and unaffected by this pass.

## Current verdict: **NOT READY**

## PRESENTATION BLOCKERS (complete ordered list — must be resolved before rehearsal)

### 1. Zone 1 — branch-switch cache/refresh bugs

- **Current state**: `SidebarBranchSwitcher` never calls `router.refresh()`/invalidates React Query cache after a switch — breaks Matcher session history and all three flagship Warehouse lists (Locations/Movements/Balances).
- **Target state**: branch switch immediately refreshes all branch-scoped UI, no manual reload needed.
- **Dependency**: none — fully independent.
- **Size**: S.
- **Test required**: unit test on 2 affected query-key factories.
- **Manual UAT required**: YES — switch branch while parked on each affected screen (Matcher, Locations, Movements, Balances), confirm content updates without reload.
- **Done criterion**: all 3 confirmed bugs in `zone1-branch-switch-audit.md` fixed and manually re-verified on current build.

### 2. Phase 10D — Container QR

- **Current state**: NOT STARTED. QR target registry has exactly 3 types (location, ticket, task) — no container type.
- **Target state**: a container can be assigned/printed a QR label and scanned to resolve to its own contents view.
- **Dependency**: none technically (Inventory Core's `inventory_containers` model and QR platform both exist independently) — Inventory Core architecture change NOT expected (this is additive: a new QR target-registry entry + resolver, following the existing 3-type pattern).
- **Size**: M.
- **Test required**: unit test on the new registry entry/resolver; manual UAT.
- **Manual UAT required**: YES, on presentation phone.
- **Done criterion**: container QR create→print→scan→resolve cycle works end-to-end on the presentation device.

### 3. Receiving + mobile putaway UI

- **Current state**: `receive_repair_order_stock`/`putaway_repair_order_stock` RPCs ready and tested; zero UI. Mobile routes are confirmed placeholders.
- **Target state**: a real mobile flow — select delivery item → scan destination location → confirm → close session → generate report from real movement/location data.
- **Dependency**: none technically; sequence after item 1 (branch-switch fix) so its own UAT isn't confounded by a stale-branch display bug.
- **Size**: L — the largest single item.
- **Test required**: lightweight Vitest for new actions' request validation; manual phone UAT (mandatory, this is a live phone demo item).
- **Done criterion**: full scan→confirm→close→report cycle performed live on the presentation phone with real data.

### 4. Phase 10E — Container relocation

- **Current state**: NOT STARTED. `relocateContainerAction` exists server-side, zero UI callers.
- **Target state**: scan container QR → scan new location → contents relocate together.
- **Dependency**: Phase 10D (container QR) must land first — relocation via QR scan needs the QR target to exist.
- **Size**: S-M (backend RPC already exists; this is UI wiring, once Phase 10D provides the QR scan entry point).
- **Test required**: manual UAT.
- **Done criterion**: container relocation performed live via QR scan on the presentation device.

### 5. Phase 10F — 201/WZ issue

- **Current state**: NOT STARTED. `issueStockAction` is a hardcoded stub. The accepted design explicitly rejects a 402-adjustment workaround.
- **Target state**: a real issue operation via movement type 201/WZ, with a recipient field.
- **Dependency**: none technically — additive (new movement type + field policy), matching the accepted design's own scope; no Inventory Core architecture change.
- **Size**: M.
- **Test required**: a couple of pgTAP/Vitest cases + manual UAT.
- **Done criterion**: a live issue operation recorded via 201/WZ (not 402) with a real recipient, on stage.

## PRESENTATION SHOULD-FIX (ordered, materially reduces demo risk but not a hard blocker)

1. ~~**Zone 11 — minimal home dashboard.**~~ **REMOVED 2026-09-24** — product-owner decision: DEMO SUFFICIENT, no pitch work required. See `docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/dashboard-current-status.md`.
2. **Zone 6 — SKU search bug.** Product search matches name only, never SKU. **Size: XS.**
3. **Zone 6 — movement-kind label bug.** History never renders "transfer" for codes 801/311. **Size: XS.**
4. **Zone 6 — missing `posted_by` in history.** **Size: XS.**
5. **Zone 4 — stale manual QR verification.** Last recorded pass is 6+ weeks old. **Size: XS** (verification only).
6. **Zone 3 — fresh manual UAT for Phase 7+.** **Size: XS-S.**
7. **Zone 2 — confirm/rehearse the Approve→RepairOrder-materialization click**, not just Matcher session creation. **Size: XS** (rehearsal).

## OPTIONAL pitch polish

- Zone 8 (Tickets) — functional as-is; a short, narrow two-account demo scenario is safe without further work.
- Zone 9 (Planning) — at most one small, pre-verified example; does not need to extend beyond that.

## Explicitly NOT required for presentation-ready

- Zone 10 (Notifications) — DEFER, explicitly ROADMAP ONLY. **Presenter must not click into the notification bell** — it looks complete but shows entirely fabricated example data.
- Full migration reproducibility (Inventory Core's own accepted, deferred technical debt).
- `inventory_reverse_movement` UI — only relevant if the script demos correcting a posted mistake; current master script does not.
- Any Zone 1 item beyond the pitch-path subset (last-owner protection, self-demotion guard, full privilege-escalation matrix, migration/schema-drift reconciliation).
- Full automated test coverage for any zone — manual UAT of the exact demo path is what the gate requires, not test-suite completeness.
- Permanent per-piece QR identity — the accepted architecture explicitly does not require this (containers/locations are the QR identity units).

## Estimated remaining work (XS/S/M/L packages only, no time promises)

| Item                                             | Size    | Dependency                                     | Parallelizable? |
| ------------------------------------------------ | ------- | ---------------------------------------------- | --------------- |
| Zone 1 branch-switch fix                         | S       | None                                           | Yes             |
| Phase 10D Container QR                           | M       | None                                           | Yes             |
| Receiving/putaway mobile UI                      | L       | None (sequence after Zone 1 fix for clean UAT) | Yes             |
| Phase 10E Container relocation                   | S-M     | Phase 10D                                      | No — after 10D  |
| Phase 10F 201/WZ issue                           | M       | None                                           | Yes             |
| ~~Zone 11 minimal dashboard~~ REMOVED 2026-09-24 | —       | —                                              | —               |
| Zone 6 small fixes (3 items)                     | XS each | None                                           | Yes             |
| Zone 4 fresh QR manual pass                      | XS      | Ideally after Zone 1 fix                       | Mostly          |
| Zone 3 fresh manual UAT                          | XS-S    | None                                           | Yes             |
| Zone 2 Approve-flow rehearsal                    | XS      | None                                           | Yes             |

See `this-week-execution-plan.md` for the full sequenced, prioritized plan.
