# Production Result (2026-09-29)

**Source:** repeated manual testing by the product owner on the **production Vercel deployment of `main`** against the real Supabase target.

**Code under test:** `main` @ `1e86d66c` (PR #434). No branch-switch code changed between the original finding and this result; only the deployment region changed.

|                                               | BEFORE (UAT finding, 2026-09-28)                        | AFTER (2026-09-29)                                   |
| --------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Vercel Function Region                        | `iad1` (Washington, D.C.)                               | **`dub1` (Dublin)**                                  |
| Supabase region                               | `eu-west-1`                                             | `eu-west-1`                                          |
| Fluid Compute                                 | ON                                                      | **ON**                                               |
| Click → loading feedback visible              | up to ~10–15 s (only a disabled button until the toast) | **usually <1 s**                                     |
| Click → `/dashboard/start` for the new branch | **~15–25 s**                                            | **~1–2 s**, and the page appears already loaded      |
| Repeated switches                             | same 15–25 s class                                      | similarly fast; no recurring 10–25 s delays observed |
| Functional correctness                        | correct                                                 | correct (unchanged)                                  |

## Against the targets defined in `../branch-switch-performance-design-2026-09-28/solution-alternatives.md`

| Metric                       | Target (GOOD / DEMO)                                | Observed      | Result                                                                          |
| ---------------------------- | --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| Click → branch-B shell, warm | GOOD p50 ≤1.5 s, p95 ≤3 s / DEMO p50 ≤3 s, p95 ≤5 s | ~1–2 s        | **meets DEMO; at or near GOOD**                                                 |
| Click → visible feedback     | ≤100 ms                                             | usually <1 s  | not strictly measured; acceptable for demo (see `deferred-performance-work.md`) |
| No recurring long delays     | —                                                   | none observed | meets                                                                           |

## Evidence quality

This is **manual, human-observed timing** on production. It is not a DevTools/Vercel-log trace. It is sufficient for the product-owner decision recorded in `performance-blocker-closeout.md`.

It does **not** give p95 numbers, cold-start rates, or a per-hypothesis breakdown. `../branch-switch-performance-design-2026-09-28/measurement-plan.md` remains the procedure if performance regresses.
