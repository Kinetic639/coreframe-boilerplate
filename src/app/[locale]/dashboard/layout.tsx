import HeaderAuth from "@/components/header-auth";
import { Link, redirect } from "@/i18n/navigation";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { AppInitProvider } from "@/lib/providers/app-init-provider";
import { getLocale } from "next-intl/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();
  const context = {
    ...userContext,
    ...appContext,
  };

  const locale = await getLocale();

  if (!userContext || !appContext) {
    return redirect({ href: "/sign-in", locale });
  }

  // 🔁 Brak sesji – przekieruj na stronę logowania z uwzględnieniem lokalizacji
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }
  return (
    <AppInitProvider context={context}>
      <div className="flex min-h-screen w-full flex-col">
        <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
          <div className="flex w-full max-w-5xl items-center justify-between p-3 px-5 text-sm">
            <div className="flex items-center gap-5 font-semibold">
              <Link href={"/"}>CoreFrame Boilerplate</Link>
            </div>
            <HeaderAuth />
          </div>
        </nav>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 p-5">
            <div className="w-full rounded bg-muted p-4 text-xs">
              <pre>{JSON.stringify(context, null, 2)}</pre>
            </div>
            {children}
          </div>
        </main>
      </div>
    </AppInitProvider>
  );
}
