import { ModuleConfig } from "@/lib/types/module";

export const orgManagmentModule: ModuleConfig = {
  id: "org-management",
  title: "Zarządzanie organizacją",
  description: "Panel administracyjny do zarządzania organizacją, użytkownikami i uprawnieniami",
  color: "#6366f1", // indigo
  items: [
    {
      id: "organization-profile",
      label: "Profil organizacji",
      path: "/dashboard/organizacja/profil",
      icon: "Building2",
    },
    {
      id: "branches",
      label: "Oddziały",
      path: "/dashboard/organizacja/oddzialy",
      icon: "MapPin",
    },
    {
      id: "users",
      label: "Użytkownicy",
      path: "/dashboard/organizacja/uzytkownicy",
      icon: "Users",
      submenu: [
        {
          id: "user-list",
          label: "Lista użytkowników",
          path: "/dashboard/organizacja/uzytkownicy/lista",
          icon: "List",
        },
        {
          id: "roles",
          label: "Role i uprawnienia",
          path: "/dashboard/organizacja/uzytkownicy/role",
          icon: "Shield",
        },
      ],
    },
  ],
};
