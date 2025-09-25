import { ModuleConfig } from "@/lib/types/module";

export const ORG_MODULE_THEME_COLOR = "#6366f1"; // Indigo – always used as default

export const orgManagmentModule: ModuleConfig = {
  id: "organization-management",
  slug: "organization-management",
  title: "modules.organizationManagement.title",
  icon: "Settings",
  description: "modules.organizationManagement.description",
  color: ORG_MODULE_THEME_COLOR, // indigo
  items: [
    {
      id: "organization-profile",
      label: "modules.organizationManagement.items.profile",
      path: "/dashboard/organization/profile", // klucz z routing.pathnames
      icon: "Building2",
      requiredPermissions: ["organization.profile.update"],
    },
    {
      id: "branches",
      label: "modules.organizationManagement.items.branches",
      path: "/dashboard/organization/branches",
      icon: "MapPin",
      requiredPermissions: ["branch.manage"],
    },
    {
      id: "users",
      label: "modules.organizationManagement.items.users.title",
      path: "/dashboard/organization/users",
      icon: "Users",
      requiredPermissions: ["user.manage"],
      submenu: [
        {
          id: "user-list",
          label: "modules.organizationManagement.items.users.list",
          path: "/dashboard/organization/users/list",
          icon: "List",
          requiredPermissions: ["user.manage"],
        },
        {
          id: "invitations",
          label: "modules.organizationManagement.items.users.invitations",
          path: "/dashboard/organization/users/invitations",
          icon: "Mail",
          requiredPermissions: ["invitation.read"],
        },
        {
          id: "roles",
          label: "modules.organizationManagement.items.users.roles",
          path: "/dashboard/organization/users/roles",
          icon: "Shield",
          requiredPermissions: ["user.role.read"],
        },
      ],
    },
    {
      id: "billing",
      label: "modules.organizationManagement.items.billing",
      path: "/dashboard/organization/billing",
      icon: "CreditCard",
    },
  ],
};
