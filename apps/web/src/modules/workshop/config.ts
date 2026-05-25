import { ModuleConfig } from "@/lib/types/module";

export const WORKSHOP_MODULE_THEME_COLOR = "#f59e0b"; // Amber

export const workshopModule: ModuleConfig = {
  id: "workshop",
  slug: "workshop",
  title: "modules.workshop.title",
  icon: "Car",
  description: "modules.workshop.description",
  color: WORKSHOP_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
