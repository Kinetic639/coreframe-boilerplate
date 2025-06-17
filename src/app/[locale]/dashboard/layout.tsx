import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Loader from "@/components/ui/Loader";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { getSidebarStateServer } from "@/lib/cookies/get-sidebar-state-server";
import { UserInitProvider } from "@/lib/providers/user-init-provider";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";

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
              style={{ "--theme-color": themeColor } as React.CSSProperties}
            >
              <div className="flex w-full flex-1">
                {/* Sidebar */}
                <div className="relative z-50">
                  <AppSidebar />
                </div>

                {/* Main content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <header className="sticky top-0 z-20 flex flex-col bg-background">
                    <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
                      <div className="flex items-center gap-2">
                        <SidebarTrigger />
                      </div>
                      <div className="flex items-center gap-2">
                        <LocaleSwitcher />
                        <ThemeSwitcher />
                        <div className="relative w-64" />
                      </div>
                    </div>
                  </header>

                  <main className="flex-1 overflow-auto bg-muted/20 px-4 py-6">
                    {/* 👇 Debug info (do usunięcia w prod) */}
                    <div className="mb-12">
                      <pre className="text-xs">
                        {/* {JSON.stringify({ appContext, userContext }, null, 2)} */}
                      </pre>
                    </div>
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
