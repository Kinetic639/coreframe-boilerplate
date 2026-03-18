import { ModuleConfig } from "@/lib/types/module";

export const ORG_MODULE_THEME_COLOR = "#6366f1"; // Indigo – always used as default

export const orgManagmentModule: ModuleConfig = {
  id: "organization-management",
  slug: "organization-management",
  title: "modules.organizationManagement.title",
  icon: "Settings",
  description: "modules.organizationManagement.description",
  color: ORG_MODULE_THEME_COLOR, // indigo
  items: [], // Navigation driven by sidebar V2 registry (src/lib/sidebar/v2/registry.ts)
};
