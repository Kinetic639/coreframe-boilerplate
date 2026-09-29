# Problem Restatement

## The finding (production UAT, 2026-09-28)

- **Environment:** the Vercel deployment of `main`, running against the real Supabase target (`rjeraydumwechpjjzrus`, eu-west-1). This is **not** `next dev`, so dev compilation can't explain any part of it.
- **Action:** the user picks another branch in `SidebarBranchSwitcher`.
- **What was observed:**

| Segment                                                | Observed                                                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Click → success toast ("Branch switched successfully") | ~10–15 s                                                                                                                                       |
| Toast visible → toast gone                             | ~5 s (configured `autoClose` is 2.5 s, see `toast-container-themed.tsx:91`; the extra time is most likely pause-on-hover/focus, or perception) |
| Toast gone → `/dashboard/start` shows the new branch   | ~5–10 s more                                                                                                                                   |
| **Total**                                              | **~15–25 s**                                                                                                                                   |

- **Correctness:** the switch works. The correct branch is persisted, and the final shell and data are scoped to the new branch.

## Three separate problems

| ID    | Problem                                                            | What it's about                                                                                                                                                 |
| ----- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Server-action latency (click → `changeBranch` resolves)            | Queueing, cold starts, serial Supabase round trips across the Atlantic                                                                                          |
| **B** | Navigation latency (action resolved → branch-correct UI committed) | Two strictly serial server renders (`router.replace` page-only, then `router.refresh` full tree), 31 serial Supabase calls                                      |
| **C** | Perceived/UX latency                                               | For 10–15 s the only feedback is a disabled button. The toast says "success" before the UI has changed, then disappears while the old branch is still on screen |

A and B add up to the real latency. C makes any latency feel broken, and it is independently a correctness-of-communication bug: the product claims success before the success is visible.

## Constraints (unchanged from the task)

- `changeBranch` stays the only server-authoritative switch.
- `isBranchAccessible` stays the shared access check.
- `branchId` is never used as authorization input.
- Supabase `auth.getUser()` validation is not weakened. It is never replaced by `getSession()` or JWT-only decoding.
- No DB/RLS/migration changes. No changes to Tickets or Tasks (their earlier scope verification stands: see `../branch-switch-performance-audit-2026-09-28/tickets-tasks-scope-verification.md`).
- This task is documentation only: zero runtime changes.

## The question being decided

What should the branch switch be **architecturally**, so that it is fast in production, honest in its UX, and keeps the Zone 1 invariants? And in what order should changes land?
