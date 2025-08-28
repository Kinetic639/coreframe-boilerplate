import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

const widgets: Widget[] = [
  {
    id: "recent-news",
    title: "Recent News",
    type: "custom",
    componentName: "RecentNewsWidget",
    config: {
      limit: 5,
      showActions: true,
      compact: true,
      className: "col-span-2",
    },
  },
  {
    id: "recent-activities",
    title: "Recent Activities",
    type: "custom",
    componentName: "RecentActivitiesWidget",
    config: {
      limit: 8,
      autoRefresh: true,
      showViewAll: true,
      className: "col-span-2",
    },
  },
];

export const homeModule: ModuleConfig = {
  id: "home",
  slug: "home",
  title: "Start",
  icon: "Home",
  color: "#3b82f6",
  items: [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard/start",
      icon: "Home",
    },
    {
      id: "news-history",
      label: "News History",
      path: "/dashboard/news",
      icon: "Newspaper",
    },
  ],
  widgets,
};
