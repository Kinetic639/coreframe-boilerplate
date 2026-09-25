# Main → Presentation Build Drift Check — Plan Only (NOT Executed)

This is a planning document for a LATER, separate task. No merge, rebase, comparison checkout, or branch operation was performed while writing this plan.

## Why this is needed

This session's entire Zone 1 Phase 1-8 body of work happened on `zone3-zone5-integration-audit`, not on `main`. We already know `main` and this working branch have historically diverged, including the Dashboard — this working branch previously had an older `/dashboard/start` shape than what's understood to exist on `main`. Zone 1's own Phase 8 (once actually executed) certifies Zone 1 behavior on THIS branch/SHA only — it is not automatically true of whatever will actually ship to the presentation build if that build is cut from `main` or from a different integration point.

## Branches/SHAs to compare (once this later task runs)

- **Base:** `main` at its current tip (SHA to be recorded at execution time).
- **Candidate:** `zone3-zone5-integration-audit` at its tip after Phase 8 actually completes (currently `c300e0a7`, will move as Phase 8's real UAT work lands).
- Comparison should be a `git diff`/`git log --oneline main...zone3-zone5-integration-audit` (and the reverse, `zone3-zone5-integration-audit...main`) to see what each side has that the other doesn't — not just a one-directional diff, since `main` may have received its own independent commits since this branch diverged.

## Code areas likely divergent (informed guess, to verify at execution time, not asserted as fact here)

- **Dashboard/`_providers.tsx`/sidebar shell** — explicitly flagged already (older `/dashboard/start` shape on this branch vs. a presumably-updated one on `main`).
- **Any Zone 3/Zone 5 work** (RepairOrder, container workflow, receiving/putaway) that may have progressed independently on `main` or another branch while this session's work happened here — Zone 1's own Phase 6/7/8 work should be additive and low-conflict-risk (new files, small edits to `page.tsx`/`ambra-locations-client.tsx`/`public-token-resolver.ts`/`changeBranch.ts`/`target-registry.ts`), but this is exactly what the actual diff needs to confirm, not assume.
- **`packages/` shared code** (contracts, domain, i18n) — Zone 1's own work here was read-only (no `packages/` file was modified by any Zone 1 phase), so low risk, but should still be checked for independent `main`-side changes to the same permission constants/types Zone 1 now depends on (`BRANCHES_VIEW_UPDATE_ANY`, `BranchDataV2`, `PermissionSnapshot`).

## How to detect conflicting newer work

1. `git log main --oneline --since="<the date this branch diverged>"` — enumerate what actually landed on `main` independently.
2. Cross-reference against the file list Zone 1 Phases 1-7 touched (available in full in each phase's own `changed-files.md` under `docs/mvp/reviews/zone1-phase*`) — any overlap is a genuine merge-conflict risk, not just noise.
3. For any overlapping file, read both versions' actual diffs (not just "it changed") before deciding on integration order — a textual conflict and a semantic conflict (both sides "fixed" the same bug differently) need different resolutions.

## Safe integration order (proposed, to be confirmed at execution time)

1. Ensure Zone 1's own automated gate (Phase 7's regression suite) still passes against a merge-preview/rebase-preview of this branch onto `main`'s tip, BEFORE actually merging — i.e. do the comparison and conflict-resolution work on a disposable branch/worktree first.
2. Resolve any file-level conflicts favoring: (a) `main`'s own independent Dashboard/shell work where it doesn't touch Zone 1's own files, (b) this branch's own Zone 1 Phase 1-7 logic where the conflict is IN one of Zone 1's own files, since that logic has already passed its own extensive review/correction/regression cycle.
3. Only after a clean, conflict-resolved integration: re-run Phase 7's full regression suite (the exact 21-file/264-test set documented in `docs/mvp/reviews/zone1-phase7-automated-closeout-2026-09-24/full-regression-results.md`) against the INTEGRATED result, not just the pre-integration branch.
4. Only after THAT passes: re-attempt Phase 8's manual UAT (this runbook) against the integrated build — a Phase 8 pass on the pre-integration branch does not automatically carry over.

## Test suite to rerun afterward

The same 21-file Zone 1 regression set Phase 7 already established, plus (per this plan's own recommendation, not yet confirmed as required) a broader `pnpm type-check`/`pnpm lint` pass across the FULL integrated `apps/web` tree, since Dashboard/shell changes from `main` could introduce type or lint issues Zone 1's own narrower Phase 7 pass wouldn't have caught.

## Explicit non-scope of this document

This document does not perform, schedule, or authorize the actual integration. It exists so that "Zone 1 DEMO READY" (once genuinely reached) is not silently conflated with "the actual presentation build is ready" — those are two different claims, and this plan is the placeholder for the second one.
