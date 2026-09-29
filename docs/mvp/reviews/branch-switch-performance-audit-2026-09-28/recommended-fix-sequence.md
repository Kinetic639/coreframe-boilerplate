# Recommended Fix Sequence

## Step 0 — close the one open measurement (≈5 minutes, human, no code change)

The pre-toast 10–15 s can't be explained from here (13 serial round trips model to ~1.6 s). Three data points from the UAT environment settle it:

1. **How was UAT run?** `pnpm dev` (webpack, on the Cloud Workstation) or a production build/deployment?
2. **Paste the dev-server terminal lines printed during one switch.** Next already logs, per request, `… in Xs (compile: Ys, render: Zs)`. The `POST` line (the Server Action) and the `GET /…/dashboard/start` lines show directly whether the time is compile or render. Do this for the first switch after starting the server, and again for a second switch.
3. **Per-round-trip latency from the machine running Next** (not the browser):
   ```
   for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total}\n" "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/user" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer x"; done
   ```

How to read the results:

- **`compile:` is large** → the dominant cause is a dev-mode compile → P0-B (demo on a production build / pre-warmed routes) is the main fix.
- **`render:` is large and latency ≥0.5 s** → server-to-Supabase latency × round-trip count → P1-E/G are the main fixes, plus co-locating the app server with the Supabase region.

## Step 1 — P0-A: honest, immediate feedback (do regardless of step 0)

**Recommended sequence:**

```
click branch
→ immediately: switcher shows "Switching to <branch>…" with a spinner; main area gets a subtle busy overlay
→ changeBranch (server-authoritative, unchanged)
→ navigation + refresh (unchanged for now)
→ transition completes → overlay clears → toast "Switched to <branch>"
→ on failure: overlay clears, error toast, old branch stays authoritative (unchanged)
```

Driven by the existing `isPending` (it stays true until the refresh commits), so no authorization, routing or data change. The success toast moves from "after the action" to "after the transition finishes", which removes the misleading message.

## Step 2 — P0-B, if step 0 shows compile cost

Demo and UAT on a production build, or pre-warm `/dashboard/start` and the warehouse routes before presenting. A production build first needs main's recorded build blocker fixed: `src/app/auth/auth-code-error/page.tsx` has no root layout.

## Step 3 — P1 round-trip cuts, smallest/safest first

1. **P1-C1:** already on `/dashboard/start` → refresh only (trivial).
2. **P1-D:** `Promise.all` the layout's independent loaders.
3. **P1-F:** `loadAdminContextV2` reuses the user context.
4. **P1-E:** request-scoped `getAuthUser()`. Auth-adjacent: same `getUser()` validation, called once per request; dedicated tests.
5. **P1-G:** parallelize inside the context loaders. Core loader; the full Zone 1 regression suite is required after this.
6. Re-measure. Decide on **P1-C2** (single full-document navigation) only if the page double render still matters.

## Step 4 — P2, after the demo

P2-H (`HomeScopeBoundary` race) and P2-I (lighter `changeBranch` context).

## Constraints respected throughout

No authorization semantics change (`changeBranch` stays the sole, server-validated switch; `getUser` stays server-validated). No DB/RLS change. No change to Tickets/Tasks scope. No Phase 10D work.
