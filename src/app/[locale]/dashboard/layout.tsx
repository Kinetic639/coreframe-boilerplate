import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { buildSidebarModel } from "@/server/sidebar/build-sidebar-model";
import { createClient } from "@/utils/supabase/server";
import { UserToolsService } from "@/server/services/tools.service";
import type { SidebarItem } from "@/lib/types/v2/sidebar";
import { DashboardV2Providers } from "./_providers";
import { DashboardShell } from "./_components/dashboard-shell";
import Script from "next/script";

// Fixed "All Tools" item always shown last in the tools collapsible group.
// Points to /dashboard/tools/all (catalog page) not /dashboard/tools (unified page
// which defaults to My Tools tab) so clicking "All Tools" shows the catalog.
const TOOLS_ALL_CHILD: SidebarItem = {
  id: "tools.allTools",
  title: "All Tools",
  titleKey: "modules.tools.items.allTools",
  iconKey: "tools",
  href: "/dashboard/tools/all",
  match: { exact: "/dashboard/tools/all" },
};

/**
 * Per-request memoized fetch of pinned tools for the sidebar.
 *
 * Uses a minimal join query (tool_slug + tools_catalog name) instead of two
 * parallel full-row fetches. React.cache() deduplicates within a single SSR
 * request so multiple server components querying the same userId never re-hit
 * the database.
 *
 * State scoping: user_enabled_tools has no org_id — tool state is user-global.
 */
const fetchPinnedToolsForSidebar = cache(async (userId: string) => {
  if (!userId) return [];
  const supabase = await createClient();
  const result = await UserToolsService.listPinnedToolsForSidebar(supabase, userId);
  return result.success ? result.data : [];
});

/**
 * Injects pinned tools as children of the "tools" sidebar item, turning it
 * into a collapsible group. Pinned tools appear above the fixed "All Tools"
 * child. Skips silently if the tools item was pruned (no tools.read permission).
 */
async function injectPinnedToolsIntoSidebar(
  model: ReturnType<typeof buildSidebarModel>,
  userId: string
): Promise<ReturnType<typeof buildSidebarModel>> {
  const toolsIndex = model.main.findIndex((item) => item.id === "tools");
  if (toolsIndex === -1) return model;

  const pinned = await fetchPinnedToolsForSidebar(userId);

  const pinnedChildren: SidebarItem[] = pinned.map(
    (pt) =>
      ({
        id: `tools.pinned.${pt.tool_slug}`,
        title: pt.name,
        iconKey: "tools" as const,
        href: `/dashboard/tools/${pt.tool_slug}`,
        match: { exact: `/dashboard/tools/${pt.tool_slug}` },
      }) satisfies SidebarItem
  );

  const updatedMain = model.main.map((item) => {
    if (item.id !== "tools") return item;
    return {
      ...item,
      // Remove href so the L1 item acts as a group trigger, not a link
      href: undefined,
      // Pinned tools at top, "All Tools" browse link always last
      children: [...pinnedChildren, TOOLS_ALL_CHILD],
    };
  });

  return { ...model, main: updatedMain };
}

/**
 * Dashboard V2 Layout
 *
 * Server layout component that:
 * 1. Loads context server-side via loadDashboardContextV2()
 * 2. Redirects to sign-in if no context (unauthenticated)
 * 3. Loads entitlements for sidebar filtering
 * 4. Builds sidebar model server-side (SSR)
 * 5. Passes context to DashboardV2Providers for client hydration
 * 6. Renders sidebar and main content area
 *
 * Pattern: Server loads → Client hydrates → Components use data
 */
export default async function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  // Load context server-side
  const context = await loadDashboardContextV2();
  const locale = await getLocale();

  // Unauthenticated — go to sign-in
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }

  // Authenticated but no org membership — show protection screen, not broken shell
  if (!context.app.activeOrgId) {
    return redirect({ href: "/onboarding", locale });
  }

  // Load entitlements for sidebar (SSR only)
  // Null-safe: fail-closed if org has no entitlements
  let entitlements = null;
  if (context.app.activeOrgId) {
    entitlements = await EntitlementsService.loadEntitlements(context.app.activeOrgId);
  }

  // Build sidebar model server-side (deterministic, permission-filtered)
  const rawSidebarModel = buildSidebarModel(context.app, context.user, entitlements, locale);

  // Inject pinned tools as children of the "tools" sidebar item
  const sidebarModel = await injectPinnedToolsIntoSidebar(
    rawSidebarModel,
    context.user?.user?.id ?? ""
  );

  // Check admin entitlements to show Admin Panel link in the user menu
  const adminContext = await loadAdminContextV2();
  const isAdmin = adminContext?.adminEntitlements?.enabled ?? false;

  return (
    <>
      <Script
        id="color-theme-loader"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('color-theme') || 'default';
              if (theme !== 'default') {
                document.documentElement.setAttribute('data-theme', theme);
              }
            } catch (e) {}
          `,
        }}
      />
      <DashboardV2Providers context={context}>
        <DashboardShell
          sidebarModel={sidebarModel}
          isAdmin={isAdmin}
          accessibleBranches={context.app.accessibleBranches}
          activeBranchId={context.app.activeBranchId}
        >
          {children}
        </DashboardShell>
      </DashboardV2Providers>
    </>
  );
}
// Force rebuild: 1769765116
