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
    "/dashboard/start": {
      en: "/dashboard/start",
      pl: "/dashboard/start",
    },
    "/dashboard/reset-password": {
      en: "/dashboard/reset-password",
      pl: "/dashboard/resetowanie-hasla",
    },

    "/dashboard/admin-dashboard": {
      en: "/dashboard/admin-dashboard",
      pl: "/dashboard/panel-administratora",
    },

    "/dashboard/branch": {
      en: "/dashboard/branch",
      pl: "/dashboard/oddzial",
    },

    // === Warehouse module ===
    "/dashboard/warehouse/products/materials": {
      en: "/dashboard/warehouse/products/materials",
      pl: "/dashboard/magazyn/produkty/materialy",
    },
    "/dashboard/warehouse/products/parts": {
      en: "/dashboard/warehouse/products/parts",
      pl: "/dashboard/magazyn/produkty/czesci",
    },
    "/dashboard/warehouse/suppliers": {
      en: "/dashboard/warehouse/suppliers",
      pl: "/dashboard/magazyn/dostawcy",
    },
    "/dashboard/warehouse/deliveries": {
      en: "/dashboard/warehouse/deliveries",
      pl: "/dashboard/magazyn/dostawy",
    },

    // === Org Management module ===
    "/dashboard/organization/profile": {
      en: "/dashboard/organization/profile",
      pl: "/dashboard/organizacja/profil",
    },
    "/dashboard/organization/branches": {
      en: "/dashboard/organization/branches",
      pl: "/dashboard/organizacja/oddzialy",
    },
    "/dashboard/organization/users": {
      en: "/dashboard/organization/users",
      pl: "/dashboard/organizacja/uzytkownicy",
    },
    "/dashboard/organization/users/list": {
      en: "/dashboard/organization/users/list",
      pl: "/dashboard/organizacja/uzytkownicy/lista",
    },
    "/dashboard/organization/users/roles": {
      en: "/dashboard/organization/users/roles",
      pl: "/dashboard/organizacja/uzytkownicy/role",
    },

    // === Auth ===
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
