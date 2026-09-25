# Changed Files

All changes are documentation-only (`docs/**` exclusively). Zero application/runtime code, migrations, SQL, RPCs, RLS, tests, or config/package files touched. Zero live database mutation.

## Modified (14 files)

- `docs/mvp/ambra-skrypt-prezentacji.md` — the current master script, corrected: QR scope (locations+containers, not parts), putaway mechanic (list-selection, not part-scan), a new container-QR relocation flow, 201/WZ issue reference, unwired ticket↔RepairOrder linking claim removed, every section tagged LIVE DEMO/NARRATIVE/ROADMAP.
- `docs/mvp/mvp-readiness.md` — new top `# Current status — 2026-09-23` section (Goal/verdict/architecture status/blockers/should-fix/optional/excluded/11-zone matrix) replacing the prior pass's simple banner; corrected the "Otwarte decyzje zakresu" section's container-QR/relocation recommendations (build, not narrow) and the "CAN REMAIN PARTIAL" section's container-relocation entry.
- `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/documentation-ownership.md`, `pilot-ready-gate.md`, `pitch-script-truth-matrix.md`, `presentation-ready-gate.md`, `this-week-execution-plan.md`, `zone-readiness-matrix.md` — all corrected in place per the resolved container-QR/relocation/issue scope decision and the reconciled RepairOrder Phase 14/15 pilot scope; the home-dashboard classification corrected from blocker to should-fix throughout.
- `docs/mvp/zones/03-repair-orders-progress.md` — header corrected: "Phase 10D READY TO START" replacing "BLOCKED ON INVENTORY CORE CONSOLIDATION"; explicit 10A-13 phase-state line added; "Last updated" corrected.
- `docs/mvp/zones/03-repair-orders.md`, `05-receiving-putaway.md`, `07-normal-issue.md`, `11-home-operational-dashboard.md` — banners upgraded to the full `# CURRENT STATUS` / `# CURRENT REMAINING WORK` / `# HISTORICAL AUDIT / DESIGN RECORD` structure (previously single-paragraph notices from the prior pass).
- `docs/mvp/zones/04-locations-qr-labels.md`, `06-search-relocation-history.md` — newly normalized this pass with the same 3-section structure (not touched in the prior pass).

## New (2)

- `docs/mvp/presentation-demo-setup.md` — the new current demo-org/data/accounts/devices setup document, superseding `mvp-readiness-test-org-setup.md`.
- `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/` — this bundle (8 files: `review-context.md`, `contradiction-resolution.md`, `documentation-ownership.md`, `current-pitch-scope.md`, `presentation-blockers.md`, `pilot-scope-reconciliation.md`, `changed-files.md` (this file), `diff.patch`).

## Not changed

Zero application/runtime code (`apps/web`, `apps/public-web`), zero migrations, zero RLS/RPC definitions, zero test files, zero config/package files. Zone 1's own tracker (`01-auth-org-branch-access.md`) was re-verified as already carrying an equivalent native structure and required no edit. Zones 2, 8, 9, 10 were not restructured (outside this task's own "especially fully normalize" list) — their existing status, re-verified CURRENT in the prior pass, needed no correction.
