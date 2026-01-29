import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "../dashboard/_providers";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { StatusBar } from "@/components/v2/layout/status-bar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Admin Panel | Ambra",
  description: "System administration and testing tools",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Load context server-side
  const context = await loadDashboardContextV2();
  const locale = await getLocale();

  // Redirect to sign-in if no context (unauthenticated or no organization)
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }

  // TODO: Implement proper super_admin role verification
  // For now, allowing all authenticated users to access admin panel
  // Uncomment below when super_admin role is properly set up:
  // const userMetadata = context.user.user_metadata;
  // const isSuperAdmin = userMetadata?.role === "super_admin";
  // if (!isSuperAdmin) {
  //   return redirect({ href: "/dashboard/start", locale });
  // }

  return (
    <DashboardV2Providers context={context}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full overflow-hidden">
          {/* Admin Sidebar - Fixed */}
          <AppSidebar />

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
