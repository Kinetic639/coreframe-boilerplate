import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
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
