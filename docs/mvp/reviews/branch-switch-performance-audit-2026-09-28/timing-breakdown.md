# Timing Breakdown

## Measured: per-round-trip latency (this environment → Supabase `rjeraydumwechpjjzrus`, 5 samples each)

| Endpoint                                 | Range       | Typical |
| ---------------------------------------- | ----------- | ------- |
| PostgREST (`/rest/v1`)                   | 0.09–0.21 s | ~0.14 s |
| Auth `getUser` (`/auth/v1/user`)         | 0.08–0.13 s | ~0.10 s |
| Storage sign (`/storage/v1/object/sign`) | 0.11–0.17 s | ~0.12 s |

## Measured: DB execution time under RLS, as the UAT user (rolled-back txn, `authenticated` role)

| Query (as issued by the loaders)                  | DB time                         |
| ------------------------------------------------- | ------------------------------- |
| `user_preferences` by user                        | 12.0 ms                         |
| `organizations` + `organization_profiles`         | 3.1 ms                          |
| `branches` by org (8 rows)                        | 1.0 ms (+2.3 ms planning)       |
| `users` by id                                     | 5.2 ms                          |
| `user_effective_permissions` org scope (105 rows) | 16.0 ms                         |
| `user_effective_permissions` branch scope         | 0.3 ms                          |
| `user_role_assignments` branch scope              | 13.0 ms                         |
| `organization_entitlements`                       | 7.0 ms                          |
| `user_preferences` UPDATE trigger                 | only `set_updated_at` (trivial) |

**Total DB work for the whole context chain is well under 60 ms.** Query cost is not the bottleneck; round-trip count × per-trip latency × number of renders is.

## Measured: dev server (`next dev --webpack`, Next 16.1.7) cost for `/dashboard/start`

| Condition                                       | Total       | compile  | render      |
| ----------------------------------------------- | ----------- | -------- | ----------- |
| First request after server start (cold)         | **54 s**    | **53 s** | 0.7 s       |
| Warm, repeated                                  | 0.43–0.60 s | ≤0.04 s  | 0.42–0.56 s |
| After 70 s idle (past default `maxInactiveAge`) | 0.86 s      | 0.09 s   | 0.77 s      |

(Unauthenticated requests, which exit at the layout's auth gate. That makes them a floor on per-request overhead: 2 Auth round trips plus ~0.2 s of dev overhead.)

## Modeled T-phases for one switch (UAT account shape, warm server, ~0.12 s/round trip)

| Phase                                                                                                                                                                                   | Serial round trips                                             | Modeled @ 0.12 s               | Observed in UAT |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------ | --------------- |
| T0→T2 `changeBranch` action request                                                                                                                                                     | 13                                                             | ~1.6 s                         | **10–15 s**     |
| T2→T4 client handling + toast                                                                                                                                                           | 0                                                              | ~0 s                           | —               |
| T5→T7 request #1 (`router.replace`): renders **only the `start` page segment**; the shared dashboard layout is preserved (Next partial rendering)                                       | 12                                                             | ~1.4 s                         | }               |
| request #2 (`router.refresh`), queued after #1: **full tree**, including the dashboard layout; the page renders a second time                                                           | 19                                                             | ~2.3 s                         | } **5–10 s**    |
| (switch started on `/dashboard/start` only) `HomeScopeBoundary` navigation **replaces** #1. #1's server render still runs but its result is discarded (wasted, overlapping, not serial) | +12 wasted                                                     | +0 s serial, extra server load | }               |
| **Total**                                                                                                                                                                               | **44 serial** (+12 wasted when starting on `/dashboard/start`) | **~5.3 s**                     | **15–25 s**     |

## What this means

- **Post-toast phase (5–10 s): structurally explained.** Two strictly sequential server requests: a page-only render (12 serial round trips) followed by a full-tree render (19) — 31 round trips, ~3.7 s at this environment's latency before dev-mode overhead. That fits the observed 5–10 s if the UAT server's latency is ~0.2–0.3 s per round trip. A third, overlapping render is wasted when the switch starts on `/dashboard/start`.
- **Pre-toast phase (10–15 s): NOT explained by the model.** 13 serial round trips predict ~1.6 s here. Reaching 10–15 s would need ~0.8–1.1 s per round trip, or a non-network cost. The most likely candidates (unconfirmed without data from the UAT environment):
  1. **A dev-mode cold compile.** The first switch after `pnpm dev` starts, or after any code edit, pays a route compile; 53 s was measured here for a cold `/dashboard/start`. The `allowedOrigins` list in `next.config.ts` names Cloud Workstations dev hosts, which suggests UAT runs on `next dev`.
  2. **Much higher latency** from the UAT app server (Cloud Workstation) to the Supabase region than from this sandbox. The model scales linearly: 13 trips at 0.8 s would match.
- **Closing the gap needs one data point from the UAT environment** (see `recommended-fix-sequence.md` step 0). It doesn't change the fix plan: every recommended fix removes round trips or whole renders, which helps linearly in either case.
