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
    "/tools/svwms-wdd-matcher": {
      en: "/tools/svwms-wdd-matcher",
      pl: "/narzedzia/svwms-wdd-matcher",
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
    "/admin/plans": {
      en: "/admin/plans",
      pl: "/admin/plany",
    },
    "/admin/pricing": {
      en: "/admin/pricing",
      pl: "/admin/cennik",
    },

    // === Dashboard V2 (New Architecture) ===
    "/dashboard/start": {
      en: "/dashboard/start",
      pl: "/dashboard/start",
    },
    "/dashboard/diagnostics": {
      en: "/dashboard/diagnostics",
      pl: "/dashboard/diagnostyka",
    },
    "/dashboard/home": {
      en: "/dashboard/home",
      pl: "/dashboard/dom",
    },
    "/dashboard/warehouse": {
      en: "/dashboard/warehouse",
      pl: "/dashboard/magazyn",
    },
    "/dashboard/warehouse/inventory": {
      en: "/dashboard/warehouse/inventory",
      pl: "/dashboard/magazyn/inwentarz",
    },
    "/dashboard/warehouse/inventory/movements": {
      en: "/dashboard/warehouse/inventory/movements",
      pl: "/dashboard/magazyn/inwentarz/ruchy",
    },
    "/dashboard/warehouse/inventory/movements/[movementId]": {
      en: "/dashboard/warehouse/inventory/movements/[movementId]",
      pl: "/dashboard/magazyn/inwentarz/ruchy/[movementId]",
    },
    "/dashboard/warehouse/inventory/movements/new": {
      en: "/dashboard/warehouse/inventory/movements/new",
      pl: "/dashboard/magazyn/inwentarz/ruchy/nowy",
    },
    "/dashboard/warehouse/inventory/adjustments": {
      en: "/dashboard/warehouse/inventory/adjustments",
      pl: "/dashboard/magazyn/inwentarz/korekty",
    },
    "/dashboard/warehouse/items": {
      en: "/dashboard/warehouse/items",
      pl: "/dashboard/magazyn/produkty",
    },
    "/dashboard/warehouse/items/new": {
      en: "/dashboard/warehouse/items/new",
      pl: "/dashboard/magazyn/produkty/nowy",
    },
    "/dashboard/warehouse/items/import": {
      en: "/dashboard/warehouse/items/import",
      pl: "/dashboard/magazyn/produkty/import",
    },
    "/dashboard/warehouse/items/[productId]": {
      en: "/dashboard/warehouse/items/[productId]",
      pl: "/dashboard/magazyn/produkty/[productId]",
    },
    "/dashboard/warehouse/items/[productId]/edit": {
      en: "/dashboard/warehouse/items/[productId]/edit",
      pl: "/dashboard/magazyn/produkty/[productId]/edytuj",
    },
    "/dashboard/warehouse/locations": {
      en: "/dashboard/warehouse/locations",
      pl: "/dashboard/magazyn/lokalizacje",
    },
    "/dashboard/warehouse/map": {
      en: "/dashboard/warehouse/map",
      pl: "/dashboard/magazyn/mapa",
    },
    "/dashboard/warehouse/map/[layoutId]": {
      en: "/dashboard/warehouse/map/[layoutId]",
      pl: "/dashboard/magazyn/mapa/[layoutId]",
    },
    "/dashboard/warehouse/alerts": {
      en: "/dashboard/warehouse/alerts",
      pl: "/dashboard/magazyn/alerty",
    },
    "/dashboard/warehouse/audits": {
      en: "/dashboard/warehouse/audits",
      pl: "/dashboard/magazyn/audyty",
    },
    "/dashboard/warehouse/sales": {
      en: "/dashboard/warehouse/sales",
      pl: "/dashboard/magazyn/sprzedaz",
    },
    "/dashboard/warehouse/sales-orders": {
      en: "/dashboard/warehouse/sales-orders",
      pl: "/dashboard/magazyn/zamowienia-sprzedazy",
    },
    "/dashboard/warehouse/clients": {
      en: "/dashboard/warehouse/clients",
      pl: "/dashboard/magazyn/klienci",
    },
    "/dashboard/warehouse/purchases": {
      en: "/dashboard/warehouse/purchases",
      pl: "/dashboard/magazyn/zakupy",
    },
    "/dashboard/warehouse/purchase-orders": {
      en: "/dashboard/warehouse/purchase-orders",
      pl: "/dashboard/magazyn/zamowienia-zakupu",
    },
    "/dashboard/warehouse/deliveries": {
      en: "/dashboard/warehouse/deliveries",
      pl: "/dashboard/magazyn/dostawy",
    },
    "/dashboard/warehouse/suppliers": {
      en: "/dashboard/warehouse/suppliers",
      pl: "/dashboard/magazyn/dostawcy",
    },
    "/dashboard/warehouse/scanning/delivery": {
      en: "/dashboard/warehouse/scanning/delivery",
      pl: "/dashboard/magazyn/skanowanie/dostawy",
    },
    "/dashboard/warehouse/labels": {
      en: "/dashboard/warehouse/labels",
      pl: "/dashboard/magazyn/etykiety",
    },
    "/dashboard/warehouse/settings": {
      en: "/dashboard/warehouse/settings",
      pl: "/dashboard/magazyn/ustawienia",
    },
    "/dashboard/teams": {
      en: "/dashboard/teams",
      pl: "/dashboard/zespoly",
    },
    "/dashboard/organization-management": {
      en: "/dashboard/organization-management",
      pl: "/dashboard/zarzadzanie-organizacja",
    },
    "/dashboard/organization/profile": {
      en: "/dashboard/organization/profile",
      pl: "/dashboard/organizacja/profil",
    },
    "/dashboard/organization/users": {
      en: "/dashboard/organization/users",
      pl: "/dashboard/organizacja/uzytkownicy",
    },
    "/dashboard/organization/users/members": {
      en: "/dashboard/organization/users/members",
      pl: "/dashboard/organizacja/uzytkownicy/czlonkowie",
    },
    "/dashboard/organization/users/members/[memberId]": {
      en: "/dashboard/organization/users/members/[memberId]",
      pl: "/dashboard/organizacja/uzytkownicy/czlonkowie/[memberId]",
    },
    "/dashboard/organization/users/invitations": {
      en: "/dashboard/organization/users/invitations",
      pl: "/dashboard/organizacja/uzytkownicy/zaproszenia",
    },
    "/dashboard/organization/users/roles": {
      en: "/dashboard/organization/users/roles",
      pl: "/dashboard/organizacja/uzytkownicy/role",
    },
    "/dashboard/organization/users/positions": {
      en: "/dashboard/organization/users/positions",
      pl: "/dashboard/organizacja/uzytkownicy/stanowiska",
    },
    "/dashboard/organization/users/branches": {
      en: "/dashboard/organization/users/branches",
      pl: "/dashboard/organizacja/uzytkownicy/oddzialy",
    },
    "/dashboard/organization/branches": {
      en: "/dashboard/organization/branches",
      pl: "/dashboard/organizacja/oddzialy",
    },
    "/dashboard/organization/billing": {
      en: "/dashboard/organization/billing",
      pl: "/dashboard/organizacja/rozliczenia",
    },
    "/dashboard/organization/activity": {
      en: "/dashboard/organization/activity",
      pl: "/dashboard/organizacja/aktywnosc",
    },
    "/dashboard/organization/audit": {
      en: "/dashboard/organization/audit",
      pl: "/dashboard/organizacja/audyt",
    },
    "/dashboard/activity": {
      en: "/dashboard/activity",
      pl: "/dashboard/aktywnosc",
    },
    "/dashboard/qr": {
      en: "/dashboard/qr",
      pl: "/dashboard/kody-qr",
    },
    "/dashboard/support": {
      en: "/dashboard/support",
      pl: "/dashboard/wsparcie",
    },
    "/dashboard/access-denied": {
      en: "/dashboard/access-denied",
      pl: "/dashboard/brak-dostepu",
    },

    // === Tools module ===
    "/dashboard/tools": {
      en: "/dashboard/tools",
      pl: "/dashboard/narzedzia",
    },
    "/dashboard/tools/[slug]": {
      en: "/dashboard/tools/[slug]",
      pl: "/dashboard/narzedzia/[slug]",
    },

    // === Invitation system ===
    "/invite/[token]": {
      en: "/invite/[token]",
      pl: "/zaproszenie/[token]",
    },
    "/invite/resolve": {
      en: "/invite/resolve",
      pl: "/zaproszenie/resolve",
    },

    // === Onboarding entry ===
    "/onboarding": {
      en: "/onboarding",
      pl: "/onboarding",
    },

    // === QR redirect system ===
    "/qr/[token]": {
      en: "/qr/[token]",
      pl: "/qr/[token]",
    },

    // === User Account module (V2) ===
    "/dashboard/account": {
      en: "/dashboard/account",
      pl: "/dashboard/konto",
    },
    "/dashboard/account/profile": {
      en: "/dashboard/account/profile",
      pl: "/dashboard/konto/profil",
    },
    "/dashboard/account/preferences": {
      en: "/dashboard/account/preferences",
      pl: "/dashboard/konto/ustawienia",
    },
    "/dashboard/account/notifications": {
      en: "/dashboard/account/notifications",
      pl: "/dashboard/konto/powiadomienia",
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
    "/auth-code-error": {
      en: "/auth-code-error",
      pl: "/blad-uwierzytelniania",
    },
    "/registration-disabled": {
      en: "/registration-disabled",
      pl: "/rejestracja-wylaczona",
    },
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type Locale = (typeof routing.locales)[number];

export default routing;
