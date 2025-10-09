import { Scope } from "./user";
import { Widget } from "./widgets";

export type MenuItem = LinkMenuItem | ActionMenuItem;
export interface AllowedUser {
  role: string;
  scope: Scope;
}

export interface BaseMenuItem {
  id: string;
  label: string;
  icon: string;
  allowedUsers?: AllowedUser[];
  requiredPermissions?: string[]; // New permission-based access control
}

export interface LinkMenuItem extends BaseMenuItem {
  type?: "link";
  path: string;
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
  icon?: string;
  description?: string;
  color?: string;
  path?: string; // Optional direct link for modules without submenus
  items: MenuItem[];
  actions?: Record<string, () => void>;
  widgets?: Widget[]; // 👈 tutaj
}
