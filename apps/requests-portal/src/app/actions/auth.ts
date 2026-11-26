"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { appUrl, buildSignInUrl } from "@repo/app-urls";
import { createClient } from "@/utils/supabase/server";

/**
 * Signs out of every Ambra app at once (the session cookie is shared across
 * subdomains) and sends the user to the shared sign-in on the ERP, which brings
 * them back to the portal afterwards.
 */
export async function signOutAction() {
  const locale = (await getLocale()) === "en" ? "en" : "pl";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(buildSignInUrl(appUrl("requests", locale === "en" ? "/en" : "/"), locale));
}
