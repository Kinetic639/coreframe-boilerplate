import { Pathnames } from "@/i18n/routing";

export type MenuItem = LinkMenuItem | ActionMenuItem;

export interface BaseMenuItem {
  id: string;
  label: string;
  icon: string;
  allowedRoles?: string[]; // np. ["owner", "admin"]
  scope?: ("org" | "branch")[]; // ["org"] | ["branch"] | ["org", "branch"]
}

export interface LinkMenuItem extends BaseMenuItem {
  type?: "link";
  path: Pathnames;
  submenu?: MenuItem[];
}

export interface ActionMenuItem extends BaseMenuItem {
  type: "action";
  actionId?: string;
}

export interface ModuleConfig {
  id: string;
  slug: string;
  title: string;
  description?: string;
  color?: string;
  items: MenuItem[];
  actions?: Record<string, () => void>;
}
