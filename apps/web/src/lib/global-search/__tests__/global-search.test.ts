import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import pl from "../../../../messages/pl.json";
import en from "../../../../messages/en.json";
import {
  HELPDESK_TICKETS_CREATE,
  MODULE_HELPDESK_ACCESS,
  MODULE_WAREHOUSE_ACCESS,
  MODULE_WORKSHOP_ACCESS,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
} from "@/lib/constants/permissions";
import { MODULE_HELPDESK, MODULE_WAREHOUSE, MODULE_WORKSHOP } from "@/lib/constants/modules";
import type { SidebarModel, SidebarResolverInput } from "@/lib/types/v2/sidebar";
import { buildSearchEntries } from "../build-entries";
import { normalizeSearchText, scoreSearchMatch } from "../match";
import { buildPaletteGroups, parsePaletteQuery, type PaletteItem } from "../palette";
import { SEARCH_ACTIONS, SEARCH_EXTRA_PAGES } from "../registry";

function input(allow: string[], modules: string[]): SidebarResolverInput {
  return {
    locale: "pl",
    permissionSnapshot: { allow, deny: [] },
    entitlements: { enabled_modules: modules, contexts: [], limits: {} },
    context: { activeOrgId: "org-1", activeBranchId: "branch-1" },
  };
}

const sidebar: SidebarModel = {
  main: [
    {
      id: "warehouse",
      title: "Warehouse",
      titleKey: "modules.warehouse.titleSidebar",
      iconKey: "warehouse",
      children: [
        {
          id: "warehouse.inventory",
          title: "Inventory",
          iconKey: "clipboard",
          href: "/dashboard/warehouse/inventory",
        },
        {
          id: "warehouse.purchases",
          title: "Purchases",
          iconKey: "truck",
          href: "/dashboard/warehouse/purchases",
        },
        {
          id: "warehouse.audits",
          title: "Audits",
          iconKey: "clipboard",
          disabledReason: "coming_soon",
        },
      ],
    },
  ],
  footer: [],
};

function lookup(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[part];
    return undefined;
  }, messages);
}

describe("normalizeSearchText / scoreSearchMatch", () => {
  it("ignores case and Polish diacritics", () => {
    expect(normalizeSearchText("  Przyjęcie   ŁÓDŹ ")).toBe("przyjecie lodz");
    expect(scoreSearchMatch("przyjecie", "Przyjęcie dostawy")).toBeGreaterThan(0);
  });

  it("requires every query word to match the label or a keyword", () => {
    expect(scoreSearchMatch("now zl", "Nowe zlecenie")).toBeGreaterThan(0);
    expect(scoreSearchMatch("nowe faktura", "Nowe zlecenie")).toBe(0);
    expect(scoreSearchMatch("matcher", "Nowy ruch", ["matcher", "pz"])).toBeGreaterThan(0);
  });

  it("ranks a label prefix above a keyword hit", () => {
    const prefix = scoreSearchMatch("zap", "Zapytania");
    const keyword = scoreSearchMatch("zap", "Help Desk", ["zapytania"]);
    expect(prefix).toBeGreaterThan(keyword);
  });
});

describe("buildPaletteGroups", () => {
  const items: PaletteItem[] = [
    { id: "p1", kind: "page", section: "warehouse", label: "Stany magazynowe" },
    { id: "p2", kind: "page", section: "workshop", label: "Zlecenia", keywords: ["zl"] },
    { id: "a1", kind: "action", section: "workshop", label: "Nowe zlecenie" },
    { id: "a2", kind: "action", section: "warehouse", label: "Nowy ruch", keywords: ["pz"] },
    { id: "a3", kind: "action", section: "general", label: "Wyloguj się" },
  ];

  it("parses the > actions prefix", () => {
    expect(parsePaletteQuery(" > nowe ")).toMatchObject({ actionsMode: true, text: "nowe" });
    expect(parsePaletteQuery("zl")).toEqual({ actionsMode: false, text: "zl" });
  });

  it("shows quick module actions and pages for an empty query", () => {
    const groups = buildPaletteGroups("", items);
    expect(groups.map((g) => g.id)).toEqual(["quickActions", "goTo"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a1", "a2"]);
  });

  it("lists only actions, grouped by section, in > mode", () => {
    const groups = buildPaletteGroups(">", items);
    expect(groups.map((g) => g.id)).toEqual(["workshop", "warehouse", "general"]);
    expect(buildPaletteGroups("> pz", items)).toEqual([{ id: "warehouse", items: [items[3]] }]);
  });

  it("returns ranked pages then actions for text", () => {
    const groups = buildPaletteGroups("zlec", items);
    expect(groups).toEqual([
      { id: "pages", items: [items[1]] },
      { id: "actions", items: [items[2]] },
    ]);
  });
});

describe("buildSearchEntries", () => {
  it("flattens sidebar pages, skipping groups, disabled items and placeholders", () => {
    const entries = buildSearchEntries(sidebar, input([], []));
    const pages = entries.filter((e) => e.kind === "page");
    expect(pages.map((e) => e.href)).toContain("/dashboard/warehouse/inventory");
    expect(pages.map((e) => e.href)).not.toContain("/dashboard/warehouse/purchases");
    expect(pages.find((e) => e.id === "warehouse.inventory")).toMatchObject({
      section: "warehouse",
      parentTitleKey: "modules.warehouse.titleSidebar",
    });
  });

  it("keeps only actions the user may run in enabled modules", () => {
    const allow = [
      MODULE_WAREHOUSE_ACCESS,
      WAREHOUSE_INVENTORY_READ,
      WAREHOUSE_INVENTORY_OPERATE,
      MODULE_WORKSHOP_ACCESS,
      WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
      MODULE_HELPDESK_ACCESS,
      HELPDESK_TICKETS_CREATE,
    ];
    const ids = buildSearchEntries(sidebar, input(allow, [MODULE_WAREHOUSE, MODULE_WORKSHOP]))
      .filter((e) => e.kind === "action")
      .map((e) => e.id);

    expect(ids).toContain("search.action.newMovement");
    expect(ids).toContain("search.action.newRepairOrder");
    // Help Desk permission without the module entitlement → hidden
    expect(ids).not.toContain("search.action.newTicket");
    // No products.manage → hidden
    expect(ids).not.toContain("search.action.newItem");
    // Ungated general actions are always there
    expect(ids).toContain("search.action.signOut");

    const withHelpDesk = buildSearchEntries(
      sidebar,
      input(allow, [MODULE_WAREHOUSE, MODULE_WORKSHOP, MODULE_HELPDESK])
    ).map((e) => e.id);
    expect(withHelpDesk).toContain("search.action.newTicket");
  });

  it("does not leak visibility rules to the client", () => {
    for (const entry of buildSearchEntries(sidebar, input([], []))) {
      expect(entry).not.toHaveProperty("visibility");
    }
  });
});

describe("search registry", () => {
  const registry = [...SEARCH_EXTRA_PAGES, ...SEARCH_ACTIONS];

  it("points every href at an existing page", () => {
    for (const entry of registry) {
      if (!entry.href) continue;
      const pageFile = path.resolve(process.cwd(), `src/app/[locale]${entry.href}/page.tsx`);
      expect(existsSync(pageFile), entry.href).toBe(true);
    }
  });

  it("has a pl and en title for every entry", () => {
    for (const entry of registry) {
      expect(typeof lookup(pl, entry.titleKey!), `pl ${entry.titleKey}`).toBe("string");
      expect(typeof lookup(en, entry.titleKey!), `en ${entry.titleKey}`).toBe("string");
    }
  });

  it("uses unique ids", () => {
    expect(new Set(registry.map((e) => e.id)).size).toBe(registry.length);
  });
});
