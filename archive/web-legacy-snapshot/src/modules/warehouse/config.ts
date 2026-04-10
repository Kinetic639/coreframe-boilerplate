import { ModuleConfig } from "@/lib/types/module";
import { Widget } from "@/lib/types/widgets";

export async function getWarehouseModule(): Promise<ModuleConfig> {
  const widgets: Widget[] = [
    {
      id: "warehouse-summary",
      title: "Podsumowanie produktów",
      type: "chart",
      data: {
        labels: ["Lakiery", "Narzędzia", "Materiały ścierne", "Chemia"],
        datasets: [
          {
            label: "Ilość",
            data: [10, 5, 2, 7],
            backgroundColor: "rgba(34, 197, 94, 0.2)",
            borderColor: "rgba(34, 197, 94, 1)",
          },
        ],
      },
      config: {
        type: "bar",
        responsive: true,
      },
    },
  ];

  return {
    id: "warehouse",
    slug: "warehouse",
    title: "modules.warehouse.title",
    icon: "Warehouse",
    description: "modules.warehouse.description",
    color: "#10b981",
    items: [
      {
        id: "inventory",
        label: "modules.warehouse.items.inventory.title",
        path: "/dashboard-old/warehouse/inventory",
        icon: "Archive",
        submenu: [
          {
            id: "inventory-movements",
            label: "modules.warehouse.items.inventory.movements",
            path: "/dashboard-old/warehouse/inventory/movements",
            icon: "ArrowRightLeft",
          },
          {
            id: "products-overview",
            label: "modules.warehouse.items.products.title",
            path: "/dashboard-old/warehouse/products",
            icon: "Package",
          },
          {
            id: "locations",
            label: "modules.warehouse.items.locations",
            path: "/dashboard-old/warehouse/locations",
            icon: "MapPin",
          },
          {
            id: "labels",
            label: "modules.warehouse.items.labels.title",
            icon: "QrCode",
            path: "/dashboard-old/warehouse/labels",
          },
          {
            id: "alerts",
            label: "modules.warehouse.items.alerts.title",
            icon: "AlertTriangle",
            path: "/dashboard-old/warehouse/alerts",
          },
          {
            id: "inventory-adjustments",
            label: "modules.warehouse.items.inventory.adjustments.title",
            path: "/dashboard-old/warehouse/inventory/adjustments",
            icon: "Settings",
            submenu: [
              {
                id: "audits",
                label: "modules.warehouse.items.audits.title",
                path: "/dashboard-old/warehouse/audits",
                icon: "ClipboardCheck",
              },
              {
                id: "adjustments",
                label: "modules.warehouse.items.inventory.adjustments.single",
                path: "/dashboard-old/warehouse/inventory/adjustments",
                icon: "Edit",
              },
            ],
          },
        ],
      },
      {
        id: "sales",
        label: "modules.warehouse.items.sales.title",
        path: "/dashboard-old/warehouse/sales",
        icon: "ShoppingCart",
        submenu: [
          {
            id: "sales-orders",
            label: "modules.warehouse.items.sales.orders",
            path: "/dashboard-old/warehouse/sales-orders",
            icon: "FileText",
          },
          {
            id: "clients",
            label: "modules.warehouse.items.sales.clients",
            path: "/dashboard-old/warehouse/clients",
            icon: "Users",
          },
        ],
      },
      {
        id: "purchases",
        label: "modules.warehouse.items.purchases.title",
        path: "/dashboard-old/warehouse/purchases",
        icon: "ShoppingBag",
        submenu: [
          {
            id: "purchase-orders",
            label: "modules.warehouse.items.purchases.orders",
            path: "/dashboard-old/warehouse/purchases",
            icon: "FileText",
          },
          {
            id: "deliveries",
            label: "modules.warehouse.items.deliveries.title",
            path: "/dashboard-old/warehouse/deliveries",
            icon: "Inbox",
          },
          {
            id: "suppliers",
            label: "modules.warehouse.items.suppliers.title",
            icon: "Truck",
            path: "/dashboard-old/warehouse/suppliers/list",
          },
          {
            id: "scan-delivery",
            label: "modules.warehouse.items.scanning.delivery",
            path: "/dashboard-old/warehouse/scanning/delivery",
            icon: "ScanLine",
          },
        ],
      },
      {
        id: "settings",
        label: "modules.warehouse.items.settings.title",
        path: "/dashboard-old/warehouse/settings",
        icon: "Settings",
      },
    ],
    widgets,
  };
}
