import * as LucideIcons from "lucide-react";
import { ModuleMenu, SidebarItem } from "../../common/types/moduleMenu";

type RawSidebarItem = {
  key: string;
  label: string;
  href?: string;
  icon?: string;
  children?: RawSidebarItem[];
};

type UserModule = {
  slug: string;
  label: string;
  settings: {
    sidebar: RawSidebarItem[];
  };
};

function getIcon(icon?: string) {
  return icon && (LucideIcons as any)[icon] ? (LucideIcons as any)[icon] : undefined;
}

function transformItem(item: RawSidebarItem): SidebarItem {
  return {
    path: item.href ?? `/${item.key}`,
    label: item.label,
    icon: getIcon(item.icon),
    submenu: item.children?.map(transformItem),
  };
}

export function mapUserModulesToSidebar(modules: UserModule[]): ModuleMenu[] {
  return modules.map((mod) => ({
    id: mod.slug,
    title: mod.label,
    items: mod.settings.sidebar.map(transformItem),
  }));
}
