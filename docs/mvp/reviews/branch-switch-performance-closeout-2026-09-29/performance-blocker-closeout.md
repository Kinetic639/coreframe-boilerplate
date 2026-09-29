# Performance Blocker Closeout

## Status

**`BRANCH SWITCH PERFORMANCE BLOCKER — RESOLVED FOR DEMO`**

**Reason:** `Vercel/Supabase regional co-location removed the dominant production latency multiplier.`

## Basis

- Production before/after (see `production-result.md`): ~15–25 s → ~1–2 s. The only change was the Vercel Function Region `iad1` → `dub1` (Supabase `eu-west-1`, Fluid Compute ON).
- The result meets the DEMO targets defined in `../branch-switch-performance-design-2026-09-28/solution-alternatives.md`, at or near GOOD for the warm switch.
- **Product-owner decision (2026-09-29):** stop the deeper branch-switch redesign for now, because the production target is met.

## Correct conclusion (and what it is not)

- Region mismatch was a **materially dominant** factor.
- Deeper architectural inefficiencies **still exist**:
  - serial loaders;
  - duplicate `getUser`;
  - two serial renders per switch;
  - background server actions sharing the router action queue;
  - the success toast firing before the new branch is committed.
- They are **no longer a presentation blocker**.
- This closeout does **not** claim that the other hypotheses in the design review were false (see `region-change-impact.md`).

## Disposition of the design stages

(Stages from `../branch-switch-performance-design-2026-09-28/recommended-solution.md`.)

| Stage                                                           | Status                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 0: production measurement                                       | superseded by the manual before/after for the demo decision; the full plan stays available if performance regresses |
| 1: co-locate functions with Supabase                            | **DONE** (`dub1`, Fluid Compute ON)                                                                                 |
| 2: honest UX + queue decontention                               | **OPTIONAL / POST-DEMO**, except the branded-loader presentation change done in this task (presentation only)       |
| 3: single-request redirect switch + `switched=` handshake       | **OPTIONAL / POST-DEMO**, not implemented by product-owner decision                                                 |
| 4: request-scoped `getUser`, loader parallelization, poll → GET | **OPTIONAL / POST-DEMO**, not implemented                                                                           |

**Reopen trigger:** see `deferred-performance-work.md`.

## Unchanged

- Branch-switch authorization semantics.
- Navigation: `replace("/dashboard/start")` + `refresh()`.
- DB/RLS/migrations.
- Tickets/Tasks scope.
- Phase 10D not started.
