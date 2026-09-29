# `/dashboard/start` Load Profile

A branch switch produces two server renders (see `request-waterfall.md`): a **page-only** render from `router.replace`, where the shared layout is preserved by Next's partial rendering (12 serial round trips: middleware `getUser` + `loadDashboardContextV2` 10 + entitlements 1), then a **full-tree** render from `router.refresh`, broken down below.

## Full-tree render (layout + page)

## Layout (`dashboard/layout.tsx`). It blocks: nothing is emitted until every await completes.

| #   | Loader                                                  | Serial round trips                                                                    | Sequential/parallel         | Blocks initial render? |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- | ---------------------- |
| 1   | Middleware `getUser`                                    | 1 (Auth)                                                                              | sequential (before layout)  | Yes                    |
| 2   | `loadDashboardContextV2()`                              | 10                                                                                    | sequential (internal chain) | Yes                    |
| 3   | `EntitlementsService.loadEntitlements` (request-cached) | 1                                                                                     | sequential after 2          | Yes                    |
| 4   | `injectPinnedToolsIntoSidebar` → pinned tools           | 1                                                                                     | sequential after 3          | Yes                    |
| 5   | `loadAdminContextV2`                                    | 4: **`getUser` again + `users` again + avatar signed URL again** + admin entitlements | sequential after 4          | Yes                    |
| 6   | `getLatestActivityAction` → `getPersonalActivityAction` | 2 (context is request-cached; 2 event queries)                                        | sequential after 5          | Yes                    |

**Layout total: 19 serial round trips.** Steps 3–6 depend only on the context from step 2, not on each other, yet they're awaited one after another.

## Page (`dashboard/start/page.tsx`)

| Dashboard loader                     | Round trips                                                                                                 | Sequential/parallel          | Blocks initial render?     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------- |
| `loadHomeContext`                    | 0 extra (reuses the request-cached context + entitlements; +5 only if `?branch=` names a non-active branch) | awaited                      | Yes, but ~free when cached |
| `loadAttention` (tickets + settings) | 2 in parallel                                                                                               | started un-awaited, streamed | **No** (Suspense)          |
| `loadOpenTaskCount`                  | 1                                                                                                           | streamed                     | **No**                     |
| `loadPlanningSummary`                | several, parallel                                                                                           | streamed                     | **No**                     |
| `ActivityWidget`                     | 2                                                                                                           | streamed                     | **No**                     |

The page itself is well built: widgets stream behind `Suspense`, so a slow widget doesn't delay the page shell. **The blocking cost is entirely in the layout.**

## Duplicate work per render

- `auth.getUser()` runs **4×** per full-tree render (middleware, `loadAppContextV2`, `loadUserContextV2`, `loadAdminContextV2`) and **3×** per page-only render.
- The `users` row and the avatar signed URL are each fetched **2×** per full-tree render (`loadUserContextV2` and `loadAdminContextV2`).
- React `cache()` correctly dedupes `loadDashboardContextV2` / `loadEntitlements` across layout and page within one request. It does **not** help across the two separate requests a switch makes, so the page and the whole context chain are loaded twice.
