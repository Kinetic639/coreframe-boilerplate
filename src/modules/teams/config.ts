import { ModuleConfig } from "@/lib/types/module";

export const teamsModule: ModuleConfig = {
  id: "teams",
  slug: "teams",
  title: "modules.teams.title",
  icon: "Users",
  description: "modules.teams.description",
  color: "#8b5cf6",
  items: [
    {
      id: "members",
      label: "modules.teams.items.members",
      path: "/dashboard/teams/members",
      icon: "Users",
    },
    {
      id: "communication",
      label: "modules.teams.items.communication.title",
      path: "/dashboard/teams/communication",
      icon: "MessageSquare",
      submenu: [
        {
          id: "chat",
          label: "modules.teams.items.communication.chat",
          path: "/dashboard/teams/communication/chat",
          icon: "MessageCircle",
        },
        {
          id: "announcements",
          label: "modules.teams.items.communication.announcements",
          path: "/dashboard/teams/communication/announcements",
          icon: "Megaphone",
        },
      ],
    },
    {
      id: "kanban",
      label: "modules.teams.items.kanban",
      path: "/dashboard/teams/kanban",
      icon: "Columns",
    },
    {
      id: "calendar",
      label: "modules.teams.items.calendar",
      path: "/dashboard/teams/calendar",
      icon: "Calendar",
    },
  ],
};
