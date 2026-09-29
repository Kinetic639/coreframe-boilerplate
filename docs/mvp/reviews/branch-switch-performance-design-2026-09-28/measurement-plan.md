# Measurement Plan

Every measurement is against the **Vercel production deployment of main** with the UAT account (org "Diff Org name", 8 branches). Nothing here needs code changes.

## M0: Deployment facts (Vercel dashboard, 2 min)

1. Settings → Functions → **Function Region** (expected default `iad1`).
2. Settings → Functions → **Fluid compute** on/off.
3. Response header `x-vercel-id` on any dashboard request. It looks like `fra1::iad1::xxxx`: edge POP :: function region.

## M1: Browser timeline of 3 switches (Chrome DevTools, 10 min)

Setup:

- Network tab, "Preserve log", filter `Fetch/XHR`, "Disable cache" **off**.
- Record a Performance trace with screenshots for switch #2.

For each switch (#1 after 5+ min idle = cold, #2 and #3 back-to-back = warm), record:

| Field                                                                                                                | Where                                               |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Click timestamp                                                                                                      | Performance trace (event)                           |
| Every POST with request header `Next-Action` in the ±20 s window: start, end, duration, `x-vercel-id`, response size | Network                                             |
| Which action each POST is: `changeBranch` is the one after the click; others are poll/permissions                    | payload (`[branchId]` / `[]` / `[orgId, branchId]`) |
| **Gap between click and the `changeBranch` POST start**                                                              | = queue wait (H1)                                   |
| `changeBranch` POST duration and whether it has `Set-Cookie` / a large body                                          | H4                                                  |
| RSC GETs (`RSC: 1` header) for `/dashboard/start`: start/end                                                         | Problem B                                           |
| Toast timestamp; timestamp when the sidebar shows B                                                                  | screenshots                                         |

Repeat #2 after focusing another window for 5 s and then clicking straight into the switcher. That checks the focus-triggered poll.

## M2: Vercel function logs (5 min)

Filter the same time window. For each invocation of the action POST and the RSC GETs, record:

- duration;
- cold start / init duration;
- region;
- memory.

## M3: Supabase side (optional, 5 min)

- Supabase dashboard → Logs → API/Auth for the same window: count of `/auth/v1/user` calls and their latency.
- A spike or 429s points to H5.

## How to read it

| Observation                                                                  | Hypothesis confirmed | Stage that fixes it                                      |
| ---------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| click → `changeBranch` start gap > 0.5 s, with another action POST in flight | H1 queue             | 2 (+4 poll route)                                        |
| init/cold-start durations > 0.5 s on the action or GETs                      | H2                   | 1 (Fluid), 3 (fewer invocations)                         |
| `x-vercel-id` shows `iad1`; action duration ≈ 13 × ≥0.1 s                    | H3                   | 1                                                        |
| action response carries `Set-Cookie` and is large/slow                       | H4                   | 4 (fewer `getUser`) + inherent (rare)                    |
| Auth call latency ≫ 150 ms or 429s                                           | H5                   | 4 (fewer `getUser`); escalate to Supabase if it persists |
| none of the above explain ≥70% of the time                                   | **unknown**          | stop and re-decide (Stage 0 gate)                        |

## Acceptance measurement after each stage

Repeat M1 for 5 warm and 2 cold switches. Compare against the targets in `solution-alternatives.md` (p50/p95 click → branch-B shell commit; feedback ≤100 ms; success only on commit; zero mixed-branch frames in the screenshots).
