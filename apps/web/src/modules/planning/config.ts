import { ModuleConfig } from "@/lib/types/module";

export const PLANNING_MODULE_THEME_COLOR = "#0d9488"; // Teal

export const planningModule: ModuleConfig = {
  id: "planning",
  slug: "planning",
  title: "modules.planning.title",
  icon: "CheckSquare",
  description: "modules.planning.description",
  color: PLANNING_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
