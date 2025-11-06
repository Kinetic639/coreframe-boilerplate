// =============================================
// Contacts Module Configuration
// =============================================

import type { ModuleConfig } from "@/lib/types/module";

export const contactsModule: ModuleConfig = {
  id: "contacts",
  slug: "contacts",
  title: "Contacts",
  icon: "Users",
  color: "#3b82f6", // blue
  description: "Manage personal and organizational contacts",
  path: "/dashboard/contacts",
  items: [
    {
      id: "contacts",
      label: "contacts.title",
      path: "/dashboard/contacts",
      icon: "Users",
      allowedUsers: [
        {
          role: "user",
          scope: "branch",
        },
      ],
    },
  ],
  widgets: [],
};
