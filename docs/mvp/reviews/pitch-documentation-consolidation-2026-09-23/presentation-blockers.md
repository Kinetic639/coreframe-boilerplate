# Presentation Blockers — Final, Corrected List

Consolidates `presentation-ready-gate.md` (rewritten this pass) into a single reference. Full detail, sizes, dependencies, and done-criteria are in that file — this is the summary.

## PRESENTATION BLOCKERS (ordered)

1. **Zone 1 — branch-switch/cache bugs.** Root cause: `SidebarBranchSwitcher` never refreshes/invalidates after a switch. Breaks Matcher session history + all 3 Warehouse lists. Size S.
2. **Phase 10D — Container QR.** PITCH REQUIRED (confirmed 2026-09-10 directive). NOT STARTED. Size M.
3. **Receiving + mobile putaway UI.** Unconditional blocker — current script demos this live. Backend ready, zero UI. Size L.
4. **Phase 10E — Container relocation.** PITCH REQUIRED (same directive). Backend ready, zero UI. Depends on Phase 10D. Size S-M.
5. **Phase 10F — 201/WZ issue.** PITCH REQUIRED (same directive). `issueStockAction` is a stub. Size M.

## PRESENTATION SHOULD-FIX

<!-- "Zone 11 minimal home dashboard" removed 2026-09-24 — product-owner decision: current dashboard is DEMO SUFFICIENT, no pitch work required. See docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/dashboard-current-status.md. -->

1. Zone 6 SKU search fix. Size XS.
2. Zone 6 movement-kind label fix. Size XS.
3. Zone 6 `posted_by` history display. Size XS.
4. Zone 4 fresh QR manual UAT (6+ weeks stale). Size XS.
5. Zone 3 fresh Phase 7+ manual UAT. Size XS-S.
6. Zone 2 Approve→RepairOrder rehearsal. Size XS.

## OPTIONAL

- Zone 8 (Tickets) narrow demo.
- Zone 9 (Planning) narrow demo.

## Explicitly excluded from presentation-ready

- Zone 10 (Notifications) — must not be demoed.
- Migration reproducibility (Inventory Core accepted debt).
- `inventory_reverse_movement` UI.
- Full Zone 1 pilot-grade hardening.
- Permanent per-piece QR identity.
- Full automated test coverage.

## Correction from the prior pass

The prior pass (`pitch-readiness-rebaseline-2026-09-23/presentation-ready-gate.md`, original version) presented container QR/relocation/issue as optional "narrow the script instead" decisions and classified the home dashboard as a hard blocker. Both are corrected in this pass — see `current-pitch-scope.md` and `contradiction-resolution.md` for the full reasoning.
