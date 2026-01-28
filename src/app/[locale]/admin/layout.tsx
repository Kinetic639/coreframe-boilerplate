import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "../dashboard/_providers";
import { AdminSidebarV2 } from "@/components/v2/admin/admin-sidebar";
import { DashboardHeaderV2 } from "@/components/v2/layout/dashboard-header";
import { StatusBar } from "@/components/v2/layout/status-bar";
import { SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "Admin Panel | Ambra",
  description: "System administration and testing tools",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // TODO: Implement proper super_admin role verification
  // For now, allowing all authenticated users to access admin panel
  // Uncomment below when super_admin role is properly set up:
  // const userMetadata = user.user_metadata;
  // const isSuperAdmin = userMetadata?.role === "super_admin";
  // if (!isSuperAdmin) {
  //   notFound();
  // }

  // Load context for providers (admin users still need org context)
  const context = await loadDashboardContextV2();

  return (
    <DashboardV2Providers context={context}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          {/* Admin Sidebar - Fixed */}
          <AdminSidebarV2 />

          {/* Main content area with header, content, and status bar */}
          <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
            {/* Header - Fixed at top */}
            <DashboardHeaderV2 />

            {/* Main scrollable content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>

            {/* Status bar - Fixed at bottom */}
            <StatusBar position="bottom" variant="compact" />
          </div>
        </div>
      </SidebarProvider>
    </DashboardV2Providers>
  );
}
