import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pl"],
  defaultLocale: "pl",
  localePrefix: "as-needed",
  pathnames: {
    //public
    "/": "/",
    "/features": {
      en: "/features",
      pl: "/funkcjonalonosci",
    },
    "/pricing": {
      en: "/pricing",
      pl: "/cennik",
    },

    "/dashboard": {
      en: "/dashboard",
      pl: "/dashboard",
    },
    "/dashboard/start": {
      en: "/dashboard/start",
      pl: "/dashboard/start",
    },

    "/dashboard/branch": {
      en: "/dashboard/branch",
      pl: "/dashboard/oddzial",
    },

    // === Warehouse module (uzupełnienia) ===

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
    "/dashboard/warehouse/locations": {
      en: "/dashboard/warehouse/locations",
      pl: "/dashboard/magazyn/lokalizacje",
    },
    "/dashboard/warehouse/locations/[id]": {
      en: "/dashboard/warehouse/locations/[id]",
      pl: "/dashboard/magazyn/lokalizacje/[id]",
    },

    "/dashboard/warehouse/audits": {
      en: "/dashboard/warehouse/audits",
      pl: "/dashboard/magazyn/audyty",
    },

    "/dashboard/warehouse/audits/schedule": {
      en: "/dashboard/warehouse/audits/schedule",
      pl: "/dashboard/magazyn/audyty/grafik",
    },
    "/dashboard/warehouse/audits/history": {
      en: "/dashboard/warehouse/audits/history",
      pl: "/dashboard/magazyn/audyty/historia",
    },

    "/dashboard/warehouse/inventory/movements": {
      en: "/dashboard/warehouse/inventory/movements",
      pl: "/dashboard/magazyn/zapasy/ruchy",
    },
    "/dashboard/warehouse/products": {
      en: "/dashboard/warehouse/products",
      pl: "/dashboard/magazyn/produkty",
    },
    "/dashboard/warehouse/products/[id]": {
      en: "/dashboard/warehouse/products/[id]",
      pl: "/dashboard/magazyn/produkty/[id]",
    },
    "/dashboard/warehouse/suppliers": {
      en: "/dashboard/warehouse/suppliers",
      pl: "/dashboard/magazyn/dostawcy",
    },
    "/dashboard/warehouse/deliveries": {
      en: "/dashboard/warehouse/deliveries",
      pl: "/dashboard/magazyn/dostawy",
    },

    // === QR & Labels System (Warehouse module) ===
    "/dashboard/warehouse/labels": {
      en: "/dashboard/warehouse/labels",
      pl: "/dashboard/magazyn/etykiety",
    },
    "/dashboard/warehouse/labels/create": {
      en: "/dashboard/warehouse/labels/create",
      pl: "/dashboard/magazyn/etykiety/kreator",
    },
    "/dashboard/warehouse/labels/assign": {
      en: "/dashboard/warehouse/labels/assign",
      pl: "/dashboard/magazyn/etykiety/przypisz",
    },
    "/dashboard/warehouse/labels/assign/success": {
      en: "/dashboard/warehouse/labels/assign/success",
      pl: "/dashboard/magazyn/etykiety/przypisz/sukces",
    },
    "/dashboard/warehouse/labels/assign/error": {
      en: "/dashboard/warehouse/labels/assign/error",
      pl: "/dashboard/magazyn/etykiety/przypisz/blad",
    },
    "/dashboard/warehouse/labels/templates": {
      en: "/dashboard/warehouse/labels/templates",
      pl: "/dashboard/magazyn/etykiety/szablony",
    },
    "/dashboard/warehouse/labels/templates/create": {
      en: "/dashboard/warehouse/labels/templates/create",
      pl: "/dashboard/magazyn/etykiety/szablony/utworz",
    },
    "/dashboard/warehouse/labels/templates/edit/[id]": {
      en: "/dashboard/warehouse/labels/templates/edit/[id]",
      pl: "/dashboard/magazyn/etykiety/szablony/edytuj/[id]",
    },
    "/dashboard/warehouse/labels/batches": {
      en: "/dashboard/warehouse/labels/batches",
      pl: "/dashboard/magazyn/etykiety/partie",
    },
    "/dashboard/warehouse/labels/history": {
      en: "/dashboard/warehouse/labels/history",
      pl: "/dashboard/magazyn/etykiety/historia",
    },
    "/dashboard/warehouse/scanning": {
      en: "/dashboard/warehouse/scanning",
      pl: "/dashboard/magazyn/skanowanie",
    },
    "/dashboard/warehouse/scanning/delivery": {
      en: "/dashboard/warehouse/scanning/delivery",
      pl: "/dashboard/magazyn/skanowanie/dostawa",
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
    "/dashboard/organization/users/invitations": {
      en: "/dashboard/organization/users/invitations",
      pl: "/dashboard/organizacja/uzytkownicy/zaproszenia",
    },
    "/dashboard/organization/roles/[id]": {
      en: "/dashboard/organization/roles/[id]",
      pl: "/dashboard/organizacja/role/[id]",
    },

    // === Invitation system ===
    "/invite/[token]": {
      en: "/invite/[token]",
      pl: "/zaproszenie/[token]",
    },

    // === QR redirect system ===
    "/qr/[token]": {
      en: "/qr/[token]",
      pl: "/qr/[token]",
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

    // === Support module ===
    "/dashboard/support/help": {
      en: "/dashboard/support/help",
      pl: "/dashboard/wsparcie/pomoc",
    },
    "/dashboard/support/contact": {
      en: "/dashboard/support/contact",
      pl: "/dashboard/wsparcie/kontakt",
    },
    "/dashboard/support/announcements": {
      en: "/dashboard/support/announcements",
      pl: "/dashboard/wsparcie/ogloszenia",
    },
    "/dashboard/support/announcements/changelog": {
      en: "/dashboard/support/announcements/changelog",
      pl: "/dashboard/wsparcie/ogloszenia/zmiany",
    },
    "/dashboard/support/announcements/status": {
      en: "/dashboard/support/announcements/status",
      pl: "/dashboard/wsparcie/ogloszenia/status",
    },
    "/dashboard/support/announcements/roadmap": {
      en: "/dashboard/support/announcements/roadmap",
      pl: "/dashboard/wsparcie/ogloszenia/roadmapa",
    },

    // === Development module ===
    "/dashboard/development": {
      en: "/dashboard/development",
      pl: "/dashboard/deweloperskie",
    },
    "/dashboard/development/permissions": {
      en: "/dashboard/development/permissions",
      pl: "/dashboard/deweloperskie/uprawnienia",
    },
    "/dashboard/development/context": {
      en: "/dashboard/development/context",
      pl: "/dashboard/deweloperskie/kontekst",
    },
    "/dashboard/development/logo": {
      en: "/dashboard/development/logo",
      pl: "/dashboard/deweloperskie/logo",
    },
    "/dashboard/development/service": {
      en: "/dashboard/development/service",
      pl: "/dashboard/deweloperskie/serwis",
    },
    "/dashboard/development/labels": {
      en: "/dashboard/development/labels",
      pl: "/dashboard/deweloperskie/etykiety",
    },
    "/dashboard/development/locations-debug": {
      en: "/dashboard/development/locations-debug",
      pl: "/dashboard/deweloperskie/lokalizacje-debug",
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

export default routing;
