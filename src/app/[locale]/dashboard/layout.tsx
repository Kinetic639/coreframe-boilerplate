import LocaleSwitcher from "@/components/LocaleSwitcher";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { getSidebarStateServer } from "@/lib/cookies/get-sidebar-state-server";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { getLocale } from "next-intl/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const userContext = await loadUserContextServer();
  const sidebarState = await getSidebarStateServer(); // "collapsed" lub "expanded"
  const appContext = await loadAppContextServer();
  const context = {
    ...userContext,
    ...appContext,
  };
  const themeColor = appContext?.activeOrg?.theme_color;

  const locale = await getLocale();

  if (!userContext || !appContext) {
    return redirect({ href: "/sign-in", locale });
  }

  // 🔁 Brak sesji – przekieruj na stronę logowania z uwzględnieniem lokalizacji
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }
  return (
    <SidebarProvider defaultOpen={sidebarState === "expanded"}>
      <AppInitProvider context={context}>
        <div
          className="flex min-h-screen w-full"
          style={{ "--theme-color": themeColor } as React.CSSProperties}
        >
          <div className="flex min-h-screen w-full">
            {/* Sidebar with increased z-index to stay on top */}
            <div className="relative z-50">
              <AppSidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-20 flex flex-col bg-background">
                <div className="flex h-14 w-full items-center justify-between border-b border-border px-4">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search bar moved to the right */}
                    <LocaleSwitcher />
                    <ThemeSwitcher />
                    <div className="relative w-64"></div>
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-auto bg-muted/20 px-4 py-6">
                <div className="mb-12">
                  <pre className="text-xs">{JSON.stringify({ appContext }, null, 2)}</pre>
                </div>
                <div>{children}</div>
              </main>
            </div>
          </div>
        </div>
      </AppInitProvider>
    </SidebarProvider>
  );
}
