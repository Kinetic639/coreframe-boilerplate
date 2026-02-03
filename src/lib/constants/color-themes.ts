export const COLOR_THEME_STORAGE_KEY = "color-theme";
export const COLOR_THEME_CHANGE_EVENT = "color-theme-change";

export interface ColorTheme {
  name: string;
  label: string;
  colors: [string, string, string, string];
}

export const COLOR_THEMES: ColorTheme[] = [
  { name: "default", label: "Default", colors: ["#e87952", "#5b9ad5", "#4472c4", "#ed7d31"] },
  { name: "graphite", label: "Graphite", colors: ["#606060", "#909090", "#565656", "#a8a8a8"] },
  { name: "doom64", label: "Doom 64", colors: ["#b71c1c", "#33691e", "#5b8ab8", "#ff6d00"] },
  { name: "amber", label: "Amber", colors: ["#ff8000", "#ffa040", "#cc6600", "#ffb366"] },
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
