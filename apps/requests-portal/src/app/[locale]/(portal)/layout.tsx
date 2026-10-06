import { LogOut, MessageSquareText, ShieldOff } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { signOutAction } from "@/app/actions/auth";
import { BranchSwitcher } from "@/components/portal/branch-switcher";
import { UserMenu } from "@/components/portal/user-menu";
import { redirect } from "@/i18n/navigation";
import { loadPortalContext } from "@/server/portal-context";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [result, t, locale] = await Promise.all([
    loadPortalContext(),
    getTranslations(),
    getLocale(),
  ]);

  if (result.status === "signed-out") return redirect({ href: "/sign-in", locale });

  if (result.status === "no-access") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-muted px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600">
            <ShieldOff className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold">{t("portal.noAccess.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("portal.noAccess.body", { email: result.email })}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t("auth.signOut")}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { user, branches, activeBranchId } = result.context;
  return (
    <div className="flex min-h-dvh flex-col bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-stone-200 bg-white px-4 py-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary text-stone-900">
          <MessageSquareText className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="flex-1 text-[17px] font-semibold tracking-tight">{t("portal.title")}</span>
        <BranchSwitcher branches={branches} activeBranchId={activeBranchId} />
        <UserMenu displayName={user.displayName} email={user.email} initials={user.initials} />
      </header>
      {children}
    </div>
  );
}
