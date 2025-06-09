import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
    "/dashboard/reset-password": {
      en: "/dashboard/reset-password",
      pl: "/panel/resetowanie-hasla",
    },
    "/dashboard/admin-dashboard": {
      en: "/dashboard/admin-dashboard",
      pl: "/panel/panel-administratora",
    },
    "/dashboard/branch": {
      en: "/dashboard/branch",
      pl: "/panel/oddzial",
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
