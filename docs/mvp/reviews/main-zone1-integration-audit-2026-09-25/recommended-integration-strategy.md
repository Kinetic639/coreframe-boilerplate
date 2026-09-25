# Recommended Integration Strategy

**Not executed. Recommendation only, per the task's own explicit instruction.**

## Options compared

### A. Merge `origin/main` into the working branch first

Bring `origin/main`'s 17 new commits onto `zone3-zone5-integration-audit`, resolve the 8 real conflicts (per `three-way-resolution-matrix.md`) plus the 4 needed cleanups on the 6 clean-auto-merge files, verify with Zone 1's own full regression suite (already proven, already documented, already fast to re-run — see `post-integration-test-plan.md`) on THIS branch before it ever touches `main`. All 14 Zone 1 commits' own SHAs are preserved; a single new merge commit lands on top.

### B. Rebase the working branch onto `origin/main`

Same conflict set to resolve, but **rewrites all 14 Zone 1 commits' own SHAs**. This has a concrete, repo-specific cost: this session's own extensive review-bundle documentation (every `docs/mvp/reviews/zone1-phase*` file, the Phase 6/7/8 closeouts, the progress tracker's own detailed-tracking sections) cites exact commit SHAs by name — `55e20f0e`, `b017e662`, `c300e0a7`, `2593714c`, etc. — as evidence anchors throughout. A rebase invalidates every one of those citations, requiring a follow-up documentation pass just to keep the paper trail honest, on top of the conflict-resolution work itself.

### C. Fresh branch from `main` + cherry-pick the reviewed Zone 1 commits

Same SHA-rewriting cost as B (cherry-pick creates new commits), plus it does not actually reduce the conflict-resolution burden — the same 8 DataView/docs conflicts would resurface, just spread across up to 14 individual cherry-pick operations instead of being resolved once in a single merge. The task's own Section 10 suggests this option specifically for the case where "many unrelated main changes exist and Zone 1 commits are well isolated" — that precondition does NOT hold well here: the commits are well isolated from EACH OTHER, but the actual conflict (DataView) is not superficial/incidental, it is a genuine architectural overlap that needs the same careful three-way judgment call regardless of how the commits are replayed.

## Recommendation: **A — merge `origin/main` into the working branch first**

Reasoning, from the actual evidence gathered in this audit (not a generic best-practice default):

1. **Preserves history** — all 14 already-reviewed Zone 1 commits, and their SHAs, survive unchanged; this repo's own heavy SHA-citation documentation convention makes this a real, not theoretical, advantage.
2. **Minimizes conflict surface** — one merge, one round of conflict resolution, informed by the complete picture this audit already assembled, rather than 14 smaller conflict-resolution passes (C) or a rebase's own conflict-per-commit-replay behavior (B) hitting the same DataView files repeatedly.
3. **Avoids rewriting already-reviewed commits** — every Zone 1 phase's own commit was individually reviewed against its own explicit acceptance criteria before being committed (see each phase's own closeout doc). Rebasing/cherry-picking would silently re-open that already-closed question of "does this commit, in isolation, still make sense" for no benefit.
4. **Easy rollback** — the merge happens on the working branch, not on `main`. If post-merge verification (see `post-integration-test-plan.md`) finds a problem, the branch can be reset to its pre-merge tip (`2593714c`) with zero impact on `main` or on anyone else, since nothing has been pushed yet.
5. **Produces a clean presentation-build lineage** — once the merge is verified on the working branch, it becomes a single, well-tested, conflict-resolved commit (or small number of commits) ready to go into `main` via the normal PR process this repo already uses (every `origin/main`-side commit in `branch-divergence.md` arrived via a merged PR) — consistent with how this repo already integrates long-lived feature branches.

## What Option A does NOT resolve on its own

The DataView reconciliation (`three-way-resolution-matrix.md`'s main table) is genuine engineering work, not a mechanical merge — someone needs to actually apply "take main, drop Zone 1's superseded branchId mechanism" across 7 files plus the 4 follow-up cleanups, then verify. This recommendation is about HOW to structure the merge, not a claim that the merge itself is a one-click operation.
