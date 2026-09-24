# Dashboard / Container Product Clarification — Review Context

**Date:** 2026-09-24
**Type:** Documentation-only product-decision update. No runtime code, tests, migrations, RLS, RPCs, or Supabase state touched.

## Task

Record two explicit product-owner clarifications that supersede older documentation assumptions:

1. **Dashboard presentation readiness** — the current dashboard is accepted as DEMO SUFFICIENT for the pitch; no further implementation work is required beforehand.
2. **Container / RepairOrder stock operating model** — a set of accepted rules governing how RepairOrder-assigned stock must be containerized, moved, split, and issued.

This pass follows Zone 1 Phase 3's own commit (`16947e19953a2c9ef872c1df30a9943a592bbc84`, "fix: wire branch-aware DataView consumers") in the same session; the working tree was clean before this documentation pass began.

## Method

**Dashboard side**: read `docs/mvp/zones/11-home-operational-dashboard.md` in full, then live-reverified the actual current code state of `/dashboard/start/page.tsx` (unchanged since 2026-03-21 — still a 15-line static placeholder) before accepting the product-owner's claim at face value, since the claim described a materially richer dashboard than the documented code state. Reconciled by distinguishing "the dashboard _experience_" (org/branch context in the shell, `DashboardStatusBar.tsx`'s real activity feed, adjacent real modules — Kanban board, Tickets, Planning/Tasks, all confirmed to exist via code search) from "the literal `/dashboard/start` landing route" (confirmed still a placeholder) — the product-owner's acceptance decision is read as applying to the former, and is recorded as such; the underlying code fact about the latter is preserved as historical evidence, not overwritten.

Then read/searched `mvp-readiness.md`, `presentation-blockers.md`, `presentation-ready-gate.md`, `current-pitch-scope.md`, `zone-readiness-matrix.md`, `this-week-execution-plan.md`, `contradiction-resolution.md` for every active-status claim about Zone 11/Dashboard, correcting active-plan content while preserving historical/structural-reorganization narrative untouched.

**Container side**: read the existing Phase 10C/10D/10E/10F sections of `03-repair-orders-implementation-plan.md` in full, and the "Open Product Decisions" (§29) section of `03-repair-orders-container-workflow-audit.md`, to determine which of the 7 accepted product-owner decisions (2A-2G) are: (a) already consistent with existing accepted architecture/implementation (2D, 2E, 2F, most of 2G), (b) genuinely new clarifications not previously contradicted by anything (2A, 2B), or (c) expose a genuine workflow gap not covered by any existing phase (2C — partial-move-creates-a-new-container). Searched `03-05-integration.md`, `03-repair-orders.md`, `03-repair-orders-progress.md`, and active pitch-scope documents for stale "store loose"/"uncontainerized"/"per-part QR" claims.

## Files read

**Dashboard:** `docs/mvp/zones/11-home-operational-dashboard.md`, `docs/mvp/mvp-readiness.md`, `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/presentation-blockers.md`, `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/current-pitch-scope.md`, `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/contradiction-resolution.md`, `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/presentation-ready-gate.md`, `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/zone-readiness-matrix.md`, `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/this-week-execution-plan.md`, plus live code: `apps/web/src/app/[locale]/dashboard/start/page.tsx`, `apps/web/src/components/Dashboard/` (`DashboardStatusBar`), Kanban/Teams module presence (`src/components/primitives/kanban/`, `src/server/services/kanban-boards.service.ts`).

**Containers:** `docs/mvp/zones/03-repair-orders.md` (Product decisions section, CURRENT STATUS banner), `docs/mvp/zones/03-repair-orders-implementation-plan.md` (Phase 10C/10D/10E/10F in full), `docs/mvp/zones/03-repair-orders-progress.md` (top banners, SCOPE EXPANSION/CORRECTION sections), `docs/mvp/zones/03-repair-orders-container-workflow-audit.md` (full — Executive Conclusion, §7 Part Label vs Container QR, §21-23, §29 Open Product Decisions), `docs/mvp/zones/03-05-integration.md`, `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/current-pitch-scope.md`.

## Scope discipline maintained

Docs-only. No file under `apps/**`, `supabase/**`, or `packages/**` touched. No new implementation phase invented for the discovered partial-move-creates-a-new-container gap — recorded as a planning finding per explicit instruction, with no task breakdown or RPC design attempted. Zone 1 Phase 4 not started. Zone 3 Phase 10D/10E/10F not started (task wording clarified, no new tasks added, no existing tasks removed). No commit made for this pass.
