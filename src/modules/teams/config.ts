import { ModuleConfig } from "@/lib/types/module";

export const teamsModule: ModuleConfig = {
  id: "teams",
  slug: "teams",
  title: "Zespoły",
  icon: "Users",
  description: "Zarządzanie zespołami i komunikacją",
  color: "#8b5cf6",
  items: [
    {
      id: "members",
      label: "Członkowie zespołu",
      path: "/dashboard/teams/members",
      icon: "Users",
    },
    {
      id: "communication",
      label: "Komunikacja",
      path: "/dashboard/teams/communication",
      icon: "MessageSquare",
      submenu: [
        {
          id: "chat",
          label: "Chat zespołu",
          path: "/dashboard/teams/communication/chat",
          icon: "MessageCircle",
        },
        {
          id: "announcements",
          label: "Ogłoszenia",
          path: "/dashboard/teams/communication/announcements",
          icon: "Megaphone",
        },
      ],
    },
    {
      id: "kanban",
      label: "Tablica Kanban",
      path: "/dashboard/teams/kanban",
      icon: "Columns",
    },
    {
      id: "calendar",
      label: "Kalendarz zespołu",
      path: "/dashboard/teams/calendar",
      icon: "Calendar",
    },
  ],
};
