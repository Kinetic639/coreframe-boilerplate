import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

export async function getAnalyticsModule(): Promise<ModuleConfig> {
  const widgets: Widget[] = [
    {
      id: "activities-summary",
      title: "Activities Overview",
      type: "chart",
      data: {
        labels: ["Warehouse", "Organization", "Teams", "Support"],
        datasets: [
          {
            label: "Activities",
            data: [45, 23, 12, 8],
            backgroundColor: "rgba(6, 182, 212, 0.2)",
            borderColor: "rgba(6, 182, 212, 1)",
          },
        ],
      },
      config: {
        type: "bar",
        responsive: true,
      } as any,
    },
    {
      id: "activity-trends",
      title: "Activity Trends",
      type: "chart",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Activities",
            data: [12, 19, 15, 25, 22, 8, 6],
            backgroundColor: "rgba(6, 182, 212, 0.1)",
            borderColor: "rgba(6, 182, 212, 1)",
          } as any,
        ],
      },
      config: {
        type: "line",
        responsive: true,
      } as any,
    },
  ];

  return {
    id: "analytics",
    slug: "analytics",
    title: "Analytics & Reports",
    icon: "BarChart3",
    description: "Activity analytics, reports, and audit trails",
    color: "#06b6d4",
    items: [
      {
        id: "activities-overview",
        label: "Activity Dashboard",
        path: "/dashboard/analytics",
        icon: "Activity",
      },
      {
        id: "activities-list",
        label: "Activity Log",
        path: "/dashboard/analytics/activities",
        icon: "List",
      },
      {
        id: "activity-timeline",
        label: "Timeline View",
        path: "/dashboard/analytics/timeline",
        icon: "Clock",
      },
      {
        id: "reports",
        label: "Reports",
        icon: "FileText",
        path: "/dashboard/analytics/reports",
        submenu: [
          {
            id: "user-activity-reports",
            label: "User Activity Reports",
            path: "/dashboard/analytics/reports/user-activity",
            icon: "Users",
          },
          {
            id: "module-reports",
            label: "Module Reports",
            path: "/dashboard/analytics/reports/modules",
            icon: "Package",
          },
          {
            id: "security-reports",
            label: "Security Reports",
            path: "/dashboard/analytics/reports/security",
            icon: "Shield",
            allowedUsers: [
              { role: "org_admin", scope: "organization" as any },
              { role: "security_admin", scope: "organization" as any },
            ],
          },
        ],
      },
      {
        id: "exports",
        label: "Data Export",
        icon: "Download",
        path: "/dashboard/analytics/export",
        submenu: [
          {
            id: "activity-export",
            label: "Export Activities",
            path: "/dashboard/analytics/export/activities",
            icon: "FileDown",
          },
          {
            id: "report-export",
            label: "Export Reports",
            path: "/dashboard/analytics/export/reports",
            icon: "FileSpreadsheet",
          },
        ],
      },
      {
        id: "settings",
        label: "Analytics Settings",
        icon: "Settings",
        path: "/dashboard/analytics/settings",
        allowedUsers: [
          { role: "org_admin", scope: "organization" as any },
          { role: "branch_admin", scope: "branch" as any },
        ],
        submenu: [
          {
            id: "retention-settings",
            label: "Data Retention",
            path: "/dashboard/analytics/settings/retention",
            icon: "Archive",
            allowedUsers: [{ role: "org_admin", scope: "organization" as any }],
          },
          {
            id: "notification-settings",
            label: "Activity Notifications",
            path: "/dashboard/analytics/settings/notifications",
            icon: "Bell",
          },
          {
            id: "filter-presets",
            label: "Filter Presets",
            path: "/dashboard/analytics/settings/presets",
            icon: "Filter",
          },
        ],
      },
    ],
    widgets,
  };
}
