# Zone 1 / Phase 1 — Centralized Branch Transition — Implementation Summary

**Date:** 2026-09-24
**Starting SHA:** 3e7ffce0b5158d3f8a02cda323aca3625b7a1163 ("docs: add Zone 1 implementation plan and progress tracker")

## What was broken

`SidebarBranchSwitcher.handleBranchSelect` (apps/web/src/app/[locale]/dashboard/\_components/sidebar-branch-switcher.tsx) called the already-correct, server-authoritative `changeBranch(branchId)` action, and on success only updated the Zustand client store (`setActiveBranch`) and showed a toast. No `router.refresh()`, no navigation. This meant:

- The sidebar showed the new branch immediately (Zustand-driven).
- Every Server Component in the current route tree kept rendering with the OLD branch's data until an unrelated navigation or a manual browser refresh occurred.
- A user viewing a branch-bound object (a RepairOrder detail, an Inventory Movement detail/edit) who switched branches remained on that exact object page, now showing an object that no longer belongs to their active branch context — a "split-brain" UI (sidebar = new branch, page body = old branch).

## What was fixed

After a server-confirmed successful `changeBranch()`, `handleBranchSelect` now:

1. Updates the client store (`setActiveBranch`) — unchanged from before.
2. Shows the success toast — unchanged from before.
3. `router.replace("/dashboard/start")` — moves the user off any branch-bound object route onto a static, branch-neutral safe destination.
4. `router.refresh()` — invalidates the Next.js Router Cache for the current route tree, forcing every Server Component (including persisting layouts) to re-render against the newly-persisted active branch.

On failure, behavior is unchanged: the error toast fires and the function returns before any client-state, navigation, or refresh call — the previous branch remains active and no false client state is produced.

## Safe route selection

`/dashboard/start` was selected as the safe destination. It is:

- A fully static page (`apps/web/src/app/[locale]/dashboard/start/page.tsx`) with zero data fetching and no dynamic route segments — it cannot 404 or resolve to a stale/inaccessible object under any branch context.
- Already the codebase's own established "go home" destination — `components/v2/layout/quick-switcher.tsx`'s default action set labels it "Go to dashboard home."
- Requires no new page, no routing changes, and satisfies every constraint given in the task spec (exists today, valid for normal authenticated users, no object-ID dependency).

## Router transition ordering

`router.replace(...)` is called before `router.refresh()`, matching the one existing precedent for this exact combination already in the codebase (`inventory-movement-new-client.tsx:269-270`, `router.push(...); router.refresh();`). `replace` (not `push`) was chosen deliberately: a branch switch invalidates the previous route as a valid back-button target (pressing back would just re-surface the same stale-branch-object rendering this phase closes), so no browser history entry is kept for the abandoned old-branch page, per the task's own "avoid unnecessary history entries" instruction. Navigating away before refreshing also avoids briefly re-rendering the old, soon-to-be-abandoned route (which could momentarily error/404 under the new branch context) before the user is moved off it.

## CLAUDE.md housekeeping correction

`apps/web/CLAUDE.md` line 19 previously instructed use of the stale legacy Supabase project ref (`zlcnlalwfmmtusigeuyk`). Per explicit instruction, since implementation work had now begun, this single line was corrected to reference the live target project (`rjeraydumwechpjjzrus`) and the authoritative migration tree (`apps/web/supabase-target/supabase/migrations`). No other line in `CLAUDE.md` was touched. Ownership of this item was moved from PILOT Phase E to Phase 1 in both the implementation plan and progress tracker, with the original 2026-09-23 planning-pass record preserved (not rewritten) and a new 2026-09-24 change-log entry recording the move.

## What was explicitly NOT touched

`changeBranch` (server action, authorization, validation) — unchanged. Branch access calculation, permission compilation, `PermissionsSync`, `useBranchPermissionsQuery`, `resolveActiveBranch`, `loadAppContextV2`, `loadDashboardContextV2`, multi-role union, NULL-branch inheritance, RLS, Supabase schema, session isolation, member revocation, historical identity — none touched. No DataView/query-key work (Phase 2/3). No Matcher query-key work (Phase 4). No QR/deep-link work (Phase 6). No Phase 10D work.
