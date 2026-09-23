# Presentation Ready Gate

Only what must exist to safely perform the internal pitch this week. Pilot-only requirements are explicitly excluded — see `pilot-ready-gate.md`.

## Current verdict: **NOT READY**

## PRESENTATION BLOCKERS (complete ordered list — must be resolved before rehearsal)

1. **Zone 1 — branch-switch cache/refresh bugs.** Three confirmed bugs (root cause: `SidebarBranchSwitcher` never refreshes/invalidates after switch) would show stale-branch data live on screen for Matcher sessions and all three flagship Warehouse lists. See `zone1-branch-switch-audit.md`. **Size: S** (one root-cause fix + 2 query-key corrections, proven pattern already exists in-codebase).
2. **Receiving + mobile putaway UI.** The current master script (`ambra-skrypt-prezentacji.md`, §7) explicitly demos a live phone flow (scan part/kit → scan location → confirm → close session → generate report). Backend (`receive_repair_order_stock`/`putaway_repair_order_stock`) is ready; **zero UI exists** — both mobile routes are confirmed placeholders. See `pitch-script-truth-matrix.md`. **Size: L** (new mobile-oriented screen(s), real scan/confirm flow, session-close, report generation from real movement/location data).
3. **Home dashboard is a 15-line empty placeholder.** The literal first screen after login. Zero scope decision made, zero implementation. See `zone-readiness-matrix.md` (Zone 11). **Size: M** (needs a scope decision FIRST, then a real-data server component — even a minimal, honest "quick links + recent activity" version is far better than the current blank welcome message).
4. **QR scope decision for parts/containers.** The script's own literal text ("skanuję część albo zestaw") implies part-level QR scanning, but no part/container QR target type exists (only location, ticket, task). The master tracker's OWN recommendation is to narrow the demo (pick from a list, scan only the destination location) rather than build this — **this is a decision, not necessarily a build item**, but it must be explicitly made and the script/choreography updated to match. **Size: XS** (decision + script wording update) OR **M** (if the decision is instead to build a minimal QR target type).
5. **201/WZ issue path.** The accepted design explicitly rejects using a 402 adjustment as a normal issue, but nothing from its own implementation plan is built — `issueStockAction` is a hardcoded stub. If the pitch's §10 "register an issue" step is performed live via the only working path today (generic movement editor), it will produce exactly the mislabeled 402 the design warns against. **Size: M** (seed 201/WZ movement type + minimal issue UI) OR **XS** (narrow the demo to not perform this step live, present it narratively instead).

## PRESENTATION SHOULD-FIX (ordered, materially reduces demo risk but not a hard blocker)

1. **Zone 6 — SKU search bug.** Product search matches name only, never SKU — a visible failure if the presenter searches by SKU on stage. **Size: XS.**
2. **Zone 6 — movement-kind label bug.** History never renders "transfer" for movement codes 801/311 due to a raw-code-vs-label string comparison bug. **Size: XS.**
3. **Zone 6 — missing `posted_by` in history.** Acting user never shown in location history — reduces the "who did what" story. **Size: XS.**
4. **Zone 4 — stale manual QR verification.** Last recorded manual pass is 6+ weeks old (2026-08-06), predates all the RepairOrder/Inventory-Core backend churn including IC-8/A7 container-ownership changes. Needs a fresh pass, not a code change. **Size: XS** (verification only).
5. **Zone 3 — fresh manual UAT for Phase 7+.** The RepairOrder tracker's own last entry (2026-09-15) still shows Phase 7's manual UAT outstanding. **Size: XS-S** (verification pass, possibly small bug-fixing if issues surface).
6. **Zone 2 — confirm whether the pitch script specifically demos the Approve→RepairOrder-materialization click**, not just Matcher session creation. If yes, this is functionally ready (real, tested) but has never been manually rehearsed. **Size: XS** (rehearsal/verification).

## OPTIONAL pitch polish

- Zone 8 (Tickets) — functional as-is; a short, narrow two-account demo scenario is safe without further work.
- Zone 9 (Planning) — at most one small, pre-verified example; does not need to extend beyond that.
- Zone 6 — container relocation UI: backend-only today; either build a minimal UI or explicitly keep the demo to single-part relocation (already functional).

## Explicitly NOT required for presentation-ready

- Zone 10 (Notifications) — DEFER, explicitly ROADMAP ONLY. **Presenter must not click into the notification bell** — it looks complete but shows entirely fabricated example data.
- Full migration reproducibility (Inventory Core's own accepted, deferred technical debt — see `docs/inventory/reviews/inventory-core-final-pilot-freeze/accepted-technical-debt.md`).
- `inventory_reverse_movement` UI — only relevant if the script demos correcting a posted mistake; current master script does not.
- Container QR/relocation permanent build — covered by the narrowing decision above.
- Any Zone 1 item beyond the pitch-path subset (last-owner protection, self-demotion guard, full privilege-escalation matrix, migration/schema-drift reconciliation — all explicitly listed as "NOT REQUIRED FOR DEMO READY" in Zone 1's own doc).
- Full automated test coverage for any zone — manual UAT of the exact demo path is what the gate requires, not test-suite completeness.

## Estimated remaining work (XS/S/M/L packages only, no time promises)

| Item                         | Size    | Parallelizable with other P0 items?                                                           |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| Zone 1 branch-switch fix     | S       | Yes — independent of all other blockers                                                       |
| Receiving/putaway mobile UI  | L       | Yes — independent, but the largest single item                                                |
| Home dashboard               | M       | Yes — independent                                                                             |
| QR scope decision            | XS or M | Decision first (XS), blocks nothing else; build (if chosen) can run parallel                  |
| 201/WZ issue path            | M or XS | Decision first, then parallel build or narrate-only                                           |
| Zone 6 small fixes (3 items) | XS each | Yes — fully independent, trivial                                                              |
| Zone 4 fresh QR manual pass  | XS      | Depends on nothing else being broken first — do last, after other Zone 4-touching work if any |
| Zone 3 fresh manual UAT      | XS-S    | Independent                                                                                   |

See `this-week-execution-plan.md` for the full sequenced, prioritized plan.
