"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Pathnames } from "@/i18n/routing";
import { resolveLocalizedPathnames } from "@/i18n/localized-pathnames";

/**
 * Redirects to a localized pathname with an encoded query message.
 *
 * @param type - Type of message ("error" | "success")
 * @param pathname - Localized pathname key from routing (e.g. "/sign-in")
 * @param message - Message to pass via query string
 */
export async function encodedRedirect(
  type: "error" | "success",
  pathname: Pathnames,
  message: string
) {
  const locale = await getLocale();
  const queryString = new URLSearchParams({ [type]: message }).toString();
  const localizedPaths = resolveLocalizedPathnames(pathname);
  const localizedPath = locale === "en" ? localizedPaths.en : localizedPaths.pl;
  const url = `${localizedPath}${queryString ? `?${queryString}` : ""}`;
  return redirect(url);
}
