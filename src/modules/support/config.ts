import { ModuleConfig } from "@/lib/types/module";

export const supportModule: ModuleConfig = {
  id: "support",
  slug: "support",
  title: "Wsparcie",
  description: "Panel pomocy, nowości i kontaktu z zespołem wsparcia",
  items: [
    {
      id: "help-center",
      label: "Pomoc",
      path: "/dashboard/support/help",
      icon: "LifeBuoy",
    },
    {
      id: "contact-support",
      label: "Kontakt ze wsparciem",
      path: "/dashboard/support/contact",
      icon: "MessageSquare",
    },
    {
      id: "announcements",
      label: "Nowości i ogłoszenia",
      path: "/dashboard/support/announcements",
      icon: "Megaphone",
      submenu: [
        {
          id: "changelog",
          label: "Changelog",
          path: "/dashboard/support/announcements/changelog",
          icon: "History",
        },
        {
          id: "system-status",
          label: "Status systemu",
          path: "/dashboard/support/announcements/status",
          icon: "BarChart",
        },
        {
          id: "roadmap",
          label: "Roadmapa",
          path: "/dashboard/support/announcements/roadmap",
          icon: "Map",
        },
      ],
    },
  ],
};
