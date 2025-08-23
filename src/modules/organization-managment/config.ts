import { ModuleConfig } from "@/lib/types/module";

export const ORG_MODULE_THEME_COLOR = "#6366f1"; // Indigo – always used as default

export const orgManagmentModule: ModuleConfig = {
  id: "org-management",
  slug: "org-management",
  title: "Zarządzanie organizacją",
  icon: "Settings",
  description: "Panel administracyjny do zarządzania organizacją, użytkownikami i uprawnieniami",
  color: ORG_MODULE_THEME_COLOR, // indigo
  items: [
    {
      id: "organization-profile",
      label: "Profil organizacji",
      path: "/dashboard/organization/profile", // klucz z routing.pathnames
      icon: "Building2",
      requiredPermissions: ["organization.profile.update"],
    },
    {
      id: "branches",
      label: "Oddziały",
      path: "/dashboard/organization/branches",
      icon: "MapPin",
      requiredPermissions: ["branch.manage"],
    },
    {
      id: "users",
      label: "Użytkownicy",
      path: "/dashboard/organization/users",
      icon: "Users",
      requiredPermissions: ["user.manage"],
      submenu: [
        {
          id: "user-list",
          label: "Lista użytkowników",
          path: "/dashboard/organization/users/list",
          icon: "List",
          requiredPermissions: ["user.manage"],
        },
        {
          id: "invitations",
          label: "Zaproszenia",
          path: "/dashboard/organization/users/invitations",
          icon: "Mail",
          requiredPermissions: ["invitation.read"],
        },
        {
          id: "roles",
          label: "Role i uprawnienia",
          path: "/dashboard/organization/users/roles",
          icon: "Shield",
          requiredPermissions: ["user.role.read"],
        },
      ],
    },
  ],
};
