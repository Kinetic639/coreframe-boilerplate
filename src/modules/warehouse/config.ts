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
    title: "Magazyn",
    icon: "Warehouse",
    description: "Zarządzanie magazynem i zapasami",
    color: "#10b981",
    items: [
      {
        id: "products-list",
        label: "Produkty",
        path: "/dashboard/warehouse/products",
        icon: "Package",
      },
      {
        id: "locations",
        label: "Lokalizacje",
        path: "/dashboard/warehouse/locations",
        icon: "MapPin",
      },
      {
        id: "labels",
        label: "Etykiety i szablony",
        icon: "Tag",
        path: "/dashboard/warehouse/labels",
        submenu: [
          {
            id: "product-labels",
            label: "Etykiety produktów",
            path: "/dashboard/warehouse/labels/products",
            icon: "Package",
          },
          {
            id: "location-labels",
            label: "Etykiety lokalizacji",
            path: "/dashboard/warehouse/labels/locations",
            icon: "MapPin",
          },

          {
            id: "label-templates",
            label: "Szablony etykiet",
            path: "/dashboard/warehouse/labels/templates",
            icon: "FileText",
          },
        ],
      },
      {
        id: "suppliers",
        label: "Dostawcy",
        icon: "Truck",
        path: "/dashboard/warehouse/suppliers",
        submenu: [
          {
            id: "supplier-list",
            label: "Lista dostawców",
            path: "/dashboard/warehouse/suppliers/list",
            icon: "List",
          },
          {
            id: "deliveries",
            label: "Dostawy",
            path: "/dashboard/warehouse/suppliers/deliveries",
            icon: "Inbox",
          },
        ],
      },
    ],
    widgets,
  };
}
