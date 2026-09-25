# Branch Divergence

Comparison source: `origin/main` (local `main` is stale — see `starting-state.md`). Merge-base: `0eb58f2e`.

## Commits only on the working branch since merge-base: 14

```
2593714c docs: plan the presentation demo environment for Zone 1 Phase 8
c300e0a7 docs: record Zone 1 manual UAT gate
b017e662 test: close Zone 1 automated demo gate
55e20f0e fix: complete cross-branch location QR flow
9ecb08d1 docs: close Zone 1 systematic branch-state resweep
4ff02ce4 fix: make Matcher session cache branch-aware
713b2d53 docs: dashboard demo-sufficient decision and container operating model clarification
16947e19 fix: wire branch-aware DataView consumers
02992cbc fix: add branch-aware DataView query-key foundation
10bc8dc4 fix: complete Zone 1 centralized branch transition
3e7ffce0 docs: add Zone 1 implementation plan and progress tracker
5dfce9d3 docs: Zone 1 pre-implementation verification
1524e218 docs: final MVP/pitch documentation consolidation
b926f1c5 docs: re-baseline Ambra pitch readiness
```

All 14 are this session's own Zone 1 Phase 0-8 work (plus the immediately-preceding pitch-documentation consolidation pass) — fully sequential, each already reviewed via its own dedicated review bundle under `docs/mvp/reviews/zone1-*`.

## Commits only on `origin/main` since merge-base: 17

```
a9318571 Merge pull request #433 from Kinetic639/zone3-zone5-integration-audit
a106a1bc Merge pull request #432 from Kinetic639/codex/frontend-polish
bde5f453 dataview refactor phase 1
be2bf1ca Merge pull request #431 from Kinetic639/mvp-readiness
811a2592 Merge pull request #430 from Kinetic639/codex/zone11-home-dashboard
5a2e6a77 chore: ignore local browser debug log
c1cd50d0 chore: remove generated browser debug output
6cb0ecd8 Merge pull request #429 from Kinetic639/mvp-readiness
19f25a30 Merge pull request #428 from Kinetic639/codex/zone11-home-dashboard
d3e80c4e feat(dashboard): refine operational home dashboard
158fa79a feat(dashboard): refine operational home dashboard
7ed2eb68 Merge pull request #427 from Kinetic639/mvp-readiness
bfa22649 Merge pull request #426 from Kinetic639/codex/zone11-home-dashboard
da512d18 feat(dashboard): refine operational home dashboard
4adf3c71 Merge pull request #425 from Kinetic639/pitch/zone8-tickets
a5502990 Zone 8 (Tickets): fix ticket-number search, harden or() filter escaping
cd534560 Merge pull request #423 from Kinetic639/mvp-readiness
```

Three independent workstreams, none of them Zone 1: (1) `bde5f453` "dataview refactor phase 1" — a significant DataView architecture change (see `conflict-files.md`/`three-way-resolution-matrix.md`); (2) `da512d18`/`158fa79a`/`d3e80c4e` "refine operational home dashboard" (3 commits) — the Zone 11 home dashboard rebuild referenced in the task itself; (3) `a5502990` — a small Zone 8 (Tickets) search/filter fix. The rest are merge commits and housekeeping (`mvp-readiness` doc merges, a debug-log gitignore fix).

## Changed-file counts

- Working branch only: **178 files**.
- `origin/main` only: **105 files**.
- Changed on **both** sides (conflict-risk group): **14 files** — see `conflict-files.md`.
