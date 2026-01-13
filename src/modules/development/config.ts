import { ModuleConfig } from "@/lib/types/module";

export const developmentModule: ModuleConfig = {
  id: "development",
  slug: "development",
  title: "modules.development.title",
  icon: "Code",
  color: "#f59e0b", // amber
  description: "modules.development.description",
  items: [
    {
      id: "debug-home",
      label: "modules.development.items.dashboard",
      path: "/dashboard-old/development",
      icon: "Bug",
    },
    {
      id: "permissions-debug",
      label: "modules.development.items.permissions",
      path: "/dashboard-old/development/permissions",
      icon: "Shield",
    },
    {
      id: "context-debug",
      label: "modules.development.items.context",
      path: "/dashboard-old/development/context",
      icon: "Database",
    },
    {
      id: "logo-debug",
      label: "modules.development.items.logo",
      path: "/dashboard-old/development/logo",
      icon: "Image",
    },
    {
      id: "service-debug",
      label: "modules.development.items.service",
      path: "/dashboard-old/development/service",
      icon: "Server",
    },
    {
      id: "label-testing",
      label: "modules.development.items.labels",
      path: "/dashboard-old/development/labels",
      icon: "QrCode",
    },
    {
      id: "locations-debug",
      label: "modules.development.items.locations",
      path: "/dashboard-old/development/locations-debug",
      icon: "MapPin",
    },
    {
      id: "rich-text-editor",
      label: "modules.development.items.richTextEditor",
      path: "/dashboard-old/development/rich-text-editor",
      icon: "FileText",
    },
    {
      id: "subscription-test",
      label: "modules.development.items.subscriptionTest",
      path: "/dashboard-old/dev/subscription-test",
      icon: "CreditCard",
    },
    {
      id: "sku-generator",
      label: "modules.development.items.skuGenerator",
      path: "/dashboard-old/development/sku-generator",
      icon: "Wand2",
    },
    {
      id: "delivery-debugger",
      label: "modules.development.items.deliveryDebugger",
      path: "/dashboard-old/development/delivery-debugger",
      icon: "Truck",
    },
    {
      id: "status-stepper",
      label: "Status Stepper",
      path: "/dashboard-old/development/status-stepper",
      icon: "Workflow",
    },
    {
      id: "reservations-test",
      label: "modules.development.items.reservationsTest",
      path: "/dashboard-old/development/reservations-test",
      icon: "Clock",
    },
  ],
};
