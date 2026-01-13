import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

export async function getAdminModule(): Promise<ModuleConfig> {
  const widgets: Widget[] = [
    {
      id: "admin-health",
      title: "System Health",
      type: "custom",
      componentName: "AdminHealthWidget",
    },
    {
      id: "admin-stats",
      title: "Admin Statistics",
      type: "custom",
      componentName: "AdminStatsWidget",
    },
  ];

  return {
    id: "admin",
    slug: "admin",
    title: "Admin Panel",
    description: "System administration and testing tools",
    icon: "Shield",
    color: "#dc2626", // red-600
    path: "/admin",
    items: [
      {
        id: "admin-overview",
        label: "Admin Overview",
        path: "/admin",
        icon: "LayoutDashboard",
        allowedUsers: [
          {
            role: "super_admin",
            scope: "org",
          },
        ],
      },
      {
        id: "admin-testing",
        label: "Testing Tools",
        path: "/admin/testing",
        icon: "TestTube",
        allowedUsers: [
          {
            role: "super_admin",
            scope: "org",
          },
        ],
        submenu: [
          {
            id: "admin-testing-api",
            label: "API Testing",
            path: "/admin/testing/api",
            icon: "Activity",
          },
          {
            id: "admin-testing-database",
            label: "Database Testing",
            path: "/admin/testing/database",
            icon: "Database",
          },
          {
            id: "admin-testing-permissions",
            label: "Permissions Testing",
            path: "/admin/testing/permissions",
            icon: "Shield",
          },
        ],
      },
      {
        id: "admin-management",
        label: "App Management",
        path: "/admin/app-management",
        icon: "Settings",
        allowedUsers: [
          {
            role: "super_admin",
            scope: "org",
          },
        ],
        submenu: [
          {
            id: "admin-management-users",
            label: "User Management",
            path: "/admin/app-management/users",
            icon: "Users",
          },
          {
            id: "admin-management-orgs",
            label: "Organizations",
            path: "/admin/app-management/organizations",
            icon: "LayoutDashboard",
          },
          {
            id: "admin-management-config",
            label: "System Config",
            path: "/admin/app-management/config",
            icon: "Settings",
          },
        ],
      },
      {
        id: "admin-logs",
        label: "System Logs",
        path: "/admin/logs",
        icon: "FileText",
        allowedUsers: [
          {
            role: "super_admin",
            scope: "org",
          },
        ],
      },
      {
        id: "admin-analytics",
        label: "System Analytics",
        path: "/admin/analytics",
        icon: "BarChart3",
        allowedUsers: [
          {
            role: "super_admin",
            scope: "org",
          },
        ],
      },
    ],
    widgets,
  };
}
