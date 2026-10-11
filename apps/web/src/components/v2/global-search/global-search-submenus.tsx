"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  Copy,
  ExternalLink,
  History,
  Languages,
  Monitor,
  Moon,
  Package,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { COLOR_THEMES } from "@/lib/constants/color-themes";
import { getActiveColorTheme, previewColorTheme } from "@/lib/global-search/color-theme";
import type { SearchEntry } from "@/lib/global-search/types";
import type { SearchExactHit } from "@/server/services/global-search.service";
import { repairOrderTabHref } from "./global-search-preview";

/**
 * Submenus of palette items.
 *
 * Any item (page, action, data result) can have a submenu that expands under
 * its row like an accordion: → (or the chevron) opens it, ↑↓ move inside,
 * Enter picks, Esc / ← collapses back to the row. What a submenu contains
 * comes from a provider below — adding one does not touch the dialog:
 *   - an entry's static `submenu` links (registry data),
 *   - a command with choices (colour theme, light / dark, language),
 *   - actions on a data result (new tab, copy number, order tabs, …).
 */

export interface PaletteSubOption {
  id: string;
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Colour swatches shown instead of an icon (colour themes) */
  swatch?: string[];
  /** The option in effect now */
  current?: boolean;
}

export interface PaletteSubmenu {
  /**
   * The row has no action of its own: Enter (and a click) opens the submenu.
   * Otherwise Enter runs the row and only → / the chevron open it.
   */
  primary: boolean;
  options: PaletteSubOption[];
  /** Option highlighted when the submenu opens (default: the current, else the first) */
  initialOptionId?: string;
  /** Value shown on the collapsed row ("Bursztyn", "Ciemny") */
  currentLabel?: string;
  /**
   * Called when the submenu opens; returns how to undo previews. Collapsing
   * without picking (Esc, ←, closing the palette) calls the returned function.
   */
  begin?: () => (() => void) | void;
  /** Highlighting an option (arrows or pointer) previews it */
  preview?: (optionId: string) => void;
  /** Picks the option; "close" closes the palette, "collapse" returns to the row */
  select: (optionId: string) => "close" | "collapse";
}

export const SUB_ITEM_PREFIX = "sub:";
const SUB_SEPARATOR = "::";

export function subItemId(parentId: string, optionId: string): string {
  return `${SUB_ITEM_PREFIX}${parentId}${SUB_SEPARATOR}${optionId}`;
}

/** The option id of a submenu row of `parentId`, or null for any other item */
export function subOptionOf(itemId: string, parentId: string | null): string | null {
  if (!parentId) return null;
  const prefix = `${SUB_ITEM_PREFIX}${parentId}${SUB_SEPARATOR}`;
  return itemId.startsWith(prefix) ? itemId.slice(prefix.length) : null;
}

/** What the providers need from the dialog */
export interface SubmenuContext {
  t: (key: string, values?: Record<string, string | number>) => string;
  label: (key: string | undefined, fallback: string | undefined) => string;
  locale: string;
  /** next-themes: "light" | "dark" | "system" */
  theme: string | undefined;
  setThemeMode: (mode: "light" | "dark" | "system", save: boolean) => void;
  saveColorTheme: (name: string) => void;
  switchLocale: (locale: string) => void;
  navigate: (href: string, query?: Record<string, string>) => void;
  openInNewTab: (itemId: string) => boolean;
  copyCode: (hit: SearchExactHit) => void;
}

export type SubmenuTarget =
  | { type: "entry"; entry: SearchEntry }
  | { type: "hit"; hit: SearchExactHit }
  | { type: string };

type Provider = (
  itemId: string,
  target: SubmenuTarget,
  ctx: SubmenuContext
) => PaletteSubmenu | null;

const isEntry = (target: SubmenuTarget): target is { type: "entry"; entry: SearchEntry } =>
  target.type === "entry";
const isHit = (target: SubmenuTarget): target is { type: "hit"; hit: SearchExactHit } =>
  target.type === "hit";

/** Static links declared on the entry (`submenu` in the registry) */
const staticLinks: Provider = (_id, target, ctx) => {
  if (!isEntry(target) || !target.entry.submenu?.length) return null;
  const links = target.entry.submenu;
  return {
    primary: !target.entry.href && !target.entry.command,
    options: links.map((link) => ({
      id: link.id,
      label: ctx.label(link.titleKey, link.title),
      icon: ArrowRight,
    })),
    select: (optionId) => {
      const link = links.find((item) => item.id === optionId);
      if (link) ctx.navigate(link.href, link.query);
      return "close";
    },
  };
};

/** Colour theme: highlighting previews, Enter saves, collapsing restores */
const colorTheme: Provider = (_id, target, ctx) => {
  if (!isEntry(target) || target.entry.command !== "colorTheme.pick") return null;
  const active = typeof document === "undefined" ? "default" : getActiveColorTheme();
  return {
    primary: true,
    currentLabel: COLOR_THEMES.find((theme) => theme.name === active)?.label,
    initialOptionId: active,
    options: COLOR_THEMES.map((theme) => ({
      id: theme.name,
      label: theme.label,
      swatch: theme.colors,
      current: theme.name === active,
    })),
    begin: () => {
      const original = getActiveColorTheme();
      return () => previewColorTheme(original);
    },
    preview: (name) => previewColorTheme(name),
    select: (name) => {
      ctx.saveColorTheme(name);
      return "collapse";
    },
  };
};

const THEME_MODES = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Monitor },
] as const;

/** Light / dark / system, previewed while browsing */
const themeMode: Provider = (_id, target, ctx) => {
  if (!isEntry(target) || target.entry.command !== "theme.toggle") return null;
  const active = (ctx.theme ?? "system") as (typeof THEME_MODES)[number]["id"];
  return {
    primary: true,
    currentLabel: ctx.t(`themeMode.${active}`),
    initialOptionId: active,
    options: THEME_MODES.map((mode) => ({
      id: mode.id,
      label: ctx.t(`themeMode.${mode.id}`),
      icon: mode.icon,
      current: mode.id === active,
    })),
    begin: () => () => ctx.setThemeMode(active, false),
    preview: (mode) => ctx.setThemeMode(mode as typeof active, false),
    select: (mode) => {
      ctx.setThemeMode(mode as typeof active, true);
      return "collapse";
    },
  };
};

const LOCALES = [
  { id: "pl", label: "Polski" },
  { id: "en", label: "English" },
];

const language: Provider = (_id, target, ctx) => {
  if (!isEntry(target) || target.entry.command !== "locale.toggle") return null;
  return {
    primary: true,
    currentLabel: LOCALES.find((item) => item.id === ctx.locale)?.label,
    initialOptionId: ctx.locale,
    options: LOCALES.map((item) => ({
      id: item.id,
      label: item.label,
      icon: Languages,
      current: item.id === ctx.locale,
    })),
    select: (locale) => {
      if (locale !== ctx.locale) ctx.switchLocale(locale);
      return "close";
    },
  };
};

/** Actions on a data result; Enter on the row itself still opens it */
const hitActions: Provider = (itemId, target, ctx) => {
  if (!isHit(target)) return null;
  const { hit } = target;
  const options: PaletteSubOption[] = [
    { id: "newTab", label: ctx.t("preview.openNewTab"), icon: ExternalLink },
  ];
  if (hit.code) options.push({ id: "copy", label: ctx.t("preview.copy"), icon: Copy });
  if (hit.type === "repairOrder") {
    options.push(
      { id: "tabReceiving", label: ctx.t("preview.tabReceiving"), icon: ArrowDownToLine },
      { id: "tabStock", label: ctx.t("preview.tabStock"), icon: Package }
    );
  }
  if (hit.type === "item" && hit.code) {
    options.push({ id: "movements", label: ctx.t("preview.movements"), icon: History });
  }
  return {
    primary: false,
    options,
    select: (optionId) => {
      switch (optionId) {
        case "newTab":
          ctx.openInNewTab(itemId);
          return "close";
        case "copy":
          ctx.copyCode(hit);
          return "collapse";
        case "tabReceiving":
        case "tabStock":
          ctx.navigate(repairOrderTabHref(hit.id, optionId === "tabStock" ? "stock" : "receiving"));
          return "close";
        case "movements":
          ctx.navigate("/dashboard/warehouse/inventory/movements", { search: hit.code ?? "" });
          return "close";
        default:
          return "collapse";
      }
    },
  };
};

/** First provider that answers wins; add new ones here */
const PROVIDERS: Provider[] = [staticLinks, colorTheme, themeMode, language, hitActions];

export function resolveSubmenu(
  itemId: string,
  target: SubmenuTarget | undefined,
  ctx: SubmenuContext
): PaletteSubmenu | null {
  if (!target) return null;
  for (const provider of PROVIDERS) {
    const submenu = provider(itemId, target, ctx);
    if (submenu && submenu.options.length > 0) return submenu;
  }
  return null;
}
