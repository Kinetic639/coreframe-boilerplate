import { ModuleConfig } from "@/lib/types/module";

export const developmentModule: ModuleConfig = {
  id: "development",
  slug: "development",
  title: "Development",
  icon: "Code",
  color: "#f59e0b", // amber
  description: "Development tools and debugging utilities",
  items: [
    {
      id: "debug-home",
      label: "Debug Dashboard",
      path: "/dashboard/development",
      icon: "Bug",
    },
    {
      id: "permissions-debug",
      label: "Permissions Debug",
      path: "/dashboard/development/permissions",
      icon: "Shield",
    },
    {
      id: "context-debug",
      label: "Context Debug",
      path: "/dashboard/development/context",
      icon: "Database",
    },
    {
      id: "logo-debug",
      label: "Logo Debug",
      path: "/dashboard/development/logo",
      icon: "Image",
    },
    {
      id: "service-debug",
      label: "Service Debug",
      path: "/dashboard/development/service",
      icon: "Server",
    },
    {
      id: "label-testing",
      label: "Label Testing",
      path: "/dashboard/development/labels",
      icon: "QrCode",
    },
    {
      id: "locations-debug",
      label: "Locations Debug",
      path: "/dashboard/development/locations-debug",
      icon: "MapPin",
    },
  ],
};
