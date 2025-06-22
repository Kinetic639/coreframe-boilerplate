import { Pathnames } from "@/i18n/routing";

export type MenuItem = LinkMenuItem | ActionMenuItem;
export interface AllowedUser {
  role: string;
  scope: string;
}

export interface BaseMenuItem {
  id: string;
  label: string;
  icon: string;
  allowedUsers?: AllowedUser[];
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
