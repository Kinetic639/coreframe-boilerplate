import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",

    "/dashboard/start": {
      en: "/dashboard/start",
      pl: "/dashboard/start",
    },

    "/dashboard/branch": {
      en: "/dashboard/branch",
      pl: "/dashboard/oddzial",
    },

    // === Warehouse module (uzupełnienia) ===
    "/dashboard/warehouse/products/list": {
      en: "/dashboard/warehouse/products/list",
      pl: "/dashboard/magazyn/produkty/lista",
    },
    "/dashboard/warehouse/products/accessories": {
      en: "/dashboard/warehouse/products/accessories",
      pl: "/dashboard/magazyn/produkty/akcesoria",
    },
    "/dashboard/warehouse/categories": {
      en: "/dashboard/warehouse/categories",
      pl: "/dashboard/magazyn/kategorie",
    },
    "/dashboard/warehouse/inventory": {
      en: "/dashboard/warehouse/inventory",
      pl: "/dashboard/magazyn/zapasy",
    },
    "/dashboard/warehouse/inventory/levels": {
      en: "/dashboard/warehouse/inventory/levels",
      pl: "/dashboard/magazyn/zapasy/poziomy",
    },
    "/dashboard/warehouse/inventory/movements": {
      en: "/dashboard/warehouse/inventory/movements",
      pl: "/dashboard/magazyn/zapasy/ruchy",
    },
    "/dashboard/warehouse/products": {
      en: "/dashboard/warehouse/products",
      pl: "/dashboard/magazyn/produkty",
    },
    "/dashboard/warehouse/suppliers": {
      en: "/dashboard/warehouse/suppliers",
      pl: "/dashboard/magazyn/dostawcy",
    },
    "/dashboard/warehouse/deliveries": {
      en: "/dashboard/warehouse/deliveries",
      pl: "/dashboard/magazyn/dostawy",
    },
    "/dashboard/warehouse/products/materials": {
      en: "/dashboard/warehouse/products/materials",
      pl: "/dashboard/magazyn/produkty/materialy",
    },
    "/dashboard/warehouse/products/parts": {
      en: "/dashboard/warehouse/products/parts",
      pl: "/dashboard/magazyn/produkty/czesci",
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

    // === Teams module ===
    "/dashboard/teams/members": {
      en: "/dashboard/teams/members",
      pl: "/dashboard/zespoly/czlonkowie",
    },
    "/dashboard/teams/communication": {
      en: "/dashboard/teams/communication",
      pl: "/dashboard/zespoly/komunikacja",
    },
    "/dashboard/teams/communication/chat": {
      en: "/dashboard/teams/communication/chat",
      pl: "/dashboard/zespoly/komunikacja/chat",
    },
    "/dashboard/teams/communication/announcements": {
      en: "/dashboard/teams/communication/announcements",
      pl: "/dashboard/zespoly/komunikacja/ogloszenia",
    },
    "/dashboard/teams/kanban": {
      en: "/dashboard/teams/kanban",
      pl: "/dashboard/zespoly/kanban",
    },
    "/dashboard/teams/calendar": {
      en: "/dashboard/teams/calendar",
      pl: "/dashboard/zespoly/kalendarz",
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
    "/dashboard/reset-password": {
      en: "/dashboard/reset-password",
      pl: "/dashboard/resetowanie-hasla",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];
