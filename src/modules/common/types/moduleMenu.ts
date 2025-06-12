export interface SidebarItem {
  path: string;
  label: string;
  icon?: string;
  badge?: string;
  disabled?: boolean;
  tooltip?: string;
  permissions?: string[]; // np. ["warehouse.view"]
  submenu?: SidebarItem[];
}

export interface ModuleMenu {
  id?: string; // np. "warehouse" – do łatwej identyfikacji
  title: string;
  items: SidebarItem[];
  visible?: boolean; // czy cały moduł ma być widoczny
}
