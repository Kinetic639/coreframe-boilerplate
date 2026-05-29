import { ModuleConfig } from "@/lib/types/module";

export const HELPDESK_MODULE_THEME_COLOR = "#6366f1"; // Indigo

export const helpDeskModule: ModuleConfig = {
  id: "help-desk",
  slug: "help-desk",
  title: "modules.helpDesk.title",
  icon: "LifeBuoy",
  description: "modules.helpDesk.description",
  color: HELPDESK_MODULE_THEME_COLOR,
  items: [], // Navigation is driven by the Sidebar V2 registry
};
