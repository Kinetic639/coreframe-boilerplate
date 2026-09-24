# Zone 1 / Phase 7 — Automated DEMO READY Closeout — Review Context

**Branch:** zone3-zone5-integration-audit
**Phase 6 commit SHA (starting point for Phase 7):** 55e20f0ec5648ebd79cbbb01ccefdbcaeec1ad88 ("fix: complete cross-branch location QR flow")
**Phase 7 start date:** 2026-09-24
**Working tree at Phase 7 start:** clean (confirmed via `git status --porcelain`)

## Starting state confirmed

- Phases 1-6: ✅ DONE (Phase 6 including its same-day correction pass), all committed up to and including `55e20f0e`.
- Phase 7: NOT STARTED at the beginning of this pass.
- Phase 8: NOT STARTED.
- Phase 10D: NOT STARTED, zero related files touched by any Zone 1 phase to date.

## Objective (per the implementation plan)

All Zone-1-relevant automated tests pass (or are correctly classified as pre-existing/unrelated), `pnpm type-check` and `pnpm lint` are clean, and the 2 confirmed Zone-1-relevant test/mock-drift failures found in the pre-implementation audit (BLOCKER-Z1-005) are fixed.

## Scope boundaries (explicit, from both the plan and the task)

- This is a verification/test-closeout phase — no new features, no manual UAT (that's Phase 8), no Phase 10D work.
- Fix ONLY confirmed test/mock/fixture drift. Do NOT modify runtime code to satisfy a stale test. Do NOT weaken any assertion.
- Do NOT fix the unrelated nuqs/parseAsJson library issue (BLOCKER-Z1-017) — document it, don't touch it.
- Do NOT fix `organization-rls-integration.test.ts`'s env-loading gap (PILOT Phase G) or the unrelated `rls-permission-invariants.test.ts` VMI-wildcard test.
- Do NOT close any PILOT blocker (BLOCKER-Z1-006 through 013) — they remain open/deferred by design.
- No DB/schema/RLS changes.

## Documents read in full before starting

- `docs/mvp/zones/01-auth-org-branch-access-implementation-plan.md` — Phase 7's complete section (Objective, Repository areas affected, Implementation tasks, Acceptance criteria, Out of scope, Blocker rule).
- `docs/mvp/zones/01-auth-org-branch-access-progress.md` — current tracker state, BLOCKER-Z1-005's full description, the "Active blockers" section in full.

## Files this phase is expected to touch (per the plan's own "Repository areas affected")

- `apps/web/src/server/services/__tests__/organization-rls.test.ts`
- `apps/web/src/server/loaders/v2/__tests__/load-app-context.v2.test.ts`

Plus the progress tracker and this review bundle. No other files.
