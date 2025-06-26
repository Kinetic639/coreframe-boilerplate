import AppSidebar from "@/components/Dashboard/sidebar/AppSidebar";
import Loader from "@/components/ui/Loader";
import { SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { getSidebarStateServer } from "@/lib/cookies/get-sidebar-state-server";
import { UserInitProvider } from "@/lib/providers/user-init-provider";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();
  const sidebarState = await getSidebarStateServer(); // "collapsed" lub "expanded"
  const locale = await getLocale();

  if (!userContext || !appContext) {
    return redirect({ href: "/sign-in", locale });
  }

  const themeColor = appContext?.activeOrg?.theme_color;

  return (
    <Suspense fallback={<p>Loading</p>}>
      <SidebarProvider defaultOpen={sidebarState === "expanded"}>
        <AppInitProvider
          context={{
            activeOrg: appContext.activeOrg,
            activeBranch: appContext.activeBranch,
            activeOrgId: appContext.active_org_id,
            activeBranchId: appContext.active_branch_id,
            availableBranches: appContext.availableBranches,
            userModules: appContext.userModules,
          }}
        >
          <UserInitProvider context={userContext}>
            <div
              className="flex h-screen w-full"
              style={
                {
                  "--theme-color": themeColor,
                  "--font-color": appContext?.activeOrg?.font_color,
                } as React.CSSProperties
              }
            >
              <div className="flex w-full flex-1">
                {/* Sidebar */}
                <div className="relative z-50">
                  <AppSidebar />
                </div>

                {/* Main content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <DashboardHeader />
                  <main className="flex-1 overflow-auto bg-muted/20 px-4 py-6">
                    <Suspense fallback={<Loader />}>
                      <div>{children}</div>
                    </Suspense>
                  </main>
                </div>
              </div>
            </div>
          </UserInitProvider>
        </AppInitProvider>
      </SidebarProvider>
    </Suspense>
  );
}
