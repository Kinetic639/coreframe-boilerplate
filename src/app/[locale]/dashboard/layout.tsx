import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { buildSidebarModel } from "@/server/sidebar/build-sidebar-model";
import { createClient } from "@/utils/supabase/server";
import { ToolsCatalogService, UserToolsService } from "@/server/services/tools.service";
import type { SidebarItem } from "@/lib/types/v2/sidebar";
import { DashboardV2Providers } from "./_providers";
import { DashboardShell } from "./_components/dashboard-shell";
import Script from "next/script";

// Fixed "All Tools" item always shown last in the tools collapsible group
const TOOLS_ALL_CHILD: SidebarItem = {
  id: "tools.allTools",
  title: "All Tools",
  titleKey: "modules.tools.items.allTools",
  iconKey: "tools",
  href: "/dashboard/tools",
  match: { exact: "/dashboard/tools" },
};

/**
 * Fetches pinned tools for the user and injects them as children of the "tools"
 * sidebar item (turning it into a collapsible group).
 * Always includes "My Tools" and "All Tools" as fixed sub-items.
 */
async function injectPinnedToolsIntoSidebar(
  model: ReturnType<typeof buildSidebarModel>,
  userId: string
): Promise<ReturnType<typeof buildSidebarModel>> {
  const toolsIndex = model.main.findIndex((item) => item.id === "tools");
  // If tools item was pruned (no permission) or not found, skip injection
  if (toolsIndex === -1) return model;

  // Fetch pinned tools; skip DB call if no user
  let pinnedChildren: SidebarItem[] = [];
  if (userId) {
    const supabase = await createClient();
    const [pinnedResult, catalogResult] = await Promise.all([
      UserToolsService.listPinnedTools(supabase, userId),
      ToolsCatalogService.listCatalog(supabase),
    ]);

    if (pinnedResult.success && pinnedResult.data.length > 0) {
      const catalogMap = new Map(
        (catalogResult.success ? catalogResult.data : []).map((t) => [t.slug, t])
      );
      pinnedChildren = pinnedResult.data.map((pt) => {
        const tool = catalogMap.get(pt.tool_slug);
        return {
          id: `tools.pinned.${pt.tool_slug}`,
          title: tool?.name ?? pt.tool_slug,
          iconKey: "tools" as const,
          href: `/dashboard/tools/${pt.tool_slug}`,
          match: { exact: `/dashboard/tools/${pt.tool_slug}` },
        } satisfies SidebarItem;
      });
    }
  }

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

  // Redirect to sign-in if no context (unauthenticated or no organization)
  if (!context) {
    return redirect({ href: "/sign-in", locale });
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
