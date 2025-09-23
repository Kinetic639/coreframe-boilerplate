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
      path: "/dashboard/support/help",
      icon: "LifeBuoy",
    },
    {
      id: "contact-support",
      label: "modules.support.items.contact",
      path: "/dashboard/support/contact",
      icon: "MessageSquare",
    },
    {
      id: "announcements",
      label: "modules.support.items.announcements.title",
      path: "/dashboard/support/announcements",
      icon: "Megaphone",
      submenu: [
        {
          id: "changelog",
          label: "modules.support.items.announcements.changelog",
          path: "/dashboard/support/announcements/changelog",
          icon: "History",
        },
        {
          id: "system-status",
          label: "modules.support.items.announcements.systemStatus",
          path: "/dashboard/support/announcements/status",
          icon: "BarChart",
        },
        {
          id: "roadmap",
          label: "modules.support.items.announcements.roadmap",
          path: "/dashboard/support/announcements/roadmap",
          icon: "Map",
        },
      ],
    },
  ],
};
