import { ModuleConfig } from "@/lib/types/module";

export const ANALYTICS_MODULE_THEME_COLOR = "#8b5cf6"; // Violet

export const analyticsModule: ModuleConfig = {
  id: "analytics",
  slug: "analytics",
  title: "modules.analytics.title",
  icon: "BarChart2",
  description: "modules.analytics.description",
  color: ANALYTICS_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
