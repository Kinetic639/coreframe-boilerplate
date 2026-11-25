import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { unstable_rethrow } from "next/navigation";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time/time-zone";
import { getTimeZoneSettings } from "@/server/time-zone";

/**
 * The zone to format dates in: the user's own, else their organization's,
 * else Europe/Warsaw. Outside a request (build-time rendering) or on any
 * failure, the app default.
 */
async function resolveRequestTimeZone(): Promise<string> {
  try {
    return (await getTimeZoneSettings()).effective;
  } catch (error) {
    // Let Next.js see dynamic-usage and navigation signals.
    unstable_rethrow(error);
    return DEFAULT_TIME_ZONE;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Without an explicit zone next-intl falls back to the server's zone (UTC
    // on Vercel) and passes it on to NextIntlClientProvider, so every
    // `useFormatter().dateTime()` / `getFormatter()` showed UTC times.
    timeZone: await resolveRequestTimeZone(),
    messages: {
      // Load main messages
      ...(await import(`../../messages/${locale}.json`)).default,
      // Load organization module messages
      organization: {
        ...(await import(`../../messages/${locale}/organization/general.json`)).default,
        roleManagement: (await import(`../../messages/${locale}/organization/roleManagement.json`))
          .default,
      },
    },
  };
});
