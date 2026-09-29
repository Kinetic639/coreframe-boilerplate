# Refresh / Revalidation Analysis

## Is `router.refresh()` redundant after `router.replace("/dashboard/start")`?

**No. It must not be removed on its own.** An earlier draft of this audit assumed it was redundant; checking Next.js 16.1.7's server source disproved that before any change was made:

- `walk-tree-with-flight-router-state.js` begins rendering at the first segment that differs from the client's router state, unless the client marks a segment `refetch`. Going from `/[locale]/dashboard/warehouse/…` to `/[locale]/dashboard/start` shares `[locale]` and `dashboard`, so **`dashboard/layout.tsx` is not re-executed by the navigation** — only the `start` page segment is.
- That shared layout owns everything branch-dependent outside the page body: the permission-filtered sidebar model, `accessibleBranches` / `activeBranchId` passed to the shell, and the `context` given to `DashboardV2Providers` (including the permission snapshot).
- `router.refresh()` marks `refetch` from the root, so the full tree — including that layout — re-renders against the new branch. **This is exactly what Zone 1 Phase 1's acceptance criterion 3 relies on** ("Server Components are re-rendered against the new active branch").

Also verified: with no `staleTimes` in `next.config.ts`, Next's default never serves a dynamic page from the client router cache, so the navigate does fetch a fresh _page_. The page is fresh after step 1; the _layout_ only becomes fresh after step 2.

## Where the real waste is

1. **The page is rendered twice across two serial requests.** Request #1 renders the page segment; request #2 renders the full tree, which includes the page again. Each request rebuilds `loadDashboardContextV2` from scratch (React `cache()` is per request). The first page render is thrown away moments later: **~12 serial round trips of pure waste.**
2. **`HomeScopeBoundary` adds a wasted render** when the switch starts on `/dashboard/start`. The switcher updates the store before navigating, the boundary sees `store ≠ server-rendered branch`, and fires its own navigate, which discards the switcher's in-flight one. That request's server render still runs.

## Other revalidation mechanisms — checked

| Mechanism                                                   | Present in the switch path?                                                    | Verdict                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `revalidatePath` / `revalidateTag`                          | No (`changeBranch` calls neither)                                              | Not a factor                                                        |
| Cookie write → forced page re-render in the action response | Only when `@supabase/ssr` 0.6.1 sees a storage change (e.g. `TOKEN_REFRESHED`) | Occasional, not systematic                                          |
| Full context reload                                         | Yes, in every request (action + 2 renders)                                     | Required once per request; redundant across the two render requests |
| Permission recompilation                                    | No — the snapshot reads precompiled `user_effective_permissions` (16 ms)       | Not a factor                                                        |
| React Query invalidation                                    | No — DataView cache identity changes via `scope`, no invalidation storm        | Not a factor                                                        |

## What a correct single-render design needs

The switch needs **one** server render of the full tree for the target URL. Current Next primitives offer no "navigate to a new URL _and_ refetch the shared layout" in one client call, so any fix here means changing the switch mechanism (see `optimization-options.md`, options P1-C1–C3), not just deleting a line. That's why it's classified as a design-level change, not a trivial one.
