# RepairOrder + Matcher Fixture Plan (Proposal Only — Nothing Created)

## Scope note (important)

Per `current-pitch-scope.md` and `presentation-ready-gate.md` (both read as authoritative for this plan): RepairOrder creation and Matcher-session materialization are confirmed **already live and working** ("RepairOrder materialization [LIVE DEMO — real, working]"; Zone 3's own progress tracker confirms the manual-creation flow, header/advisor/lifecycle, and approve→materialize orchestration are "live and tested against real data"). This plan is scoped to fixtures for THAT already-working slice only. It deliberately does **not** attempt to provision reservation, allocation, container, container QR, container relocation, or 201/WZ issue fixtures — those features are `NOT STARTED` (Phase 10D/10E/10F, per `presentation-ready-gate.md`, last verified 2026-09-23/24) and there is nothing yet to fixture. That work is Zone 3/Zone 5 scope, explicitly out of bounds for this Zone 1 task.

## RepairOrder

**One coherent RepairOrder**, not scattered unrelated records, per this task's own preference:

- **Branch:** Warszawa (the branch the Presenter/Admin starts in and where most of the live narrative happens).
- **Recognizable reference/number:** a clearly demo-flagged reference, e.g. `RO-DEMO-001` (or whatever format the real `RepairOrder` reference-number generator produces — TO VERIFY DURING EXECUTION which format the app assigns automatically vs. accepts as input).
- **Lines/parts required:** 2 lines, each referencing one of the 3 demo products from `warehouse-fixture-plan.md` (e.g. AMB-DEMO-001 x2, AMB-DEMO-002 x1) — enough to look like a real repair order, not so many that the live demo has to scroll past irrelevant rows.
- **Current lifecycle state before future container work:** created and — per the chosen choreography — either left at "awaiting materialization" (if the Matcher→materialize step is meant to be performed LIVE during the actual presentation, matching `presentation-demo-setup.md`'s own "One Matcher source session that materializes into the RepairOrder above | CREATE DURING DEMO — this is the live-demoed step itself") or already materialized (if Phase 8's own RSC/detail-redirect test, Scenario 10, needs a stable, already-existing RepairOrder detail page to open and then switch away from, independent of whether the live pitch performs materialization again). **Recommendation: create the RepairOrder itself ahead of rehearsal, but perform the actual Matcher-approval-to-materialization step live during the real presentation**, exactly as `presentation-demo-setup.md` already specifies — Phase 8's own UAT can use a SEPARATE, already-materialized copy (or simply open the RepairOrder in its pre-materialization state, since Scenario 10 only needs a RepairOrder DETAIL page to exist and be safely abandoned on a branch switch, not a materialized one specifically).

## Matcher sessions

Phase 8's own Scenario 11 requires "recognizable Matcher sessions in both branches":

- **Branch A (Warszawa):** one session, clearly the "real" one — either the source session that will (or already did) materialize into the RepairOrder above, or a second, simpler example if the live materialization needs to stay unconsumed until the actual presentation.
- **Branch B (Kraków):** one session, deliberately distinct (different source data / different recognizable content) from the Warszawa one — its only job is to prove the session list genuinely changes on branch switch, not that it demonstrates the full materialization flow again.

## Source input needed

A Matcher session is created from a real uploaded source document (per the pitch's own "public Matcher" step — physical source documents get uploaded/matched). **Exact input needed:** a representative source document (e.g. a scanned/PDF delivery note or purchase order) matching the 3 demo products' names/SKUs closely enough that the Matcher's own matching logic produces a clean, presentable result. TO VERIFY DURING EXECUTION with whoever owns the Matcher's actual input format — this plan does not fabricate a specific document, since getting the matching-quality right (so the live demo doesn't show an ugly low-confidence match) benefits from a human's involvement or at least a real example already used in rehearsal.

## Creation method

- RepairOrder: Category A (existing UI — the "full RepairOrder header/advisor/lifecycle/manual-creation flow" Zone 3's own tracker confirms is live).
- Matcher sessions: Category A (existing UI — public + persistent/authenticated Matcher, per `current-pitch-scope.md`'s own "[LIVE DEMO]" tagging for both).
- No direct SQL needed for either.
