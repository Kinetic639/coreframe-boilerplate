# Zone 1 / Phase 5 — Systematic Branch-State Re-Sweep — Review Context

**Date:** 2026-09-24
**Starting SHA:** 4ff02ce45ec973ebb2873e77c05c6f93dfbcf81d ("fix: make Matcher session cache branch-aware")

## Task

Verification-only phase proving Phases 1-4 closed the systemic branch-state/cache bug class described in the pre-implementation audit — not just the originally-known instances. Explicitly NOT a feature phase: no new implementation unless the re-sweep discovers an additional same-class bug clearly inside the accepted Phase 1-4 boundary.

## Method

Read the complete Phase 5 section of the implementation plan, the current tracker state, re-read `branch-state-cache-inventory.md` in full (the pre-implementation baseline), and the 4 prior phase closeout summaries. Then systematically re-swept:

1. Every `<DataView>` consumer in the current app (16 found via `grep -rln "<DataView<\|<DataView " src/`, not assumed to be only the 4 previously-known Warehouse ones).
2. Every query-key-factory module under `apps/web/src/hooks/queries/` (11 modules: `attachments`, `comments`, `help-desk`, `organization`, `tools`, `tools/wdd-matcher`, `user-preferences`, `v2/use-branch-permissions-query`, `warehouse/audits`, `warehouse/index`, `workshop`).
3. Every direct `invalidateQueries`/`setQueryData`/`getQueryData`/`removeQueries`/`prefetchQuery` call site app-wide (a single exhaustive grep, ~120 matches, individually reviewed).
4. Every `changeBranch(`/`setActiveBranch(` call site app-wide (4 total matches).
5. The RSC-rendered branch-bound detail routes named in the pre-implementation audit (RepairOrder list/detail, Movement detail/edit) — verified via `git log` that none have been touched since the audit.
6. The permission-context bridge (`PermissionsSync.tsx`, `use-branch-permissions-query.ts`) — verified via `git log` untouched since before Phase 1, plus a live test re-run.
7. Client-local/persistent state (`localStorage`/`sessionStorage` usage app-wide) for anything branch-sensitive that might survive a switch incorrectly.

## Files read

`docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` (Phase 5 section), `docs/mvp/zones/01-auth-org-branch-access-progress.md` (current state), `docs/mvp/reviews/zone1-preimplementation-verification-2026-09-23/branch-state-cache-inventory.md` (full re-read), and the 4 prior phase closeout bundles (`zone1-phase1-branch-transition-2026-09-24/`, `zone1-phase2-dataview-foundation-2026-09-24/`, `zone1-phase3-dataview-consumers-2026-09-24/`, `zone1-phase4-matcher-query-key-2026-09-24/`).

## Outcome

Zero new same-class bugs found. Zero runtime files changed. The systemic branch-state/cache bug class described in the pre-implementation audit is confirmed closed by Phases 1-4. See `branch-sensitive-surface-matrix.md`, `query-key-resweep.md`, `branch-switch-path-resweep.md`, `client-state-resweep.md`, and `permission-context-regression.md` for the full detail.

## Scope discipline maintained

Read-only code sweep + a full regression-suite re-run (no new tests, no runtime changes). No file under `apps/**` was created, modified, or deleted. Two documentation files updated (`01-auth-org-branch-access-implementation-plan.md`, `01-auth-org-branch-access-progress.md`). No DB/schema/RLS touched. Phase 6 not started. Zone 3 Phase 10D not started. No commit made for this pass.
