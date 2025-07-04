import { ModuleConfig } from "@/lib/types/module";

export const homeModule: ModuleConfig = {
  id: "home",
  slug: "home",
  title: "Start",
  icon: "Home",
  color: "#3b82f6",
  items: [
    {
      id: "news",
      label: "Aktualności",
      path: "/dashboard/start",
      icon: "Newspaper",
    },
    {
      id: "add-news",
      label: "Dodaj aktualność",
      icon: "PlusCircle",
      type: "action",
      actionId: "openAddNewsModal",
      allowedUsers: [{ role: "branch_admin", scope: "branch" }],
    },
  ],
};
