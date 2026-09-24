# Dashboard/Container Product Clarification — Changed Files

All changes are documentation-only edits to already-existing `.md` files, plus this new review bundle. No file under `apps/**`, `packages/**`, or `supabase/**` was created, modified, or deleted. No commit was made for this pass.

## Dashboard-side edits

1. `docs/mvp/zones/11-home-operational-dashboard.md` — new CURRENT STATUS banner (DEMO SUFFICIENT); prior 2026-09-23 findings preserved as HISTORICAL, not deleted; "CURRENT REMAINING WORK" cleared with the old list preserved in a collapsed HISTORICAL block; "Product decisions" and "Final pitch scope" sections filled in.
2. `docs/mvp/mvp-readiness.md` — Zone 11 table row corrected; "Presentation should-fix" bullet removed (HTML-comment note left in place); P1 priority table row corrected; "SHOULD FINISH BEFORE PITCH" item removed; Go/No-Go gate blocker list corrected; A2 (Pulpit startowy) manual-UAT scenario marked not required. Historical structural-reorganization narrative (the "Duża strukturalna reorganizacja" section explaining why Zone 11 was split out from former Zones 16/19) left untouched.
3. `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/presentation-blockers.md` — "Zone 11 minimal home dashboard" removed from PRESENTATION SHOULD-FIX, remaining items renumbered.
4. `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/presentation-ready-gate.md` — new correction banner added (prior 2026-09-23 banner preserved); Zone 11 item struck through and marked removed; estimated-work table row corrected.
5. `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/zone-readiness-matrix.md` — new CURRENT STATUS banner added above the existing Zone 11 section; existing 2026-09-23 findings relabeled HISTORICAL, preserved verbatim.
6. `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/this-week-execution-plan.md` — new correction banner added; Zone 11 table row removed; Zone 11 removed from the 2 execution-order list items that referenced it.

## Container-side edits

7. `docs/mvp/zones/03-repair-orders-container-workflow-audit.md` — Open Product Decision #6 (per-part QR) marked RESOLVED with a cross-reference; Open Product Decision #1 (relocation model) and #4 (empty container semantics) also marked RESOLVED (both already closed by existing Phase 10C/10E work, noted for completeness); new §31 "Product Clarification — Container Operating Model (2026-09-24)" section added, recording decisions A-G in full.
8. `docs/mvp/zones/03-repair-orders-implementation-plan.md` — small clarifying pointer notes added to Phase 10E's and Phase 10F's own sections, confirming their existing scope is correct and compatible with the new clarification; Phase 10E's note additionally flags the new partial-move-creates-a-new-container planning finding. Zero task list or acceptance-criteria changes.
9. `docs/mvp/zones/03-repair-orders-progress.md` — new "PRODUCT CLARIFICATION (2026-09-24)" banner added, following the file's own existing SCOPE CORRECTION/SCOPE EXPANSION banner convention. No phase status, task count, or change-log entry altered.
10. `docs/mvp/zones/03-05-integration.md` — one-sentence clarifying cross-reference added to the `uncontainerized` read-model consistency bucket's own existing description, distinguishing "normal transitional technical state" from "acceptable normal end state." The technical description itself is unchanged.

## New review bundle

11. `docs/mvp/reviews/dashboard-container-product-clarification-2026-09-24/` — `review-context.md`, `dashboard-current-status.md`, `container-product-decisions.md`, `container-user-flows.md`, `pitch-scope-impact.md`, `contradiction-resolution.md`, `changed-files.md` (this file), `diff.patch`.

## What was explicitly NOT changed

`docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/current-pitch-scope.md` (already correct, no Dashboard mentions, per-part-QR narrowing already matches). `docs/mvp/reviews/pitch-documentation-consolidation-2026-09-23/contradiction-resolution.md` (a frozen, dated record of its own past pass — left as historical evidence). `docs/mvp/zones/03-repair-orders.md` (its Product decisions section is about RepairOrder identity, not the container operating model). Any file under `docs/mvp/archive/`. Any runtime code, test, migration, RLS policy, or RPC. Any Supabase state (zero `execute_sql`/`apply_migration` calls made). Zone 1 Phase 4. Zone 3 Phase 10D/10E/10F implementation (documentation-only clarification, not implemented).
