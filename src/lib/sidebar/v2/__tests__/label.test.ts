import { describe, it, expect } from "vitest";
import { resolveSidebarLabel } from "../label";
import type { SidebarItem } from "@/lib/types/v2/sidebar";

function makeItem(overrides: Partial<SidebarItem> & { id: string; title: string }): SidebarItem {
  return { iconKey: "home", ...overrides };
}

const fakeTranslator = {
  t: (key: string) => `[${key}]`,
  has: (_key: string) => true,
};

const missingKeyTranslator = {
  t: (key: string) => `[${key}]`,
  has: (_key: string) => false,
};

describe("resolveSidebarLabel", () => {
  it("returns translated label when titleKey is present and has() is true", () => {
    const item = makeItem({ id: "home", title: "Home", titleKey: "modules.home.title" });
    expect(resolveSidebarLabel(item, fakeTranslator)).toBe("[modules.home.title]");
  });

  it("returns title fallback when titleKey is present but has() is false", () => {
    const item = makeItem({ id: "home", title: "Home", titleKey: "modules.home.title" });
    expect(resolveSidebarLabel(item, missingKeyTranslator)).toBe("Home");
  });

  it("returns title fallback when titleKey is absent", () => {
    const item = makeItem({ id: "org", title: "Organization" });
    expect(resolveSidebarLabel(item, fakeTranslator)).toBe("Organization");
  });

  it("returns title fallback when titleKey is empty string", () => {
    const item = makeItem({ id: "org", title: "Organization", titleKey: "" });
    expect(resolveSidebarLabel(item, fakeTranslator)).toBe("Organization");
  });

  it("calls translator.t with the exact titleKey when has() is true", () => {
    const calls: string[] = [];
    const trackingTranslator = {
      t: (key: string) => {
        calls.push(key);
        return "translated";
      },
      has: (_key: string) => true,
    };
    const item = makeItem({ id: "wh", title: "Warehouse", titleKey: "modules.warehouse.title" });
    resolveSidebarLabel(item, trackingTranslator);
    expect(calls).toEqual(["modules.warehouse.title"]);
  });

  it("does not call translator.t when has() is false", () => {
    const calls: string[] = [];
    const trackingTranslator = {
      t: (key: string) => {
        calls.push(key);
        return "translated";
      },
      has: (_key: string) => false,
    };
    const item = makeItem({ id: "wh", title: "Warehouse", titleKey: "modules.warehouse.title" });
    resolveSidebarLabel(item, trackingTranslator);
    expect(calls).toEqual([]);
  });
});
