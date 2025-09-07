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
  title: "Account",
  icon: "User",
  description: "User account settings and profile management",
  color: "#6366f1",
  items: [
    {
      id: "profile",
      label: "Profile",
      path: "/dashboard/account/profile",
      icon: "User",
    },
    {
      id: "preferences",
      label: "Preferences",
      path: "/dashboard/account/preferences",
      icon: "Settings",
    },
  ],
  widgets,
};
