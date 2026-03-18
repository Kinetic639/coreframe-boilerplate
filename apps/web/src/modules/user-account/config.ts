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
      type: "action" as const,
      id: "profile",
      label: "modules.userAccount.items.profile",
      icon: "User",
    },
    {
      type: "action" as const,
      id: "preferences",
      label: "modules.userAccount.items.preferences",
      icon: "Settings",
    },
  ],
  widgets,
};
