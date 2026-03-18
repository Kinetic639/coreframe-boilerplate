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
    title: "modules.analytics.title",
    icon: "BarChart3",
    description: "modules.analytics.description",
    color: "#06b6d4",
    items: [
      {
        id: "activities-overview",
        label: "modules.analytics.items.overview",
        path: "/dashboard-old/analytics",
        icon: "Activity",
      },
      {
        id: "activities-list",
        label: "modules.analytics.items.activities",
        path: "/dashboard-old/analytics/activities",
        icon: "List",
      },
      {
        id: "activity-timeline",
        label: "modules.analytics.items.timeline",
        path: "/dashboard-old/analytics/timeline",
        icon: "Clock",
      },
      {
        id: "reports",
        label: "modules.analytics.items.reports.title",
        icon: "FileText",
        path: "/dashboard-old/analytics/reports",
        submenu: [
          {
            id: "user-activity-reports",
            label: "modules.analytics.items.reports.userActivity",
            path: "/dashboard-old/analytics/reports/user-activity",
            icon: "Users",
          },
          {
            id: "module-reports",
            label: "modules.analytics.items.reports.modules",
            path: "/dashboard-old/analytics/reports/modules",
            icon: "Package",
          },
          {
            id: "security-reports",
            label: "modules.analytics.items.reports.security",
            path: "/dashboard-old/analytics/reports/security",
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
        label: "modules.analytics.items.exports.title",
        icon: "Download",
        path: "/dashboard-old/analytics/export",
        submenu: [
          {
            id: "activity-export",
            label: "modules.analytics.items.exports.activities",
            path: "/dashboard-old/analytics/export/activities",
            icon: "FileDown",
          },
          {
            id: "report-export",
            label: "modules.analytics.items.exports.reports",
            path: "/dashboard-old/analytics/export/reports",
            icon: "FileSpreadsheet",
          },
        ],
      },
      {
        id: "settings",
        label: "modules.analytics.items.settings.title",
        icon: "Settings",
        path: "/dashboard-old/analytics/settings",
        allowedUsers: [
          { role: "org_admin", scope: "organization" as any },
          { role: "branch_admin", scope: "branch" as any },
        ],
        submenu: [
          {
            id: "retention-settings",
            label: "modules.analytics.items.settings.retention",
            path: "/dashboard-old/analytics/settings/retention",
            icon: "Archive",
            allowedUsers: [{ role: "org_admin", scope: "organization" as any }],
          },
          {
            id: "notification-settings",
            label: "modules.analytics.items.settings.notifications",
            path: "/dashboard-old/analytics/settings/notifications",
            icon: "Bell",
          },
          {
            id: "filter-presets",
            label: "modules.analytics.items.settings.presets",
            path: "/dashboard-old/analytics/settings/presets",
            icon: "Filter",
          },
        ],
      },
    ],
    widgets,
  };
}
