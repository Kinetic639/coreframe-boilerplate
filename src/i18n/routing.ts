import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
    "/protected": {
      en: "/protected",
      pl: "/chronione",
    },
    "/sign-in": {
      en: "/sign-in",
      pl: "/logowanie",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];
