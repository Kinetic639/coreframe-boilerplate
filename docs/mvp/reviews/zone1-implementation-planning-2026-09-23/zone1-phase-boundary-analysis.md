# Zone 1 Phase Boundary Analysis

Re-evaluates `recommended-implementation-pass.md`'s 3-change recommendation against the required A-H topic separation and Zone 3's own granular-phase precedent, per this task's explicit instruction not to blindly reuse the 3-change grouping.

## The 3 original recommended changes, and why each was split

### Change 1 (branch-transition fix) → stays as ONE phase (Phase 1)

Single call site (`SidebarBranchSwitcher.handleBranchSelect`), single coherent concern (complete the atomic transition contract already specified in decision 22), small diff. Splitting further would be ceremony — there is no independently-valuable sub-slice smaller than "add refresh + redirect after switch." Kept as-is.

### Change 2 (systematic branch-scoped query-key convention) → split into 3 phases (2, 3, 4)

The original recommendation bundled: (a) adding a `branchId` mechanism to the shared `DataView` type, (b) migrating 4 concrete `DataView` consumers, and (c) fixing Matcher's own, architecturally separate query-key module — all as one change. Splitting rationale:

- **Phase 2 (foundation) vs. Phase 3 (consumers) split**: the foundation (type + key-building function) is independently reviewable and testable in isolation from any consumer migration — a reviewer can verify the key-building logic is correct without needing to trust 4 separate UI diffs at the same time. This also lets Phase 2 land and be regression-tested against existing org-scoped `DataView` screens BEFORE any consumer starts depending on it, catching a foundation-level mistake before it propagates into 4 places.
- **Phase 3 kept as ONE phase for all 4 consumers, not 4 phases**: each of the 4 fixes is the mechanically identical change (thread `branchId` into an existing `queryKey` prop) against the same already-verified foundation. Zone 3's own "does it mix unrelated things without necessity" test argues against further splitting here — there is no shared-mechanism benefit to be gained by reviewing them separately, only ceremony. (Contrast this with Phase 3 vs. Phase 4 below, where a REAL architectural difference justifies the split.)
- **Phase 4 (Matcher) split out from Phase 3 entirely**: `wdd-matcher.ts` is a hand-written hook module, not a `DataView` consumer — a structurally different code pattern. Combining it with Phase 3 would force one diff to touch two unrelated component families for no shared-mechanism benefit (unlike the 4 DataView consumers, which genuinely share one foundation). Keeping it separate also isolates its own zero-test-coverage gap (confirmed in `test-results.md`) as an independently reviewable fix.

### Change 3 (QR confirm-then-switch) → stays as ONE phase (Phase 6), with an explicit dependency on Phase 1

Single coherent concern (extend the existing QR/deep-link resolver + one page's reset-effect to use the confirm-then-switch pattern), reuses `changeBranch()` with no new authorization primitive. Not split further — the resolver change and the confirm-dialog UI change are two halves of one indivisible UX contract (a dialog with no resolver-side flag to trigger it is meaningless, and a resolver flag with no dialog is dead code). Given an explicit dependency on Phase 1, since the confirm-then-switch flow should land on the already-fixed, correctly-refreshing branch-switch behavior.

## Additional phases beyond the original 3 changes

- **Phase 0 (baseline)**: not present in the original 3-change recommendation at all — added per this task's own required template (every phase needs a Status/Dependencies/etc. block) and per Zone 3's own Phase 0A precedent (a baseline phase closes on verification evidence, establishing the frozen starting boundary every other phase depends on).
- **Phase 5 (systematic re-sweep)**: not present in the original recommendation. Added because the pre-implementation audit itself demonstrated that a systematic sweep finds real things a targeted check misses (the Inventory Products discovery) — a post-implementation re-sweep is the closing half of that same discipline, verifying Phases 1-4 actually closed the systemic problem rather than trusting the original 4-plus-1 enumeration was exhaustive.
- **Phase 7 (automated closeout) and Phase 8 (manual UAT)**: not present as separate phases in the original recommendation (it had "tests"/"UAT" as per-change fields, not standalone phases). Split out into their own phases per Zone 3's own precedent (a dedicated pitch-E2E/DEMO-READY-verification phase, separate from and gated behind the implementation phases) and per this task's explicit Section 10 instruction that manual UAT must be its own phase, never folded into "tests passing."

## The required A-H separation, mapped

| Required topic                           | Zone 1 phase(s)      |
| ---------------------------------------- | -------------------- |
| A. Environment/implementation baseline   | Phase 0              |
| B. Central branch-transition behavior    | Phase 1              |
| C. Branch-aware query/cache identity     | Phases 2, 3, 4       |
| D. Cross-branch deep-link/QR behavior    | Phase 6              |
| E. Automated regression verification     | Phase 7              |
| F. Manual DEMO READY UAT                 | Phase 8              |
| G. Pilot-grade IAM/security hardening    | PILOT Phases A, B, C |
| H. Pilot-grade RLS/schema/test hardening | PILOT Phases D, E, G |

(Phase 5 — systematic re-sweep — sits between C and D/E as a closing gate specific to the query-key work; PILOT Phases F, H, I cover unsaved-work safety, auditability, and final manual verification respectively, extending beyond the minimum A-H list because the evidence in `admin-security-verification.md` and `branch-state-cache-inventory.md` supports them as distinct, real requirements, per this task's own "may split further if evidence supports it" instruction.)

## Seven-question test applied to every phase

For each phase: (1) independently reviewable — yes, each phase's repository-areas-affected list is a small, bounded diff; (2) provable correct before moving on — yes, every phase has binary acceptance criteria, not "works correctly"; (3) does the next phase depend on it — dependencies are stated explicitly per phase, and are mostly shallow (Phase 2/3/4 are mutually independent of Phase 1; only Phase 5 depends on all of 1-4, only Phase 6 depends on Phase 1, only Phases 7/8 depend on everything before them); (4) does it mix UI/cache/auth/DB unnecessarily — no phase combines more than one of these without an explicit, stated reason (Phase 6 combines resolver + UI because they're one indivisible contract, not because of ceremony-avoidance); (5) can it split smaller without ceremony — checked case-by-case above, most phases explicitly justify staying as one unit; (6) clear acceptance criteria — every phase has numbered, binary criteria; (7) can Claude implement it in one focused task without losing context — every phase's repository-areas-affected list is 1-5 files, small enough for a single focused implementation pass.

## Verdict

The re-evaluated 9-phase DEMO sequence (0-8) and 9-phase PILOT sequence (A-I) is more granular than the original 3-change recommendation, matches Zone 3's own demonstrated preference for many small phases over few large ones, and satisfies every item in the required A-H separation plus the 7-question phase-design test.
