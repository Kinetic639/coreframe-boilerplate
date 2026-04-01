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
      id: "organization-contacts",
      label: "modules.teams.items.contacts.organization",
      path: "/dashboard-old/teams/contacts",
      icon: "Building2",
    },
    {
      id: "communication",
      label: "modules.teams.items.communication.title",
      path: "/dashboard-old/teams/communication",
      icon: "MessageSquare",
      submenu: [
        {
          id: "chat",
          label: "modules.teams.items.communication.chat",
          path: "/dashboard-old/teams/communication/chat",
          icon: "MessageCircle",
        },
        {
          id: "announcements",
          label: "modules.teams.items.communication.announcements",
          path: "/dashboard-old/announcements",
          icon: "Megaphone",
        },
      ],
    },
    {
      id: "kanban",
      label: "modules.teams.items.kanban",
      path: "/dashboard-old/teams/kanban",
      icon: "Columns",
    },
    {
      id: "calendar",
      label: "modules.teams.items.calendar",
      path: "/dashboard-old/teams/calendar",
      icon: "Calendar",
    },
  ],
};
