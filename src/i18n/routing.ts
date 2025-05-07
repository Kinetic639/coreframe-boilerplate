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
    "/protected/reset-password": {
      en: "/protected/reset-password",
      pl: "/chronione/resetowanie-hasla",
    },
    "/sign-in": {
      en: "/sign-in",
      pl: "/logowanie",
    },
    "/sign-up": {
      en: "/sign-up",
      pl: "/rejestracja",
    },
    "/forgot-password": {
      en: "/forgot-password",
      pl: "/zapomnialem-hasla",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];
