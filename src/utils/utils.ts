"use server";

import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import type { Pathnames } from "@/i18n/routing";

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

  return redirect({
    href: {
      pathname,
      query: {
        [type]: message,
      },
    },
    locale,
  });
}
