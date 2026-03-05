import { ModuleConfig } from "@/lib/types/module";

export const TOOLS_MODULE_THEME_COLOR = "#f59e0b"; // Amber

export const toolsModule: ModuleConfig = {
  id: "tools",
  slug: "tools",
  title: "modules.tools.title",
  icon: "Wrench",
  description: "modules.tools.description",
  color: TOOLS_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
