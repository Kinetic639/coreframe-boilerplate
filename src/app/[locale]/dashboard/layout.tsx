import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "./_providers";
import { SidebarV2 } from "@/components/v2/layout/sidebar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { StatusBar } from "@/components/v2/layout/status-bar";
import { SidebarProvider } from "@/components/ui/sidebar";

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
        <div className="flex h-screen w-full overflow-hidden">
          {/* Sidebar - Fixed */}
          <SidebarV2 />

          {/* Main content area with header, content, and status bar */}
          <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
            {/* Header - Fixed at top */}
            <DashboardHeaderV2 />

            {/* Main scrollable content */}
            <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">{children}</main>

            {/* Status bar - Fixed at bottom */}
            <StatusBar position="bottom" variant="compact" />
          </div>
        </div>
      </SidebarProvider>
    </DashboardV2Providers>
  );
}
