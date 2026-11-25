import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time/time-zone";

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Without an explicit zone next-intl falls back to the server's zone (UTC
    // on Vercel) and passes it on to NextIntlClientProvider, so every
    // `useFormatter().dateTime()` / `getFormatter()` showed UTC times.
    timeZone: DEFAULT_TIME_ZONE,
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
