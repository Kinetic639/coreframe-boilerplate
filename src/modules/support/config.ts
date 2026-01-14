import { ModuleConfig } from "@/lib/types/module";

export const supportModule: ModuleConfig = {
  id: "support",
  slug: "support",
  title: "modules.support.title",
  icon: "LifeBuoy",
  description: "modules.support.description",
  items: [
    {
      id: "help-center",
      label: "modules.support.items.help",
      path: "/dashboard-old/support/help",
      icon: "LifeBuoy",
    },
    {
      id: "contact-support",
      label: "modules.support.items.contact",
      path: "/dashboard-old/support/contact",
      icon: "MessageSquare",
    },
    {
      id: "announcements",
      label: "modules.support.items.announcements.title",
      path: "/dashboard-old/support/announcements",
      icon: "Megaphone",
      submenu: [
        {
          id: "changelog",
          label: "modules.support.items.announcements.changelog",
          path: "/dashboard-old/support/announcements/changelog",
          icon: "History",
        },
        {
          id: "system-status",
          label: "modules.support.items.announcements.systemStatus",
          path: "/dashboard-old/support/announcements/status",
          icon: "BarChart",
        },
        {
          id: "roadmap",
          label: "modules.support.items.announcements.roadmap",
          path: "/dashboard-old/support/announcements/roadmap",
          icon: "Map",
        },
      ],
    },
  ],
};
