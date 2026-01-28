import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "./_providers";
import { AppSidebar } from "@/components/v2/layout/app-sidebar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { StatusBar } from "@/components/v2/layout/status-bar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

/**
 * Dashboard V2 Layout
 *
 * Server layout component that:
 * 1. Loads context server-side via loadDashboardContextV2()
 * 2. Redirects to sign-in if no context (unauthenticated)
 * 3. Passes context to DashboardV2Providers for client hydration
 * 4. Renders sidebar and main content area
 *
 * Pattern: Server loads → Client hydrates → Components use data
 * Uses shadcn/ui sidebar-07 pattern with collapsible sidebar
 */
export default async function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  // Load context server-side
  const context = await loadDashboardContextV2();
  const locale = await getLocale();

  // Redirect to sign-in if no context (unauthenticated or no organization)
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }

  return (
    <DashboardV2Providers context={context}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset>
          {/* Header with sidebar trigger */}
          <DashboardHeaderV2 />

          {/* Main scrollable content */}
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>

          {/* Status bar - Fixed at bottom */}
          <StatusBar position="bottom" variant="compact" />
        </SidebarInset>
      </SidebarProvider>
    </DashboardV2Providers>
  );
}
