import { ModuleConfig } from "@/types/module";

export const teamsModule: ModuleConfig = {
  id: "teams",
  title: "Zespoły",
  description: "Zarządzanie zespołami i komunikacją",
  color: "#8b5cf6",
  items: [
    {
      id: "members",
      label: "Członkowie zespołu",
      path: "/zespoly/czlonkowie",
      icon: "Users",
    },
    {
      id: "communication",
      label: "Komunikacja",
      path: "/zespoly/komunikacja",
      icon: "MessageSquare",
      submenu: [
        {
          id: "chat",
          label: "Chat zespołu",
          path: "/zespoly/komunikacja/chat",
          icon: "MessageCircle",
        },
        {
          id: "announcements",
          label: "Ogłoszenia",
          path: "/zespoly/komunikacja/ogloszenia",
          icon: "Megaphone",
        },
      ],
    },
    {
      id: "kanban",
      label: "Tablica Kanban",
      path: "/zespoly/kanban",
      icon: "Columns",
    },
    {
      id: "calendar",
      label: "Kalendarz zespołu",
      path: "/zespoly/kalendarz",
      icon: "Calendar",
    },
  ],
};
