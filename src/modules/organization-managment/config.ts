import { ModuleConfig } from "@/lib/types/module";

export const ORG_MODULE_THEME_COLOR = "#6366f1"; // Indigo – always used as default

export const orgManagmentModule: ModuleConfig = {
  id: "org-management",
  slug: "org-management",
  title: "Zarządzanie organizacją",
  description: "Panel administracyjny do zarządzania organizacją, użytkownikami i uprawnieniami",
  color: ORG_MODULE_THEME_COLOR, // indigo
  items: [
    {
      id: "organization-profile",
      label: "Profil organizacji",
      path: "/dashboard/organization/profile", // klucz z routing.pathnames
      icon: "Building2",
    },
    {
      id: "branches",
      label: "Oddziały",
      path: "/dashboard/organization/branches",
      icon: "MapPin",
    },
    {
      id: "users",
      label: "Użytkownicy",
      path: "/dashboard/organization/users",
      icon: "Users",
      submenu: [
        {
          id: "user-list",
          label: "Lista użytkowników",
          path: "/dashboard/organization/users/list",
          icon: "List",
        },
        {
          id: "roles",
          label: "Role i uprawnienia",
          path: "/dashboard/organization/users/roles",
          icon: "Shield",
        },
      ],
    },
  ],
};
