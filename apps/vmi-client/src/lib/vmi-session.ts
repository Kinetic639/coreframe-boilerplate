import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import {
  AMBRA_WORK_APPS,
  appUrl,
  buildAppChooserUrl,
  buildSignInUrl,
  isAmbraWorkApp,
  type AmbraWorkApp,
} from "@repo/app-urls";
import { createClient } from "@/utils/supabase/server";

export type VmiAccess = "ok" | "signed-out" | "no-access";

type MyAmbraApps = { signedIn: false } | { signedIn: true; apps: AmbraWorkApp[] | null };

/** The signed-in user's Ambra apps (`get_my_ambra_apps`), once per request; null if the rule cannot run. */
const loadMyAmbraApps = cache(async (): Promise<MyAmbraApps> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false };

  const { data, error } = await supabase.rpc("get_my_ambra_apps");
  if (error) return { signedIn: true, apps: null };
  const mine = new Set<AmbraWorkApp>();
  for (const row of (data ?? []) as { organization_id: string; app: string }[]) {
    if (isAmbraWorkApp(row.app)) mine.add(row.app);
  }
  return { signedIn: true, apps: AMBRA_WORK_APPS.filter((app) => mine.has(app)) };
});

/**
 * VMI is for signed-in Ambra users whose organization's plan includes it and who hold
 * module.vmi.access: the same rule as the app chooser (`get_my_ambra_apps`). If the
 * rule cannot run (e.g. the database is behind this code), a signed-in user gets in.
 */
export async function checkVmiAccess(): Promise<VmiAccess> {
  const mine = await loadMyAmbraApps();
  if (!mine.signedIn) return "signed-out";
  if (mine.apps === null) return "ok";
  return mine.apps.includes("vmi") ? "ok" : "no-access";
}

/** The apps for the header switcher. VMI is always there, so the user can leave it. */
export async function getSwitcherApps(): Promise<AmbraWorkApp[]> {
  const mine = await loadMyAmbraApps();
  const apps = mine.signedIn && mine.apps ? mine.apps : [];
  return AMBRA_WORK_APPS.filter((app) => app === "vmi" || apps.includes(app));
}

/** For VMI pages: signed-out users go to the shared sign-in, users without VMI to the app chooser. */
export async function requireVmiAccess(): Promise<void> {
  const access = await checkVmiAccess();
  if (access === "ok") return;
  const locale = (await getLocale()) === "en" ? "en" : "pl";
  if (access === "signed-out") {
    redirect(buildSignInUrl(appUrl("vmi", locale === "en" ? "/en/portal" : "/portal"), locale));
  }
  redirect(buildAppChooserUrl(locale));
}
