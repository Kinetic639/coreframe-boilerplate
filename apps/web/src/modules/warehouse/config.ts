import { ModuleConfig } from "@/lib/types/module";

export const WAREHOUSE_MODULE_THEME_COLOR = "#10b981"; // Emerald green

export const warehouseModule: ModuleConfig = {
  id: "warehouse",
  slug: "warehouse",
  title: "modules.warehouse.title",
  icon: "Warehouse",
  description: "modules.warehouse.description",
  color: WAREHOUSE_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
