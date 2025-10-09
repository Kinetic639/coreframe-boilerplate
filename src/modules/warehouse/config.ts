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
        id: "products",
        label: "modules.warehouse.items.products.title",
        path: "/dashboard/warehouse/products",
        icon: "Package",
        submenu: [
          {
            id: "products-overview",
            label: "modules.warehouse.items.products.overview",
            path: "/dashboard/warehouse/products",
            icon: "Package",
          },
          {
            id: "products-templates",
            label: "modules.warehouse.items.products.templates",
            path: "/dashboard/warehouse/products/templates",
            icon: "FileTemplate",
          },
        ],
      },
      {
        id: "inventory",
        label: "modules.warehouse.items.inventory.title",
        path: "/dashboard/warehouse/inventory",
        icon: "Archive",
        submenu: [
          {
            id: "inventory-movements",
            label: "modules.warehouse.items.inventory.movements",
            path: "/dashboard/warehouse/inventory/movements",
            icon: "ArrowRightLeft",
          },
          {
            id: "inventory-adjustments",
            label: "modules.warehouse.items.inventory.adjustments.title",
            path: "/dashboard/warehouse/inventory/adjustments",
            icon: "Settings",
            submenu: [
              {
                id: "audits",
                label: "modules.warehouse.items.audits.title",
                path: "/dashboard/warehouse/audits",
                icon: "ClipboardCheck",
              },
              {
                id: "adjustments",
                label: "modules.warehouse.items.inventory.adjustments.single",
                path: "/dashboard/warehouse/inventory/adjustments",
                icon: "Edit",
              },
            ],
          },
        ],
      },
      {
        id: "locations",
        label: "modules.warehouse.items.locations",
        path: "/dashboard/warehouse/locations",
        icon: "MapPin",
      },
      {
        id: "labels",
        label: "modules.warehouse.items.labels.title",
        icon: "QrCode",
        path: "/dashboard/warehouse/labels",
      },
      {
        id: "suppliers",
        label: "modules.warehouse.items.suppliers.title",
        icon: "Truck",
        path: "/dashboard/warehouse/suppliers",
        submenu: [
          {
            id: "supplier-list",
            label: "modules.warehouse.items.suppliers.list",
            path: "/dashboard/warehouse/suppliers/list",
            icon: "List",
          },
          {
            id: "deliveries",
            label: "modules.warehouse.items.suppliers.deliveries",
            path: "/dashboard/warehouse/suppliers/deliveries",
            icon: "Inbox",
          },
        ],
      },
      {
        id: "scanning",
        label: "modules.warehouse.items.scanning.title",
        icon: "ScanLine",
        path: "/dashboard/warehouse/scanning",
        submenu: [
          {
            id: "scan-delivery",
            label: "modules.warehouse.items.scanning.delivery",
            path: "/dashboard/warehouse/scanning/delivery",
            icon: "Truck",
          },
          {
            id: "scan-inventory",
            label: "modules.warehouse.items.scanning.inventory",
            path: "/dashboard/warehouse/scanning/inventory",
            icon: "Package",
          },
          {
            id: "scan-assignment",
            label: "modules.warehouse.items.scanning.assignment",
            path: "/dashboard/warehouse/scanning/assignment",
            icon: "MapPin",
          },
          {
            id: "scan-verification",
            label: "modules.warehouse.items.scanning.verification",
            path: "/dashboard/warehouse/scanning/verification",
            icon: "CheckCircle",
          },
          {
            id: "scan-operations",
            label: "modules.warehouse.items.scanning.operations",
            path: "/dashboard/warehouse/scanning/operations",
            icon: "Activity",
          },
        ],
      },
      {
        id: "settings",
        label: "modules.warehouse.items.settings.title",
        path: "/dashboard/warehouse/settings",
        icon: "Settings",
      },
    ],
    widgets,
  };
}
