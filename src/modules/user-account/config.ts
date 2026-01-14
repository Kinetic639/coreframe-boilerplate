import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

const widgets: Widget[] = [
  {
    id: "account-overview",
    title: "Account Overview",
    type: "custom",
    componentName: "AccountOverviewWidget",
    config: {
      showProfileCompletion: true,
      showRecentActivity: true,
      className: "col-span-full",
    },
  },
];

export const userAccountModule: ModuleConfig = {
  id: "user-account",
  slug: "account",
  title: "modules.userAccount.title",
  icon: "User",
  description: "modules.userAccount.description",
  color: "#6366f1",
  items: [
    {
      id: "profile",
      label: "modules.userAccount.items.profile",
      path: "/dashboard-old/account/profile",
      icon: "User",
    },
    {
      id: "preferences",
      label: "modules.userAccount.items.preferences",
      path: "/dashboard-old/account/preferences",
      icon: "Settings",
    },
  ],
  widgets,
};
