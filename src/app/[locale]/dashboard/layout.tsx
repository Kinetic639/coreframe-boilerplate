import AppSidebar from "@/components/Dashboard/sidebar/AppSidebar";
import Loader from "@/components/ui/Loader";
import { redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { getSidebarStateServer } from "@/lib/cookies/get-sidebar-state-server";
import { UserInitProvider } from "@/lib/providers/user-init-provider";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { QueryClientProvider } from "@/lib/providers/query-client-provider";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import DashboardHeader from "@/components/Dashboard/header/DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar";

function hexToRgb(hex: string | null): string {
  if (!hex) return "0,0,0";
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return "0,0,0";
  const [, r, g, b] = match;
  return `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}`;
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();
  const sidebarState = await getSidebarStateServer(); // "collapsed" lub "expanded"
  const locale = await getLocale();

  if (!userContext || !appContext) {
    return redirect({ href: "/sign-in", locale });
  }

  const themeColor = appContext?.activeOrg?.theme_color ?? null;

  return (
    <Suspense fallback={<p>Loading</p>}>
      <SidebarProvider defaultOpen={sidebarState === "expanded"}>
        <QueryClientProvider>
          <AppInitProvider
            context={{
              ...appContext,
              location: null, // Initialize as null, can be set later via setLocation
            }}
          >
            <UserInitProvider context={userContext}>
              <div
                className="flex h-screen w-full"
                style={
                  {
                    "--theme-color": themeColor,
                    "--theme-color-rgb": hexToRgb(themeColor || null),
                    "--font-color": appContext?.activeOrg?.font_color,
                  } as React.CSSProperties
                }
              >
                <div className="flex min-w-fit flex-shrink-0">
                  <AppSidebar />
                </div>
                <div className="flex min-w-0 flex-1 flex-grow flex-col">
                  <DashboardHeader />
                  <main className="flex-1 overflow-auto bg-muted/20 px-4 py-6">
                    <Suspense fallback={<Loader />}>
                      <div>{children}</div>
                    </Suspense>
                  </main>
                </div>
              </div>
            </UserInitProvider>
          </AppInitProvider>
        </QueryClientProvider>
      </SidebarProvider>
    </Suspense>
  );
}
