# Solution Alternatives

## Performance targets (from click, measured in production)

| Metric                                             | GOOD                 | ACCEPTABLE FOR DEMO         | UNACCEPTABLE                      |
| -------------------------------------------------- | -------------------- | --------------------------- | --------------------------------- |
| Click → visible pending feedback naming the target | ≤100 ms              | ≤100 ms                     | >300 ms, or none                  |
| Click → branch-B shell committed (warm)            | p50 ≤1.5 s, p95 ≤3 s | p50 ≤3 s, p95 ≤5 s          | p95 >5 s warm                     |
| First switch after idle (cold)                     | ≤3 s                 | ≤6 s, with visible progress | >10 s                             |
| Success message timing                             | on commit            | on commit                   | before the branch-B UI is visible |
| Mixed-branch UI after "success"                    | never                | never                       | any                               |
| Server renders per switch                          | 1                    | 1–2                         | ≥2 plus wasted renders            |

## The alternatives

### ALT-1: Incremental trim of the current flow

Keep action → `replace` → `refresh`. Add a pending UI and move the toast. Dedupe `getUser`, parallelize the loaders and layout, add a `/start` short-circuit.

- Serial steps: 44 → ~22–26. Queue wait untouched. 3 requests still.
- Transatlantic: ~3–4 s plus queue wait. Co-located: ~1 s plus queue wait.
- **Verdict:** safe and useful, but it leaves the two structural defects: two serial renders, and contention in the action queue. The pre-toast phase keeps its biggest unexplained term (H1).

### ALT-2: Single-request, server-authoritative switch, off the contended queue _(chosen core)_

- `changeBranch` keeps its authorization unchanged and ends in `redirect()` to the localized target. Next streams the full branch-B tree in the same response: 1 client request, 1 render.
- A one-shot `switched` handshake makes the client adopt the server branch (sessionStorage R5, no `HomeScopeBoundary` race).
- Background reads leave the action queue: poll → GET Route Handler; `PermissionsSync` seeded from SSR.
- The toast fires on commit.
- Serial steps: ~14 (after the dedupe/parallel stage), or ~32 before it. No queue wait.
- **Verdict:** fixes all three problems structurally. It depends on the documented Next behavior (`redirect` in an action streams the target; verified in `action-handler.js`), which must be confirmed on Vercel during implementation.

### ALT-3: Full-document switch via a Route Handler

`<form method="post" action="/api/branch/switch">` → handler validates (`getUser` + `loadDashboardContextV2` + `isBranchAccessible`), updates the preference, and returns `303` to `/<locale>/dashboard/start?switched=B` → browser full load.

- Pros: completely outside the router queue; resets every client cache (strongest staleness guarantee); trivially one SSR.
- Cons:
  - loses server actions' built-in origin check, so the handler must enforce `Origin`/`Sec-Fetch-Site` itself (CSRF);
  - full reload flash plus hydration of the whole app (~0.5–1.5 s on mid devices);
  - loses in-memory UI state;
  - the toast needs a URL/cookie flag;
  - sessionStorage handling is the same as ALT-2.
- **Verdict:** a valid fallback if ALT-2's redirect streaming proves unreliable on Vercel. It isn't preferred: it swaps a framework-protected mutation for a hand-rolled CSRF surface, and it feels heavier.

### ALT-4: Optimistic client-first switch

The store switches to B immediately; the UI renders B from client data; the preference persists in the background; roll back on failure.

- **Rejected:**
  - the shared layout, sidebar model and permission snapshot are server-rendered, so the UI would show B-labelled chrome with A-derived permissions;
  - it violates the server-authoritative invariant;
  - rolling back after a visible "success" is worse UX than waiting 1–2 s.

### ALT-5: Infrastructure only

Co-locate Vercel functions with Supabase (`dub1`), optionally with Fluid compute and route warming. No code.

- Serial steps unchanged (44), each ~10× cheaper: ~1 s plus cold starts. The queue wait shrinks with it but is still present.
- **Verdict:** the highest-leverage single change, and part of the chosen design. On its own it is not sufficient: problem C (dishonest success, no feedback) and the two-render/queue structure remain, and it depends on a project-settings decision by the owner.

### ALT-6: Branch as a URL segment (`/dashboard/b/[branchId]/…`)

A switch becomes an ordinary navigation, and router/cache keys carry the branch naturally.

- **Rejected for this scope:**
  - it is a rewrite of every dashboard route, link and test;
  - branch in the URL must still never be authorization, so all server checks stay;
  - it doesn't solve the per-request round-trip cost.
- Worth recording only as a long-term option.

## Comparison

|                                      | ALT-1            | **ALT-2**      | ALT-3                | ALT-4             | ALT-5        | ALT-6     |
| ------------------------------------ | ---------------- | -------------- | -------------------- | ----------------- | ------------ | --------- |
| Renders per switch                   | 2                | **1**          | 1 (+ full hydration) | 0–1               | 2            | 1         |
| Client requests                      | 3                | **1**          | 1 document           | 1                 | 3            | 1–2       |
| Removes queue wait                   | ✘                | **✔**          | ✔                    | ✔                 | ✘            | ✘         |
| Honest success                       | ✔ (with UX fix)  | **✔**          | ✔                    | ✘                 | ✘            | ✔         |
| Auth semantics unchanged             | ✔                | **✔**          | ✔ (manual CSRF)      | ✘                 | ✔            | ✔         |
| Risk                                 | low              | **medium**     | medium               | high              | low (config) | very high |
| Expected warm switch (co-located)    | ~1–1.5 s + queue | **~0.5–1 s**   | ~1–2 s               | instant but wrong | ~1 s + queue | n/a       |
| Expected warm switch (transatlantic) | ~3–4 s + queue   | **~1.5–2.5 s** | ~2–3 s               | —                 | —            | —         |
