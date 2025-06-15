import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
    "/dashboard": {
      en: "/dashboard",
      pl: "/dashboard",
    },
    "/dashboard/reset-password": {
      en: "/dashboard/reset-password",
      pl: "/dashboard/resetowanie-hasla",
    },
    "/dashboard/warehouse/products/materials": {
      en: "/dashboard/warehouse/products/materials",
      pl: "/dashboard/magazyn/produkty/materialy",
    },
    "/dashboard/admin-dashboard": {
      en: "/dashboard/admin-dashboard",
      pl: "/dashboard/panel-administratora",
    },
    "/dashboard/branch": {
      en: "/dashboard/branch",
      pl: "/dashboard/oddzial",
    },
    "/dashboard/warehouse/deliveries": {
      en: "/dashboard/warehouse/deliveries",
      pl: "/dashboard/magazyn/dostawy",
    },
    "/dashboard/warehouse/suppliers": {
      en: "/dashboard/warehouse/suppliers",
      pl: "/dashboard/magazyn/dostawcy",
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
