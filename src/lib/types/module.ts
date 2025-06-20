import { Pathnames } from "@/i18n/routing";

export interface MenuItem {
  id: string;
  label: string;
  path: Pathnames;
  icon: string;
  submenu?: MenuItem[];
}

export interface ModuleConfig {
  id: string;
  slug: string;
  title: string;
  description?: string;
  color?: string;
  items: MenuItem[];
}

export interface OrganizationSettings {
  name: string;
  subtitle?: string;
  logo?: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}
