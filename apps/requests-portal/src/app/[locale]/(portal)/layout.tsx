import { LogOut, MessageSquareText, ShieldOff } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { signOutAction } from "@/app/actions/auth";
import { AppHeader } from "@/components/portal/app-header";
import { BranchSwitcher } from "@/components/portal/branch-switcher";
import { Toaster } from "@/components/portal/toaster";
import { UserMenu } from "@/components/portal/user-menu";
import { redirect } from "next/navigation";
import { appUrl, buildSignInUrl } from "@repo/app-urls";
import { Link } from "@/i18n/navigation";
import { loadPortalContext } from "@/server/portal-context";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [result, t, locale] = await Promise.all([
    loadPortalContext(),
    getTranslations(),
    getLocale(),
  ]);

  if (result.status === "signed-out") {
    const signInLocale = locale === "en" ? "en" : "pl";
    return redirect(
      buildSignInUrl(appUrl("requests", signInLocale === "en" ? "/en" : "/"), signInLocale)
    );
  }

  if (result.status === "no-access") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ShieldOff className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold">{t("portal.noAccess.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("portal.noAccess.body", { email: result.email })}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t("auth.signOut")}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { user, branches, activeBranchId, ui } = result.context;
  return (
    // Desktop: an app shell of one screen height; the panes below scroll on their own.
    <div className="flex min-h-dvh flex-col bg-muted/40 lg:h-dvh">
      <AppHeader>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight">
            {t("portal.title")}
          </span>
        </Link>
        <span className="flex-1" />
        <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
        <UserMenu
          displayName={user.displayName}
          email={user.email}
          initials={user.initials}
          avatarUrl={user.avatarUrl}
          theme={ui}
        />
      </AppHeader>
      <div className="flex flex-1 flex-col lg:min-h-0">{children}</div>
      <Toaster />
    </div>
  );
}
