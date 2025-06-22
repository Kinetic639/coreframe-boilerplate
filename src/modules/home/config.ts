import { ModuleConfig } from "@/lib/types/module";

export const homeModule: ModuleConfig = {
  id: "home",
  slug: "home",
  title: "Start",
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
      allowedRoles: ["branch_admin"],
      scope: ["branch"],
    },
    {
      id: "second-news",
      label: "Dodaj second",
      icon: "PlusCircle",
      type: "action",
      actionId: "openSecondNewsModalsss",
    },
    {
      id: "third-news",
      label: "Dodaj third",
      icon: "PlusCircle",
      type: "action",
      actionId: "openThirdNewsModalsss",
      allowedRoles: ["org_owner"],
      scope: ["org"],
    },
  ],
};
