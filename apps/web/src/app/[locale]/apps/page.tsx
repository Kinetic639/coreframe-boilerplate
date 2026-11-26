import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect as redirectToUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appHomeUrl, decideLanding, LAST_APP_COOKIE, OPEN_LAST_APP_COOKIE } from "@repo/app-urls";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthUser } from "@/server/auth/get-auth-user";
import { loadAppContextV2 } from "@/server/loaders/v2/load-app-context.v2";
import { loadMyAmbraApps } from "@/server/ambra-apps/load-my-ambra-apps";
import { AppChooser } from "./_components/app-chooser";
import { NoAppAccess } from "./_components/no-app-access";
import { formatGreetingDate, isEvening } from "./_components/greeting-time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ambraApps.chooser");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * After sign-in: open the user's only app, or the last one if they asked for
 * that, or let them choose among the apps their plan and permissions open
 * (`get_my_ambra_apps`).
 */
export default async function AppsPage() {
  const locale = (await getLocale()) === "en" ? "en" : "pl";

  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return redirect({ href: "/sign-in", locale });

  const appContext = await loadAppContextV2();
  const organizationId = appContext?.activeOrgId;
  if (!organizationId) return redirect({ href: "/onboarding", locale });

  const myApps = await loadMyAmbraApps(organizationId);
  // The rule could not run (e.g. the database is behind this code): keep the
  // behaviour from before the chooser and open the ERP.
  if (!myApps.ok) return redirect({ href: "/dashboard/start", locale });

  const cookieStore = await cookies();
  const lastAppCookie = cookieStore.get(LAST_APP_COOKIE)?.value ?? null;
  const openLast = cookieStore.get(OPEN_LAST_APP_COOKIE)?.value === "1";
  const decision = decideLanding(myApps.apps, { lastApp: lastAppCookie, openLast });

  if (decision.kind === "none") return <NoAppAccess email={user.email ?? ""} />;
  if (decision.kind === "open") return redirectToUrl(appHomeUrl(decision.app, locale));

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();
  const firstName =
    (profile?.first_name as string | null | undefined) ??
    (user.user_metadata?.first_name as string | undefined) ??
    null;

  const now = new Date();
  return (
    <AppChooser
      apps={myApps.apps.map((id) => ({ id, href: appHomeUrl(id, locale) }))}
      lastApp={decision.lastApp}
      openLast={openLast}
      firstName={firstName?.trim() || null}
      email={user.email ?? ""}
      organizationName={appContext?.activeOrg?.name ?? null}
      dateLabel={formatGreetingDate(now, locale)}
      evening={isEvening(now)}
    />
  );
}
