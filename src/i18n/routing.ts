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

    // === Admin Panel ===
    "/admin": {
      en: "/admin",
      pl: "/admin",
    },
    "/admin/testing": {
      en: "/admin/testing",
      pl: "/admin/testowanie",
    },
    "/admin/testing/api": {
      en: "/admin/testing/api",
      pl: "/admin/testowanie/api",
    },
    "/admin/testing/database": {
      en: "/admin/testing/database",
      pl: "/admin/testowanie/baza-danych",
    },
    "/admin/testing/permissions": {
      en: "/admin/testing/permissions",
      pl: "/admin/testowanie/uprawnienia",
    },
    "/admin/app-management": {
      en: "/admin/app-management",
      pl: "/admin/zarzadzanie-aplikacja",
    },
    "/admin/app-management/users": {
      en: "/admin/app-management/users",
      pl: "/admin/zarzadzanie-aplikacja/uzytkownicy",
    },
    "/admin/app-management/organizations": {
      en: "/admin/app-management/organizations",
      pl: "/admin/zarzadzanie-aplikacja/organizacje",
    },
    "/admin/app-management/config": {
      en: "/admin/app-management/config",
      pl: "/admin/zarzadzanie-aplikacja/konfiguracja",
    },
    "/admin/logs": {
      en: "/admin/logs",
      pl: "/admin/logi",
    },
    "/admin/analytics": {
      en: "/admin/analytics",
      pl: "/admin/analityka",
    },

    "/dashboard-old": {
      en: "/dashboard-old",
      pl: "/dashboard-old",
    },
    "/dashboard-old/start": {
      en: "/dashboard-old/start",
      pl: "/dashboard-old/start",
    },
    "/dashboard-old/start/getting-started": {
      en: "/dashboard-old/start/getting-started",
      pl: "/dashboard-old/start/pierwsze-kroki",
    },
    "/dashboard-old/start/recent-updates": {
      en: "/dashboard-old/start/recent-updates",
      pl: "/dashboard-old/start/ostatnie-aktualizacje",
    },
    "/dashboard-old/announcements": {
      en: "/dashboard-old/announcements",
      pl: "/dashboard-old/ogloszenia",
    },
    "/dashboard-old/announcements/[id]": {
      en: "/dashboard-old/announcements/[id]",
      pl: "/dashboard-old/ogloszenia/[id]",
    },

    "/dashboard-old/branch": {
      en: "/dashboard-old/branch",
      pl: "/dashboard-old/oddzial",
    },

    // === Contacts module ===
    "/dashboard-old/contacts": {
      en: "/dashboard-old/contacts",
      pl: "/dashboard-old/kontakty",
    },
    "/dashboard-old/contacts/[id]": {
      en: "/dashboard-old/contacts/[id]",
      pl: "/dashboard-old/kontakty/[id]",
    },

    // === Warehouse module (uzupełnienia) ===
    "/dashboard-old/warehouse": {
      en: "/dashboard-old/warehouse",
      pl: "/dashboard-old/magazyn",
    },
    "/dashboard-old/warehouse/products/accessories": {
      en: "/dashboard-old/warehouse/products/accessories",
      pl: "/dashboard-old/magazyn/produkty/akcesoria",
    },
    "/dashboard-old/warehouse/categories": {
      en: "/dashboard-old/warehouse/categories",
      pl: "/dashboard-old/magazyn/kategorie",
    },
    "/dashboard-old/warehouse/settings": {
      en: "/dashboard-old/warehouse/settings",
      pl: "/dashboard-old/magazyn/ustawienia",
    },
    "/dashboard-old/warehouse/settings/units": {
      en: "/dashboard-old/warehouse/settings/units",
      pl: "/dashboard-old/magazyn/ustawienia/jednostki",
    },
    "/dashboard-old/warehouse/settings/variant-options": {
      en: "/dashboard-old/warehouse/settings/variant-options",
      pl: "/dashboard-old/magazyn/ustawienia/grupy-opcji-wariantow",
    },
    "/dashboard-old/warehouse/settings/custom-fields": {
      en: "/dashboard-old/warehouse/settings/custom-fields",
      pl: "/dashboard-old/magazyn/ustawienia/pola-niestandardowe",
    },
    "/dashboard-old/warehouse/settings/categories": {
      en: "/dashboard-old/warehouse/settings/categories",
      pl: "/dashboard-old/magazyn/ustawienia/kategorie",
    },
    "/dashboard-old/warehouse/settings/products-templates": {
      en: "/dashboard-old/warehouse/settings/products-templates",
      pl: "/dashboard-old/magazyn/ustawienia/szablony-produktow",
    },
    "/dashboard-old/warehouse/inventory": {
      en: "/dashboard-old/warehouse/inventory",
      pl: "/dashboard-old/magazyn/zapasy",
    },
    "/dashboard-old/warehouse/locations": {
      en: "/dashboard-old/warehouse/locations",
      pl: "/dashboard-old/magazyn/lokalizacje",
    },
    "/dashboard-old/warehouse/locations/[id]": {
      en: "/dashboard-old/warehouse/locations/[id]",
      pl: "/dashboard-old/magazyn/lokalizacje/[id]",
    },

    "/dashboard-old/warehouse/audits": {
      en: "/dashboard-old/warehouse/audits",
      pl: "/dashboard-old/magazyn/audyty",
    },

    "/dashboard-old/warehouse/audits/schedule": {
      en: "/dashboard-old/warehouse/audits/schedule",
      pl: "/dashboard-old/magazyn/audyty/grafik",
    },
    "/dashboard-old/warehouse/audits/history": {
      en: "/dashboard-old/warehouse/audits/history",
      pl: "/dashboard-old/magazyn/audyty/historia",
    },

    "/dashboard-old/warehouse/inventory/movements": {
      en: "/dashboard-old/warehouse/inventory/movements",
      pl: "/dashboard-old/magazyn/zapasy/ruchy",
    },
    "/dashboard-old/warehouse/inventory/movements/new": {
      en: "/dashboard-old/warehouse/inventory/movements/new",
      pl: "/dashboard-old/magazyn/zapasy/ruchy/nowy",
    },
    "/dashboard-old/warehouse/inventory/adjustments": {
      en: "/dashboard-old/warehouse/inventory/adjustments",
      pl: "/dashboard-old/magazyn/zapasy/korekty",
    },
    "/dashboard-old/warehouse/products": {
      en: "/dashboard-old/warehouse/products",
      pl: "/dashboard-old/magazyn/produkty",
    },
    "/dashboard-old/warehouse/products/[id]": {
      en: "/dashboard-old/warehouse/products/[id]",
      pl: "/dashboard-old/magazyn/produkty/[id]",
    },
    "/dashboard-old/warehouse/products/groups/new": {
      en: "/dashboard-old/warehouse/products/groups/new",
      pl: "/dashboard-old/magazyn/produkty/grupy/nowa",
    },
    "/dashboard-old/warehouse/products/groups/[id]": {
      en: "/dashboard-old/warehouse/products/groups/[id]",
      pl: "/dashboard-old/magazyn/produkty/grupy/[id]",
    },
    "/dashboard-old/warehouse/products/templates": {
      en: "/dashboard-old/warehouse/products/templates",
      pl: "/dashboard-old/magazyn/produkty/szablony",
    },
    "/dashboard-old/warehouse/products/templates/create": {
      en: "/dashboard-old/warehouse/products/templates/create",
      pl: "/dashboard-old/magazyn/produkty/szablony/utworz",
    },
    "/dashboard-old/warehouse/products/templates/edit/[id]": {
      en: "/dashboard-old/warehouse/products/templates/edit/[id]",
      pl: "/dashboard-old/magazyn/produkty/szablony/edytuj/[id]",
    },
    "/dashboard-old/warehouse/products/templates/clone/[id]": {
      en: "/dashboard-old/warehouse/products/templates/clone/[id]",
      pl: "/dashboard-old/magazyn/produkty/szablony/klonuj/[id]",
    },
    "/dashboard-old/warehouse/products/create": {
      en: "/dashboard-old/warehouse/products/create",
      pl: "/dashboard-old/magazyn/produkty/utworz",
    },
    "/dashboard-old/warehouse/suppliers": {
      en: "/dashboard-old/warehouse/suppliers",
      pl: "/dashboard-old/magazyn/dostawcy",
    },
    "/dashboard-old/warehouse/suppliers/list": {
      en: "/dashboard-old/warehouse/suppliers/list",
      pl: "/dashboard-old/magazyn/dostawcy/lista",
    },
    "/dashboard-old/warehouse/clients": {
      en: "/dashboard-old/warehouse/clients",
      pl: "/dashboard-old/magazyn/klienci",
    },
    "/dashboard-old/warehouse/deliveries": {
      en: "/dashboard-old/warehouse/deliveries",
      pl: "/dashboard-old/magazyn/dostawy",
    },

    // === QR & Labels System (Warehouse module) ===
    "/dashboard-old/warehouse/labels": {
      en: "/dashboard-old/warehouse/labels",
      pl: "/dashboard-old/magazyn/etykiety",
    },
    "/dashboard-old/warehouse/labels/create": {
      en: "/dashboard-old/warehouse/labels/create",
      pl: "/dashboard-old/magazyn/etykiety/kreator",
    },
    "/dashboard-old/warehouse/labels/assign": {
      en: "/dashboard-old/warehouse/labels/assign",
      pl: "/dashboard-old/magazyn/etykiety/przypisz",
    },
    "/dashboard-old/warehouse/labels/assign/success": {
      en: "/dashboard-old/warehouse/labels/assign/success",
      pl: "/dashboard-old/magazyn/etykiety/przypisz/sukces",
    },
    "/dashboard-old/warehouse/labels/assign/error": {
      en: "/dashboard-old/warehouse/labels/assign/error",
      pl: "/dashboard-old/magazyn/etykiety/przypisz/blad",
    },
    "/dashboard-old/warehouse/labels/templates": {
      en: "/dashboard-old/warehouse/labels/templates",
      pl: "/dashboard-old/magazyn/etykiety/szablony",
    },
    "/dashboard-old/warehouse/labels/templates/create": {
      en: "/dashboard-old/warehouse/labels/templates/create",
      pl: "/dashboard-old/magazyn/etykiety/szablony/utworz",
    },
    "/dashboard-old/warehouse/labels/templates/edit/[id]": {
      en: "/dashboard-old/warehouse/labels/templates/edit/[id]",
      pl: "/dashboard-old/magazyn/etykiety/szablony/edytuj/[id]",
    },
    "/dashboard-old/warehouse/labels/history": {
      en: "/dashboard-old/warehouse/labels/history",
      pl: "/dashboard-old/magazyn/etykiety/historia",
    },
    "/dashboard-old/warehouse/scanning": {
      en: "/dashboard-old/warehouse/scanning",
      pl: "/dashboard-old/magazyn/skanowanie",
    },
    "/dashboard-old/warehouse/scanning/delivery": {
      en: "/dashboard-old/warehouse/scanning/delivery",
      pl: "/dashboard-old/magazyn/skanowanie/dostawa",
    },

    // === Transfers (Warehouse module) ===
    "/dashboard-old/warehouse/transfers": {
      en: "/dashboard-old/warehouse/transfers",
      pl: "/dashboard-old/magazyn/transfery",
    },
    "/dashboard-old/warehouse/transfers/new": {
      en: "/dashboard-old/warehouse/transfers/new",
      pl: "/dashboard-old/magazyn/transfery/nowy",
    },
    "/dashboard-old/warehouse/transfers/[id]": {
      en: "/dashboard-old/warehouse/transfers/[id]",
      pl: "/dashboard-old/magazyn/transfery/[id]",
    },

    // === Org Management module ===
    "/dashboard-old/organization": {
      en: "/dashboard-old/organization",
      pl: "/dashboard-old/organizacja",
    },
    "/dashboard-old/organization/profile": {
      en: "/dashboard-old/organization/profile",
      pl: "/dashboard-old/organizacja/profil",
    },
    "/dashboard-old/organization/branches": {
      en: "/dashboard-old/organization/branches",
      pl: "/dashboard-old/organizacja/oddzialy",
    },
    "/dashboard-old/organization/users": {
      en: "/dashboard-old/organization/users",
      pl: "/dashboard-old/organizacja/uzytkownicy",
    },
    "/dashboard-old/organization/users/list": {
      en: "/dashboard-old/organization/users/list",
      pl: "/dashboard-old/organizacja/uzytkownicy/lista",
    },
    "/dashboard-old/organization/users/roles": {
      en: "/dashboard-old/organization/users/roles",
      pl: "/dashboard-old/organizacja/uzytkownicy/role",
    },
    "/dashboard-old/organization/users/invitations": {
      en: "/dashboard-old/organization/users/invitations",
      pl: "/dashboard-old/organizacja/uzytkownicy/zaproszenia",
    },
    "/dashboard-old/organization/users/[id]": {
      en: "/dashboard-old/organization/users/[id]",
      pl: "/dashboard-old/organizacja/uzytkownicy/[id]",
    },
    "/dashboard-old/organization/roles/[id]": {
      en: "/dashboard-old/organization/roles/[id]",
      pl: "/dashboard-old/organizacja/role/[id]",
    },
    "/dashboard-old/organization/billing": {
      en: "/dashboard-old/organization/billing",
      pl: "/dashboard-old/organizacja/rozliczenia",
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
    "/dashboard-old/teams": {
      en: "/dashboard-old/teams",
      pl: "/dashboard-old/zespoly",
    },
    "/dashboard-old/teams/communication": {
      en: "/dashboard-old/teams/communication",
      pl: "/dashboard-old/zespoly/komunikacja",
    },
    "/dashboard-old/teams/communication/chat": {
      en: "/dashboard-old/teams/communication/chat",
      pl: "/dashboard-old/zespoly/komunikacja/chat",
    },
    "/dashboard-old/teams/communication/chat/[chatId]": {
      en: "/dashboard-old/teams/communication/chat/[chatId]",
      pl: "/dashboard-old/zespoly/komunikacja/chat/[chatId]",
    },
    "/dashboard-old/teams/communication/announcements": {
      en: "/dashboard-old/teams/communication/announcements",
      pl: "/dashboard-old/zespoly/komunikacja/ogloszenia",
    },
    "/dashboard-old/teams/kanban": {
      en: "/dashboard-old/teams/kanban",
      pl: "/dashboard-old/zespoly/kanban",
    },
    "/dashboard-old/teams/calendar": {
      en: "/dashboard-old/teams/calendar",
      pl: "/dashboard-old/zespoly/kalendarz",
    },

    // === Support module ===
    "/dashboard-old/support": {
      en: "/dashboard-old/support",
      pl: "/dashboard-old/wsparcie",
    },
    "/dashboard-old/support/help": {
      en: "/dashboard-old/support/help",
      pl: "/dashboard-old/wsparcie/pomoc",
    },
    "/dashboard-old/support/contact": {
      en: "/dashboard-old/support/contact",
      pl: "/dashboard-old/wsparcie/kontakt",
    },
    "/dashboard-old/support/announcements": {
      en: "/dashboard-old/support/announcements",
      pl: "/dashboard-old/wsparcie/ogloszenia",
    },
    "/dashboard-old/support/announcements/changelog": {
      en: "/dashboard-old/support/announcements/changelog",
      pl: "/dashboard-old/wsparcie/ogloszenia/zmiany",
    },
    "/dashboard-old/support/announcements/status": {
      en: "/dashboard-old/support/announcements/status",
      pl: "/dashboard-old/wsparcie/ogloszenia/status",
    },
    "/dashboard-old/support/announcements/roadmap": {
      en: "/dashboard-old/support/announcements/roadmap",
      pl: "/dashboard-old/wsparcie/ogloszenia/roadmapa",
    },

    // === Development module ===
    "/dashboard-old/development": {
      en: "/dashboard-old/development",
      pl: "/dashboard-old/deweloperskie",
    },
    "/dashboard-old/development/permissions": {
      en: "/dashboard-old/development/permissions",
      pl: "/dashboard-old/deweloperskie/uprawnienia",
    },
    "/dashboard-old/development/context": {
      en: "/dashboard-old/development/context",
      pl: "/dashboard-old/deweloperskie/kontekst",
    },
    "/dashboard-old/development/logo": {
      en: "/dashboard-old/development/logo",
      pl: "/dashboard-old/deweloperskie/logo",
    },
    "/dashboard-old/development/service": {
      en: "/dashboard-old/development/service",
      pl: "/dashboard-old/deweloperskie/serwis",
    },
    "/dashboard-old/development/labels": {
      en: "/dashboard-old/development/labels",
      pl: "/dashboard-old/deweloperskie/etykiety",
    },
    "/dashboard-old/development/locations-debug": {
      en: "/dashboard-old/development/locations-debug",
      pl: "/dashboard-old/deweloperskie/lokalizacje-debug",
    },
    "/dashboard-old/development/rich-text-editor": {
      en: "/dashboard-old/development/rich-text-editor",
      pl: "/dashboard-old/deweloperskie/rich-text-editor",
    },
    "/dashboard-old/development/sku-generator": {
      en: "/dashboard-old/development/sku-generator",
      pl: "/dashboard-old/deweloperskie/generator-sku",
    },
    "/dashboard-old/development/reservations-test": {
      en: "/dashboard-old/development/reservations-test",
      pl: "/dashboard-old/deweloperskie/test-rezerwacji",
    },
    "/dashboard-old/dev/subscription-test": {
      en: "/dashboard-old/dev/subscription-test",
      pl: "/dashboard-old/dev/test-subskrypcji",
    },

    // === User Account module ===
    "/dashboard-old/account/profile": {
      en: "/dashboard-old/account/profile",
      pl: "/dashboard-old/konto/profil",
    },
    "/dashboard-old/account/preferences": {
      en: "/dashboard-old/account/preferences",
      pl: "/dashboard-old/konto/ustawienia",
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
    "/reset-password": {
      en: "/reset-password",
      pl: "/zresetuj-haslo",
    },
    "/dashboard-old/reset-password": {
      en: "/dashboard-old/reset-password",
      pl: "/dashboard-old/resetowanie-hasla",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export default routing;
