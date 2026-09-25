# Zone 1 / Phase 8 — Manual DEMO READY UAT — Closeout

**Branch:** zone3-zone5-integration-audit
**Phase 7 commit SHA (starting point):** b017e6622e584ffcfb6fffb0d8917bd919b76b9b
**Tested application SHA:** b017e662 (same — no code changes made or needed this phase)
**Date:** 2026-09-24

## Summary

Phase 8 was started per Phases 1-7 all being complete, committed, and green. Two hard blockers prevented executing the actual required manual scenarios:

1. **No prepared demo environment exists.** `presentation-demo-setup.md`'s own required org/branches/accounts/data are all still marked `CREATE BEFORE REHEARSAL` — confirmed via a read-only check of the live target Supabase project, which contains only unrelated scratch/test organizations.
2. **No physical presentation phone or interactive browser is available to this agent.** This is a hard capability boundary of a headless, terminal-only agent — not something resolvable within this session regardless of environment prep.

Given these, **zero of the 17 required manual scenarios could be genuinely executed and marked PASS.** Per the task's own explicit instruction ("If you cannot physically perform a required human/device step: DO NOT mark it PASS... Mark it: AWAITING HUMAN UAT"), all 17 are marked AWAITING HUMAN UAT, not PASS, not FAIL.

This agent did perform the "Claude-executable" subset explicitly permitted by the task (Section 2A): started the local dev server against the exact tested SHA, connected to the real Supabase project, and ran a small number of environment-independent, non-authenticated route checks confirming the app boots and serves correctly, and that specific Phase 6/6-correction code paths (the `returnUrl` hidden-field mechanism, the QR `TARGET_NOT_FOUND` render path, the dashboard auth gate) execute correctly against live infrastructure. See `desktop-browser-results.md`. Zero bugs found in what was actually checked (see `bugs-found.md`).

## Ending working-tree state

- `docs/mvp/zones/01-auth-org-branch-access-progress.md` — Phase 8 marked 🔵 AWAITING HUMAN UAT (not DONE), evidence recorded.
- `docs/mvp/reviews/zone1-phase8-manual-uat-2026-09-24/` — this UAT bundle (10 files, all with either genuine evidence or explicit pending instructions — no fabricated results).

No runtime code was touched. No DB/schema/RLS changes. No new organization, branch, user, or data created in the live Supabase project.

## Acceptance criteria (per the task's own 16-item list)

1. Sidebar A→B switch passes. **AWAITING HUMAN UAT.**
2. Sidebar B→A switch passes. **AWAITING HUMAN UAT.**
3. Permission context changes correctly. **AWAITING HUMAN UAT.**
4. Locations branch data changes correctly. **AWAITING HUMAN UAT.**
5. Inventory Balances changes correctly. **AWAITING HUMAN UAT.**
6. Inventory Movements changes correctly. **AWAITING HUMAN UAT.**
7. Inventory Products changes correctly. **AWAITING HUMAN UAT.**
8. RepairOrder/RSC safe redirect passes. **AWAITING HUMAN UAT.**
9. Matcher session history/list switches correctly. **AWAITING HUMAN UAT.**
10. Same-branch QR passes on actual presentation phone. **AWAITING HUMAN UAT.**
11. Accessible cross-branch QR confirm/cancel passes on actual presentation phone. **AWAITING HUMAN UAT.**
12. Inaccessible cross-branch QR safe denial passes. **AWAITING HUMAN UAT** (high automated confidence — see `mobile-qr-results.md` — but not manually verified).
13. Logged-out QR return preserves target. **AWAITING HUMAN UAT** (medium-high automated confidence, plus one genuine live-server confirmation of the returnUrl mechanism — see `desktop-browser-results.md` §3 — but the full login round trip was not manually verified).
14. No critical browser-console/network failure observed. **PARTIALLY ADDRESSED** — no failures observed in the small non-authenticated subset checked; the interactive/authenticated flows were not observable by this agent. See `console-network-observations.md`.
15. No open DEMO blocker remains. **TRUE for automated/code-level blockers** (Phase 7 closed all of those) — but this criterion cannot be fully certified until the manual scenarios above actually run, since that's precisely how a DEMO blocker not visible to automated tests would be found.
16. Phase 10D remains NOT STARTED. **PASS** — confirmed, zero related files touched.

**Net result: this phase cannot be marked DONE.** 0 of the 13 scenario-dependent criteria (1-13) can be marked PASS; criteria 14-16 are partially/fully satisfied within this agent's actual capability.

## Mechanical task count

Phase 8's own 5 implementation tasks from the plan:

- [ ] Prepare accounts per `docs/mvp/presentation-demo-setup.md` — **NOT DONE** (not attempted unilaterally; see `uat-environment.md`'s recommendation).
- [ ] Execute the integrated "Gate to DEMO READY" scenario — **NOT DONE** (no environment to execute it in).
- [ ] Execute on the actual presentation laptop — **NOT DONE** (no access).
- [ ] Execute the QR/login-path portion on the presentation phone — **NOT DONE** (no access).
- [ ] Record date/build/environment/accounts/PASS-FAIL per step — **PARTIALLY DONE** (this bundle records the actual, honest state: pending, not fabricated results).

0/5 (task list unchanged from NOT STARTED — this pass could not complete any of the 5 tasks as written, since all require the environment/device access this agent doesn't have).

## Zone 1 status after this phase

**NOT DEMO READY.** Per Zone 1's own "Status change rules," passing automated tests (Phase 7) cannot promote DEMO READY on their own — only this manual pass can, and it has not yet run. Zone 1 remains at the state Phase 7 left it: all automated/code-level PITCH blockers resolved, awaiting the human manual verification gate.

## Confirmation: Phase 10D NOT started

No `apps/web/src/**` file related to Container QR / Zone 3 Phase 10D was touched.

## Confirmation: no PILOT blockers touched

No PILOT-track blocker (BLOCKER-Z1-006 through 013) was fixed or its status changed.

## Confirmation: no merge/rebase of main occurred

This phase made no git operations beyond starting/stopping a local dev server and reading files; `git status`/`git log` confirm no branch changes, no merges, no rebases.

## Explicit note on the main/presentation-build distinction (per the task's Section 20)

This phase certifies (or, in this case, attempted to certify) Zone 1 behavior on branch `zone3-zone5-integration-audit` at SHA `b017e662` only. It does not certify, and is not a substitute for, the separate main → presentation-build integration/drift check the task explicitly calls out as still outstanding. DEMO READY (if and when achieved) on this branch/SHA is not the same claim as final presentation-build readiness.
