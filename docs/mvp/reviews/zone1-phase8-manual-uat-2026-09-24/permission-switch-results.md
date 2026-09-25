# Zone 1 / Phase 8 — Permission-Switch Results

**Status: AWAITING HUMAN UAT — not executed.**

## Blocker

This scenario (Section 5 of the task) requires two accounts whose roles differ by branch — e.g. Manager-level access on Branch A, Warehouse-Worker-level (narrower) access on Branch B for the same user, or two accounts demonstrating the contrast. Per `uat-environment.md`, no such accounts exist in any org in the live target Supabase project today; `presentation-demo-setup.md`'s own presenter/warehouse-worker/advisor accounts are all still marked `CREATE BEFORE REHEARSAL`.

## Action required of the human tester

1. Ensure the presentation environment exists (see `uat-environment.md`) with a user holding branch-scoped roles that genuinely differ between Branch A and Branch B (or two separate accounts if that's the chosen demo choreography).
2. Log in as that user/account while active in Branch A. Note which actions/navigation items are visible (the broader role).
3. Switch to Branch B via the SidebarBranchSwitcher.
4. Verify, without any manual page reload or re-login:
   - The active branch indicator updates to B.
   - Navigation/available actions visibly change to reflect B's narrower permission set.
   - Any Branch-A-only action is no longer available or authoritative (e.g., a button that was clickable under the Branch-A role is now hidden or disabled).
   - No logout occurred.
5. Switch back to Branch A and verify the original (broader) permission set correctly restores.

## Relevant automated coverage (supporting evidence only, not a substitute)

- `permissions-sync.test.tsx` and `use-branch-permissions-query.test.tsx` — both re-run clean in Phase 7's regression pass, confirming the underlying permission-context-after-switch mechanism has dedicated, passing test coverage at the unit/hook level.
- Phase 5's own systematic re-sweep (`docs/mvp/reviews/zone1-phase5-systematic-resweep-2026-09-24/permission-context-regression.md`) already confirmed via `git log` that `permissions-sync.tsx` and `use-branch-permissions-query.ts` have not been touched by any commit since before Zone 1 Phase 1 began — i.e., this mechanism predates and is unaffected by any Zone 1 phase's own changes.

This gives reasonable confidence the underlying mechanism is sound, but the task is explicit that code inspection and automated tests cannot substitute for this manual, visible-behavior check.
