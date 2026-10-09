import {
  MESSAGES_USE,
  HELPDESK_TICKETS_CREATE,
  INVITES_CREATE,
  INVITES_READ,
  MEMBERS_READ,
  MODULE_HELPDESK_ACCESS,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MODULE_WAREHOUSE_ACCESS,
  MODULE_WORKSHOP_ACCESS,
  ORG_READ,
  WAREHOUSE_AUDITS_MANAGE,
  WAREHOUSE_IMPORTS_MANAGE,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_REPORTS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
} from "@/lib/constants/permissions";
import {
  MODULE_HELPDESK,
  MODULE_ORGANIZATION_MANAGEMENT,
  MODULE_WAREHOUSE,
  MODULE_WORKSHOP,
} from "@/lib/constants/modules";
import type { SearchEntry, SearchEntrySection } from "./types";

/**
 * Global search registry — entries that are NOT sidebar items.
 *
 * Sidebar pages are taken from the resolved sidebar model; this catalog adds the
 * pages reachable only from inside a module (map, import, roles, ...) and the
 * actions (`>` mode). Visibility rules mirror the guards of the target pages.
 *
 * Pure data: NO hooks, NO permission checks here — the sidebar resolver applies
 * `visibility` server-side. Titles are i18n keys under `globalSearch.entries`.
 */

const WAREHOUSE = {
  requiresModules: [MODULE_WAREHOUSE],
  requiresPermissions: [MODULE_WAREHOUSE_ACCESS],
};
const WORKSHOP = {
  requiresModules: [MODULE_WORKSHOP],
  requiresPermissions: [MODULE_WORKSHOP_ACCESS],
};
const HELPDESK = {
  requiresModules: [MODULE_HELPDESK],
  requiresPermissions: [MODULE_HELPDESK_ACCESS],
};
const ORGANIZATION = {
  requiresModules: [MODULE_ORGANIZATION_MANAGEMENT],
  requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS],
};

/**
 * Sidebar pages that are still "coming soon" placeholders. They stay in the
 * sidebar but are left out of search results until they work.
 */
export const SEARCH_EXCLUDED_HREFS: ReadonlySet<string> = new Set([
  "/dashboard/warehouse",
  "/dashboard/warehouse/purchases",
  "/dashboard/warehouse/deliveries",
  "/dashboard/warehouse/suppliers",
  "/dashboard/warehouse/inventory/adjustments",
  "/dashboard/warehouse/scanning/delivery",
  "/dashboard/warehouse/labels",
  "/dashboard/warehouse/alerts",
  "/dashboard/warehouse/clients",
  "/dashboard/warehouse/sales",
  "/dashboard/warehouse/sales-orders",
  "/dashboard/warehouse/purchase-orders",
]);

/** Search keywords for sidebar items, keyed by sidebar item id */
export const SIDEBAR_SEARCH_KEYWORDS: Record<string, string[]> = {
  home: ["start", "panel główny", "pulpit", "strona główna", "dashboard", "home"],
  "warehouse.inventory": ["stany", "stan", "zapas", "stock", "inventory"],
  "warehouse.inventory.movements": ["ruchy", "dokumenty", "pz", "rw", "mm", "wz", "movements"],
  "warehouse.putaway": ["rozlokowanie", "rozlokuj", "przyjecie", "dostawa", "putaway"],
  "warehouse.items": ["kartoteka", "czesci", "towary", "produkty", "items", "products", "parts"],
  "warehouse.audits": ["inwentaryzacja", "spis", "liczenie", "audit", "count"],
  "warehouse.locations": ["lokalizacje", "regaly", "polki", "miejsca", "qr", "locations", "bins"],
  "warehouse.settings": ["ustawienia magazynu", "warehouse settings"],
  workshop: ["zlecenia", "zl", "warsztat", "naprawy", "repair orders", "workshop"],
  "help-desk.tickets": ["zapytania", "zgloszenia", "hd", "tickety", "tickets", "requests"],
  "help-desk.ticket-types": ["typy zgloszen", "kategorie", "ticket types"],
  "help-desk.settings": ["ustawienia help desk", "helpdesk settings"],
  "planning.tasks": ["zadania", "pt", "todo", "tasks"],
  "planning.boards": ["tablice", "kanban", "boards"],
  "planning.settings": ["ustawienia planowania", "planning settings"],
  "crm.parties": ["kontrahenci", "firmy", "klienci", "parties", "companies"],
  "crm.contacts": ["kontakty", "osoby", "telefon", "contacts"],
  "organization.profile": ["organizacja", "firma", "profil firmy", "organization profile"],
  "organization.users": ["uzytkownicy", "pracownicy", "czlonkowie", "users", "members"],
  "organization.branches": ["oddzialy", "magazyny dms", "branches", "dms"],
  "organization.billing": ["platnosci", "subskrypcja", "plan", "billing"],
  "analytics.activity": ["aktywnosc", "historia", "activity"],
  "analytics.audit": ["audyt", "logi", "audit log"],
  tools: ["narzedzia", "tools"],
};

function page(
  id: string,
  section: SearchEntrySection,
  href: string,
  iconKey: SearchEntry["iconKey"],
  visibility: SearchEntry["visibility"],
  keywords: string[]
): SearchEntry {
  return {
    id: `search.${id}`,
    kind: "page",
    section,
    title: id,
    titleKey: `globalSearch.entries.${id}`,
    iconKey,
    href,
    visibility,
    keywords,
  };
}

function action(
  id: string,
  section: SearchEntrySection,
  iconKey: SearchEntry["iconKey"],
  target: { href: string } | { command: NonNullable<SearchEntry["command"]> },
  visibility: SearchEntry["visibility"],
  keywords: string[]
): SearchEntry {
  return {
    id: `search.action.${id}`,
    kind: "action",
    section,
    title: id,
    titleKey: `globalSearch.actions.${id}`,
    iconKey,
    visibility,
    keywords,
    ...target,
  };
}

export const SEARCH_EXTRA_PAGES: SearchEntry[] = [
  page(
    "warehouseMap",
    "warehouse",
    "/dashboard/warehouse/map",
    "map",
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_LAYOUTS_READ] },
    ["mapa", "plan magazynu", "layout", "map"]
  ),
  page(
    "warehouseItemsImport",
    "warehouse",
    "/dashboard/warehouse/items/import",
    "products",
    {
      ...WAREHOUSE,
      requiresPermissions: [
        MODULE_WAREHOUSE_ACCESS,
        WAREHOUSE_PRODUCTS_MANAGE,
        WAREHOUSE_IMPORTS_MANAGE,
      ],
    },
    ["import kartoteki", "csv", "excel", "import items"]
  ),
  page(
    "warehouseCustomFields",
    "warehouse",
    "/dashboard/warehouse/items/custom-fields",
    "settings",
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_PRODUCTS_READ] },
    ["pola wlasne", "atrybuty", "custom fields"]
  ),
  page(
    "warehouseReorder",
    "warehouse",
    "/dashboard/warehouse/reports/reorder",
    "barChart",
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_REPORTS_READ] },
    ["raport", "zamowienia", "minimum", "braki", "reorder"]
  ),
  page(
    "organizationMembers",
    "organization",
    "/dashboard/organization/users/members",
    "users",
    { ...ORGANIZATION, requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ] },
    ["czlonkowie", "pracownicy", "uzytkownicy", "members"]
  ),
  page(
    "organizationInvitations",
    "organization",
    "/dashboard/organization/users/invitations",
    "users",
    { ...ORGANIZATION, requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, INVITES_READ] },
    ["zaproszenia", "invitations"]
  ),
  page(
    "organizationRoles",
    "organization",
    "/dashboard/organization/users/roles",
    "shield",
    { ...ORGANIZATION, requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ] },
    ["role", "uprawnienia", "dostep", "roles", "permissions"]
  ),
  page(
    "organizationPositions",
    "organization",
    "/dashboard/organization/users/positions",
    "users",
    { ...ORGANIZATION, requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, MEMBERS_READ] },
    ["stanowiska", "positions"]
  ),
  page(
    "organizationPublicProfile",
    "organization",
    "/dashboard/organization/public-profile",
    "building",
    { ...ORGANIZATION, requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, ORG_READ] },
    ["profil publiczny", "wizytowka", "public profile"]
  ),
  page(
    "messages",
    "general",
    "/dashboard/messages",
    "chat",
    { requiresPermissions: [MESSAGES_USE] },
    ["wiadomosci", "czat", "rozmowy", "napisz", "messages", "chat"]
  ),
  page("accountProfile", "account", "/dashboard/account/profile", "profile", undefined, [
    "moj profil",
    "konto",
    "haslo",
    "profile",
    "account",
  ]),
  page(
    "accountPreferences",
    "account",
    "/dashboard/account/preferences",
    "preferences",
    undefined,
    ["preferencje", "wyglad", "motyw", "kolory", "preferences", "appearance"]
  ),
  page(
    "accountNotifications",
    "account",
    "/dashboard/account/notifications",
    "preferences",
    undefined,
    ["powiadomienia", "notifications"]
  ),
];

export const SEARCH_ACTIONS: SearchEntry[] = [
  action(
    "newRepairOrder",
    "workshop",
    "car",
    { href: "/dashboard/workshop/new" },
    {
      ...WORKSHOP,
      requiresAnyPermissions: [
        WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
        WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
      ],
    },
    ["nowe zlecenie", "dodaj zlecenie", "utworz zlecenie", "new repair order"]
  ),
  action(
    "importRepairOrders",
    "workshop",
    "car",
    { href: "/dashboard/workshop/import" },
    {
      ...WORKSHOP,
      requiresAnyPermissions: [
        WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
        WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
      ],
    },
    ["matcher", "import zlecen", "wdd", "przygotuj zlecenia", "import repair orders"]
  ),
  action(
    "newMovement",
    "warehouse",
    "transfers",
    { href: "/dashboard/warehouse/inventory/movements/new" },
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_INVENTORY_OPERATE] },
    [
      "przyjecie",
      "pz",
      "matcher",
      "wydanie",
      "rw",
      "mm",
      "nowy ruch",
      "dokument",
      "new movement",
      "receipt",
    ]
  ),
  action(
    "putaway",
    "warehouse",
    "truck",
    { href: "/dashboard/warehouse/putaway" },
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_INVENTORY_OPERATE] },
    ["rozlokuj", "rozlokowanie", "odloz", "putaway"]
  ),
  action(
    "newItem",
    "warehouse",
    "products",
    { href: "/dashboard/warehouse/items/new" },
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_PRODUCTS_MANAGE] },
    ["nowa czesc", "nowy towar", "dodaj czesc", "kartoteka", "new item", "new part"]
  ),
  action(
    "newAudit",
    "warehouse",
    "clipboard",
    { href: "/dashboard/warehouse/audits/new" },
    { ...WAREHOUSE, requiresPermissions: [MODULE_WAREHOUSE_ACCESS, WAREHOUSE_AUDITS_MANAGE] },
    ["nowa inwentaryzacja", "spis", "liczenie", "new audit", "stock count"]
  ),
  action(
    "newTicket",
    "helpDesk",
    "ticket",
    { href: "/dashboard/help-desk/tickets/new" },
    { ...HELPDESK, requiresPermissions: [MODULE_HELPDESK_ACCESS, HELPDESK_TICKETS_CREATE] },
    ["nowe zapytanie", "zgloszenie", "ticket", "hd", "new ticket", "new request"]
  ),
  action(
    "inviteMember",
    "organization",
    "users",
    { href: "/dashboard/organization/users/invitations" },
    {
      ...ORGANIZATION,
      requiresPermissions: [MODULE_ORGANIZATION_MANAGEMENT_ACCESS, INVITES_CREATE],
    },
    ["zapros", "dodaj pracownika", "nowy uzytkownik", "invite"]
  ),
  action("toggleTheme", "general", "preferences", { command: "theme.toggle" }, undefined, [
    "motyw",
    "ciemny",
    "jasny",
    "tryb nocny",
    "theme",
    "dark mode",
  ]),
  action("pickColorTheme", "general", "preferences", { command: "colorTheme.pick" }, undefined, [
    "motyw",
    "motyw kolorystyczny",
    "kolory",
    "kolorystyka",
    "wygląd",
    "paleta",
    "color theme",
    "colors",
    "appearance",
  ]),
  action("toggleLocale", "general", "preferences", { command: "locale.toggle" }, undefined, [
    "jezyk",
    "angielski",
    "polski",
    "language",
    "english",
    "polish",
  ]),
  action("signOut", "general", "profile", { command: "auth.signOut" }, undefined, [
    "wyloguj",
    "wylogowanie",
    "sign out",
    "logout",
  ]),
];
