# Pitch Scope Impact — Dashboard/Container Product Clarification (2026-09-24)

## Explicit non-expansion (per the task's own Section 5 instruction)

This documentation pass does NOT:

- Make per-part QR a presentation blocker. (Confirmed explicitly out of pitch scope — see `container-product-decisions.md` §G.)
- Add standalone stock-unit QR to Phase 10D. (Phase 10D's own scope — `inventory.container` registry entry + container-detail screen — is unchanged.)
- Redesign Phase 10D/10E/10F implementation. (Small clarifying pointer notes only; zero task/acceptance-criteria changes to their actual content.)
- Add a new RepairOrder runtime phase. (The partial-move-creates-a-new-container gap (§C) is recorded as a planning finding only — no phase number, size, or schedule assigned.)

## Current pitch blocker list, after this clarification pass

Unchanged, except Dashboard removed:

1. Zone 1 — branch-switch/cache bugs. _(Phases 1-3 of this session's own Zone 1 work address this directly — Phase 1 [DONE], Phase 2 [DONE], Phase 3 [DONE, this session]; Phases 4-8 remain open.)_
2. Phase 10D — Container QR. NOT STARTED.
3. Receiving + mobile putaway UI. NOT STARTED.
4. Phase 10E — Container relocation (whole-container only, per this pass's own clarification). NOT STARTED.
5. Phase 10F — 201/WZ issue (whole and partial, per this pass's own clarification). NOT STARTED.

**Removed**: Zone 11 — minimal home dashboard (was PRESENTATION SHOULD-FIX #1). Product-owner decision: DEMO SUFFICIENT, no pitch work required.

**Not reopened**: Zone 10 (Notifications, still explicitly excluded), migration reproducibility (still Inventory Core's own accepted debt), `inventory_reverse_movement` UI (still not required), full Zone 1 pilot-grade hardening (still PILOT), permanent per-piece QR identity (still explicitly out — now further confirmed by this pass's own §G), full automated test coverage (still not the gate).

## New planning finding surfaced by this pass (not a blocker, not scheduled)

Partial-move-creates-a-new-container (container-product-decisions.md §C) has no existing phase, RPC, or design. It is NOT added to the pitch blocker list — the pitch's own accepted container scope (Phase 10D/10E/10F) does not require this flow; it is recorded purely so it isn't lost before a future pilot-scope planning pass considers it.

## Documents whose active-status content was corrected

- `docs/mvp/zones/11-home-operational-dashboard.md`
- `docs/mvp/mvp-readiness.md`
- `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/presentation-blockers.md`
- `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/presentation-ready-gate.md`
- `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/zone-readiness-matrix.md`
- `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/this-week-execution-plan.md`
- `docs/mvp/zones/03-repair-orders-container-workflow-audit.md`
- `docs/mvp/zones/03-repair-orders-implementation-plan.md`
- `docs/mvp/zones/03-repair-orders-progress.md`
- `docs/mvp/zones/03-05-integration.md`

## Documents checked, found already correct, left untouched

- `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/current-pitch-scope.md` — no Dashboard mentions; its own per-part-QR narrowing already matches this pass's §G exactly.
- `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/contradiction-resolution.md` — a frozen, dated review-bundle record of its own 2026-09-23 pass; left as historical evidence, not edited (this pass's own contradiction findings are recorded in this bundle's own `contradiction-resolution.md` instead).
- `docs/mvp/zones/03-repair-orders.md` — its CURRENT STATUS banner and Product decisions section are about RepairOrder identity/business-key decisions, not the container operating model; no material change needed.
