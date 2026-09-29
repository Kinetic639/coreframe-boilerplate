# Deferred Performance Work

The deeper design in `../branch-switch-performance-design-2026-09-28/` **remains valid technical debt / future optimization**.

It is **NOT required before the presentation**, unless production performance regresses.

The product owner decided (2026-09-29) not to implement it now, because production meets the demo target after co-location.

## Deferred items (not implemented)

| Item                                                                                                   | Source                | Status                                                                      |
| ------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------- |
| Server-action `redirect()` single-request switch                                                       | design Stage 3        | DEFERRED / POST-DEMO                                                        |
| `switched=` handshake + sessionStorage adoption (R5)                                                   | design Stage 3        | DEFERRED; it stays a **mandatory** part of Stage 3 if Stage 3 is ever built |
| Success toast on commit, not on action success; pending UI from click; `aria-live` switch announcement | design Stage 2        | DEFERRED (only the branded loader presentation was done in this task)       |
| Status-bar poll suppression during a switch / poll → GET Route Handler                                 | design Stages 2 and 4 | DEFERRED                                                                    |
| `PermissionsSync` seeded from the SSR snapshot                                                         | design Stage 2        | DEFERRED                                                                    |
| Request-scoped `getUser` (still server-validated)                                                      | design Stage 4        | DEFERRED                                                                    |
| Context-loader parallelization; `loadAdminContextV2` reuse; layout `Promise.all`                       | design Stage 4        | DEFERRED                                                                    |
| Branch-in-URL architecture                                                                             | design ALT-6          | rejected for this scope; long-term note only                                |

## Reopen triggers

Reopen the design (starting with `measurement-plan.md`) if any of these happen:

- a production branch switch regularly exceeds the DEMO target (p50 >3 s or p95 >5 s warm, or >6 s cold);
- the Vercel Function Region or the Supabase region changes, so they are no longer co-located (`dub1` ↔ `eu-west-1`);
- Fluid Compute is turned off;
- a pilot with real concurrent users, or additional latency-sensitive dashboard work, makes the 44-call / 2-render structure or the action-queue contention visible again.

## Standing constraints for any future implementation

- Do not weaken `getUser` validation.
- Do not change `isBranchAccessible` / `changeBranch` authorization semantics.
- No DB/RLS changes.
- Do not touch Tickets/Tasks scope.
