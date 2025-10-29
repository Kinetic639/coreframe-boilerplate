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
      path: "/dashboard/development",
      icon: "Bug",
    },
    {
      id: "permissions-debug",
      label: "modules.development.items.permissions",
      path: "/dashboard/development/permissions",
      icon: "Shield",
    },
    {
      id: "context-debug",
      label: "modules.development.items.context",
      path: "/dashboard/development/context",
      icon: "Database",
    },
    {
      id: "logo-debug",
      label: "modules.development.items.logo",
      path: "/dashboard/development/logo",
      icon: "Image",
    },
    {
      id: "service-debug",
      label: "modules.development.items.service",
      path: "/dashboard/development/service",
      icon: "Server",
    },
    {
      id: "label-testing",
      label: "modules.development.items.labels",
      path: "/dashboard/development/labels",
      icon: "QrCode",
    },
    {
      id: "locations-debug",
      label: "modules.development.items.locations",
      path: "/dashboard/development/locations-debug",
      icon: "MapPin",
    },
    {
      id: "rich-text-editor",
      label: "modules.development.items.richTextEditor",
      path: "/dashboard/development/rich-text-editor",
      icon: "FileText",
    },
    {
      id: "subscription-test",
      label: "modules.development.items.subscriptionTest",
      path: "/dashboard/dev/subscription-test",
      icon: "CreditCard",
    },
    {
      id: "sku-generator",
      label: "modules.development.items.skuGenerator",
      path: "/dashboard/development/sku-generator",
      icon: "Wand2",
    },
    {
      id: "delivery-debugger",
      label: "modules.development.items.deliveryDebugger",
      path: "/dashboard/development/delivery-debugger",
      icon: "Truck",
    },
    {
      id: "status-stepper",
      label: "Status Stepper",
      path: "/dashboard/development/status-stepper",
      icon: "Workflow",
    },
  ],
};
