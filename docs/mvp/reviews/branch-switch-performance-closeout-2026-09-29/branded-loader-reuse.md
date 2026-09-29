# Branded Loader Reuse

## Existing loaders on `main` (1e86d66c)

| Component                 | Path                                                   | What it is                                                                                                                                                                                                                                                            | Branded (Ambra)?           |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **`BrandLoader`**         | `apps/web/src/components/branding/brand-loader.tsx`    | **Canonical Ambra animated loader:** the crystal/beacon logo animated with `framer-motion`. Variants `pulse` / `beacon_swap`; props `label`, `showWordmark`, `className`, `logoClassName`. Inline component, not positioned. No ARIA of its own; the label is a `<p>` | **Yes: the canonical one** |
| `PageLoader`              | `apps/web/src/components/page-loader.tsx`              | Inline, centered wrapper: `BrandLoader variant="beacon_swap" showWordmark={false} logoClassName="h-[7.68rem] w-[7.68rem]"`, fixed label `t("common.loading")`                                                                                                         | yes (wraps `BrandLoader`)  |
| `LoadingOverlay`          | `apps/web/src/components/branding/loading-overlay.tsx` | Full-app blocking overlay, portaled to `body`, `role="status" aria-live="polite"`, `bg-background/70 backdrop-blur-md`, wraps `BrandLoader`. Used by the audit wizard, guided count and variance review for slow actions that end in a navigation                     | yes (wraps `BrandLoader`)  |
| `Loader` (default export) | `apps/web/src/components/ui/Loader.tsx`                | Older full-screen `FancySpinner` + optional org logo. Used by `dashboard/template.tsx` and `DashboardInitialLoader`                                                                                                                                                   | **No**, generic spinner    |
| `dashboard/loading.tsx`   | `apps/web/src/app/[locale]/dashboard/loading.tsx`      | Dashboard route loading state = `<PageLoader className="min-h-[calc(100vh-10rem)]" />`                                                                                                                                                                                | yes                        |

**Canonical branded loader: `BrandLoader`.** It is presented in the dashboard content area the way `PageLoader` / `dashboard/loading.tsx` present it.

## Where the old plain loading UI came from

- **The exact string `Wczytywanie nowego oddziału...` does not exist in the codebase.** A search of `apps/web/src` and `apps/web/messages` found no match.
- The UI matching the description is **`HomeScopeBoundary`** in `apps/web/src/app/[locale]/dashboard/start/_components/scope-boundary.tsx`. It rendered `<p role="status" className="py-10 text-sm text-muted-foreground">{loadingLabel}</p>` in place of the whole home dashboard.
- The label comes from `homeCopy().changingBranch`: PL `Wczytywanie danych aktywnego oddziału…`, EN `Loading the active branch…` (`start/_lib/copy.ts:64,131`). It is passed by `start/page.tsx:50`.
- **Trigger:** `mismatch = isLoaded && (store.activeOrgId !== orgId || store.activeBranchId !== branchId)`. This compares the client store with the branch the server rendered the page for.
- During a sidebar switch on `/dashboard/start`, `SidebarBranchSwitcher` calls `setActiveBranch(B)` after the server confirms, and **before** the new RSC arrives. The page, still rendered for A, then showed only that plain text line until the branch-B page committed.
- **Owner:** `HomeScopeBoundary`. It is not `SidebarBranchSwitcher`, not a route `loading.tsx`, and not a Suspense fallback.

## Change

In `HomeScopeBoundary`'s mismatch branch **only**, the plain `<p>` is replaced by the existing `BrandLoader`, with exactly the presentation `PageLoader` / `dashboard/loading.tsx` use:

- `variant="beacon_swap"`;
- `showWordmark={false}`;
- `logoClassName="h-[7.68rem] w-[7.68rem]"`;
- centered in `min-h-[calc(100vh-10rem)]`.

The existing branch-specific `loadingLabel` is the loader's caption.

- **Why `BrandLoader` directly rather than `PageLoader`:** `PageLoader` hard-codes the generic `common.loading` label. Reusing it would have meant changing a shared component's API or losing the branch-specific text. Using `BrandLoader` with `PageLoader`'s props gives the identical look with no API change.
- **Why not `LoadingOverlay`:** the old UI was an in-content state, not a blocking overlay. Adding a portal overlay driven by the switcher would add a new UX surface, and would have depended on transition-pending timing across `replace` + `refresh`. The task asked to replace the plain presentation, not to add a second one.
- **No new loader, animation, colors, logo or typography were created.**

## Semantics preserved

- Same trigger (`mismatch`), same timing, same content hiding (stale branch-A children are still never shown under branch B), and the same `router.replace(?branch=…)` corrective navigation.
- Accessibility: the `role="status"` element is kept (now the loader container). Its accessible text is the label, still announced politely. `aria-busy` on the `home-dashboard` container is unchanged. No focus trap, and none is introduced.
- The loader disappears exactly when it did before: when the server-rendered branch equals the store branch, i.e. the new branch page has committed.
- Error path: on a failed `changeBranch`, the switcher never calls `setActiveBranch` (unchanged), so no mismatch occurs, no loader appears, and the old branch stays authoritative with the existing error toast.
- Unchanged: `SidebarBranchSwitcher`, `changeBranch`, the providers, stores, routing and navigation.

## Known limits (unchanged by this task)

- The loader appears in the `/dashboard/start` content area when the switch starts **on** `/dashboard/start`.
- From another route, the switch navigates to `/dashboard/start` and the existing route loading states apply (the `start/loading.tsx` skeletons).
- During the short `changeBranch` action itself (<1 s in production), feedback is still the disabled switcher button.
- The success toast still fires on action success rather than on commit.

These are the deferred Stage 2 UX items (`deferred-performance-work.md`).
