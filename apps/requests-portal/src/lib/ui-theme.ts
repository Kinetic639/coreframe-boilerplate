/**
 * Light/dark mode and Ambra color themes. The choice is the one saved in Ambra
 * (user_preferences.dashboard_settings.ui: theme, colorTheme), so the portal looks like
 * the ERP for the same person, and a change here is saved there too. The CSS for every
 * theme is copied from Ambra's globals.css (html[data-theme="..."] and .dark).
 */

export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

export type UiTheme = { mode: ThemeMode; colorTheme: string };
export const DEFAULT_UI_THEME: UiTheme = { mode: "system", colorTheme: "default" };

/** Same list and swatches as Ambra (apps/web/src/lib/constants/color-themes.ts). */
export const COLOR_THEMES: ReadonlyArray<{
  name: string;
  label: string;
  colors: [string, string, string, string];
}> = [
  { name: "default", label: "Ambra", colors: ["#f59e0b", "#fbbf24", "#d97706", "#fcd34d"] },
  { name: "sunset", label: "Sunset", colors: ["#e87952", "#5b9ad5", "#4472c4", "#ed7d31"] },
  { name: "graphite", label: "Graphite", colors: ["#606060", "#909090", "#565656", "#a8a8a8"] },
  { name: "doom64", label: "Doom 64", colors: ["#b71c1c", "#33691e", "#5b8ab8", "#ff6d00"] },
  {
    name: "amethyst-haze",
    label: "Amethyst",
    colors: ["#8a79ab", "#e6a5b8", "#77b8a1", "#f0c88d"],
  },
  { name: "bold-tech", label: "Bold Tech", colors: ["#8b5cf6", "#7c3aed", "#6d28d9", "#dbeafe"] },
  { name: "bubblegum", label: "Bubblegum", colors: ["#d04f99", "#8acfd1", "#fbe2a7", "#e670ab"] },
  { name: "caffeine", label: "Caffeine", colors: ["#524232", "#ffd99e", "#e8e8e8", "#ffe0b1"] },
  { name: "candyland", label: "Candyland", colors: ["#ffdddd", "#9ed4e0", "#ffff00", "#ff99ff"] },
  { name: "catppuccin", label: "Catppuccin", colors: ["#8b5cf6", "#40b5e4", "#5fb952", "#ff844b"] },
  { name: "claude", label: "Claude", colors: ["#c67b51", "#b89df4", "#d9c9aa", "#cbaff1"] },
  {
    name: "elegant-luxury",
    label: "Elegant",
    colors: ["#9d3939", "#f8e194", "#e8d7c5", "#ff6b45"],
  },
  { name: "kodama-grove", label: "Kodama", colors: ["#7b9960", "#d6c899", "#cfb886", "#a6c08f"] },
  { name: "mocha-mousse", label: "Mocha", colors: ["#8d6146", "#c4a774", "#dab98e", "#966e52"] },
  { name: "perpetuity", label: "Perpetuity", colors: ["#0ba5a5", "#96e8e8", "#6fd2d2", "#b7f1f1"] },
];

const COLOR_NAMES = new Set(COLOR_THEMES.map((c) => c.name));

/** Reads dashboard_settings (any shape) into a theme; unknown values fall back to defaults. */
export function parseUiTheme(settings: unknown): UiTheme {
  const ui =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).ui as Record<string, unknown> | undefined)
      : undefined;
  const mode = THEME_MODES.includes(ui?.theme as ThemeMode)
    ? (ui!.theme as ThemeMode)
    : DEFAULT_UI_THEME.mode;
  const colorTheme =
    typeof ui?.colorTheme === "string" && COLOR_NAMES.has(ui.colorTheme)
      ? ui.colorTheme
      : DEFAULT_UI_THEME.colorTheme;
  return { mode, colorTheme };
}

export const isColorTheme = (name: string) => COLOR_NAMES.has(name);

/** Puts a theme on <html> right away (the save follows in the background). */
export function applyUiTheme(theme: UiTheme) {
  const root = document.documentElement;
  if (theme.colorTheme === "default") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme.colorTheme);
  const dark =
    theme.mode === "dark" ||
    (theme.mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.mode = theme.mode;
}

/**
 * Runs before the first paint for "system": the server cannot know the device setting,
 * so this follows it (and its changes) without a flash of the wrong mode.
 */
export const SYSTEM_MODE_SCRIPT = `(function(){try{var r=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){if(r.dataset.mode==="system")r.classList.toggle("dark",m.matches)};a();m.addEventListener("change",a)}catch(e){}})();`;
