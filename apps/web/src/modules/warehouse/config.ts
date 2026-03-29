import { ModuleConfig } from "@/lib/types/module";

export const WAREHOUSE_MODULE_THEME_COLOR = "#10b981"; // Emerald green

/**
 * Warehouse V2 module config.
 *
 * Navigation is driven exclusively by the Sidebar V2 registry
 * (src/lib/sidebar/v2/registry.ts). The items array is intentionally empty.
 *
 * Widget definitions will be added in a later implementation slice.
 */
export const warehouseModule: ModuleConfig = {
  id: "warehouse",
  slug: "warehouse",
  title: "modules.warehouse.title",
  icon: "Warehouse",
  description: "modules.warehouse.description",
  color: WAREHOUSE_MODULE_THEME_COLOR,
  items: [], // Navigation driven by Sidebar V2 registry
};
