import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { appUrl, buildAppChooserUrl, buildSignInUrl } from "@repo/app-urls";
import { createClient } from "@/utils/supabase/server";

export type VmiAccess = "ok" | "signed-out" | "no-access";

/**
 * VMI is for signed-in Ambra users whose organization's plan includes it and who hold
 * module.vmi.access: the same rule as the app chooser (`get_my_ambra_apps`). If the
 * rule cannot run (e.g. the database is behind this code), a signed-in user gets in.
 */
export async function checkVmiAccess(): Promise<VmiAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "signed-out";

  const { data, error } = await supabase.rpc("get_my_ambra_apps");
  if (error) return "ok";
  const rows = (data ?? []) as { organization_id: string; app: string }[];
  return rows.some((row) => row.app === "vmi") ? "ok" : "no-access";
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
