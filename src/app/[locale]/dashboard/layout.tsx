import { redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { UserInitProvider } from "@/lib/providers/user-init-provider";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { QueryClientProvider } from "@/lib/providers/query-client-provider";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();
  const locale = await getLocale();

  if (!userContext || !appContext) {
    return redirect({ href: "/sign-in", locale });
  }

  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
    >
      <QueryClientProvider>
        <AppInitProvider
          context={{
            ...appContext,
            location: null,
          }}
        >
          <UserInitProvider context={userContext}>
            <DashboardShell>{children}</DashboardShell>
          </UserInitProvider>
        </AppInitProvider>
      </QueryClientProvider>
    </Suspense>
  );
}
