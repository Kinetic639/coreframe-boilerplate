import { describe, expect, it, vi } from "vitest";
import type { SearchEntry } from "@/lib/global-search/types";
import {
  resolveSubmenu,
  subItemId,
  subOptionOf,
  type SubmenuContext,
} from "../global-search-submenus";

function context(overrides: Partial<SubmenuContext> = {}): SubmenuContext {
  return {
    t: (key) => key,
    label: (_key, fallback) => fallback ?? "",
    locale: "pl",
    theme: "dark",
    setThemeMode: vi.fn(),
    saveColorTheme: vi.fn(),
    switchLocale: vi.fn(),
    navigate: vi.fn(),
    openInNewTab: vi.fn(() => true),
    copyCode: vi.fn(),
    ...overrides,
  };
}

const entry = (overrides: Partial<SearchEntry>): SearchEntry => ({
  id: "e1",
  kind: "page",
  section: "general",
  title: "Entry",
  iconKey: "home",
  ...overrides,
});

describe("palette submenus", () => {
  it("builds and parses option ids of one parent only", () => {
    const id = subItemId("hit:repairOrder:ro1", "tabStock");
    expect(subOptionOf(id, "hit:repairOrder:ro1")).toBe("tabStock");
    expect(subOptionOf(id, "hit:repairOrder:ro2")).toBeNull();
    expect(subOptionOf("workshop", "workshop")).toBeNull();
    expect(subOptionOf(id, null)).toBeNull();
  });

  it("items without a provider have no submenu", () => {
    expect(
      resolveSubmenu("e1", { type: "entry", entry: entry({ href: "/x" }) }, context())
    ).toBeNull();
    expect(resolveSubmenu("b1", { type: "branch" }, context())).toBeNull();
    expect(resolveSubmenu("e1", undefined, context())).toBeNull();
  });

  it("any entry can declare static links; the row keeps its own action", () => {
    const ctx = context();
    const submenu = resolveSubmenu(
      "e1",
      {
        type: "entry",
        entry: entry({
          href: "/dashboard/warehouse",
          submenu: [
            { id: "settings", title: "Ustawienia", href: "/dashboard/warehouse/settings" },
            {
              id: "low",
              title: "Niskie stany",
              href: "/dashboard/warehouse/inventory",
              query: { low: "1" },
            },
          ],
        }),
      },
      ctx
    );
    expect(submenu?.primary).toBe(false);
    expect(submenu?.options.map((option) => option.label)).toEqual(["Ustawienia", "Niskie stany"]);
    expect(submenu?.select("low")).toBe("close");
    expect(ctx.navigate).toHaveBeenCalledWith("/dashboard/warehouse/inventory", { low: "1" });
  });

  it("an entry with only links opens its submenu on Enter", () => {
    const submenu = resolveSubmenu(
      "e1",
      { type: "entry", entry: entry({ submenu: [{ id: "a", title: "A", href: "/a" }] }) },
      context()
    );
    expect(submenu?.primary).toBe(true);
  });

  it("light / dark: current mode marked, preview does not save, cancel restores", () => {
    const ctx = context();
    const submenu = resolveSubmenu(
      "t",
      { type: "entry", entry: entry({ kind: "action", command: "theme.toggle" }) },
      ctx
    )!;
    expect(submenu.primary).toBe(true);
    expect(submenu.options.find((option) => option.current)?.id).toBe("dark");

    const restore = submenu.begin?.();
    submenu.preview?.("light");
    expect(ctx.setThemeMode).toHaveBeenLastCalledWith("light", false);
    if (typeof restore === "function") restore();
    expect(ctx.setThemeMode).toHaveBeenLastCalledWith("dark", false);

    expect(submenu.select("system")).toBe("collapse");
    expect(ctx.setThemeMode).toHaveBeenLastCalledWith("system", true);
  });

  it("language: picking the other one switches and closes", () => {
    const ctx = context();
    const submenu = resolveSubmenu(
      "l",
      { type: "entry", entry: entry({ kind: "action", command: "locale.toggle" }) },
      ctx
    )!;
    expect(submenu.select("pl")).toBe("close");
    expect(ctx.switchLocale).not.toHaveBeenCalled();
    submenu.select("en");
    expect(ctx.switchLocale).toHaveBeenCalledWith("en");
  });

  it("data results: actions by type, copy keeps the palette open", () => {
    const ctx = context();
    const hit = {
      type: "item" as const,
      id: "p1",
      code: "2K5807221KGRU",
      title: "Poszycie",
      subtitle: null,
      status: null,
      href: "/dashboard/warehouse/items/p1",
    };
    const submenu = resolveSubmenu("hit:item:p1", { type: "hit", hit }, ctx)!;
    expect(submenu.primary).toBe(false);
    expect(submenu.options.map((option) => option.id)).toEqual(["newTab", "copy", "movements"]);
    expect(submenu.select("copy")).toBe("collapse");
    expect(ctx.copyCode).toHaveBeenCalledWith(hit);
    expect(submenu.select("newTab")).toBe("close");
    expect(ctx.openInNewTab).toHaveBeenCalledWith("hit:item:p1");
  });
});
