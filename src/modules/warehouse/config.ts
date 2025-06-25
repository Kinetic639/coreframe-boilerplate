import { ModuleConfig } from "@/lib/types/module";
import { loadProductTypes } from "./api/load-product-types";
import { Widget } from "@/lib/types/widgets";

export async function getWarehouseModule(orgId: string): Promise<ModuleConfig> {
  const productTypes = await loadProductTypes(orgId);

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
    description: "Zarządzanie magazynem i zapasami",
    color: "#10b981",
    items: [
      {
        id: "products",
        label: "Produkty",
        path: "/dashboard/warehouse/products",
        icon: "Package",
        submenu: [
          {
            id: "products-list",
            label: "Lista produktów",
            path: "/dashboard/warehouse/products/list",
            icon: "List",
            submenu: [
              ...productTypes.map((type) => ({
                id: `type-${type.slug}`,
                label: type.name,
                path: `/dashboard/warehouse/products?type=${type.slug}`,
                icon: "Package",
              })),
              {
                id: "add-type",
                label: "Nowy Typ",
                icon: "PlusCircle",
                type: "action",
                actionId: "addNewProductType",
                allowedUsers: [{ role: "org_owner", scope: "org" }],
              },
            ],
          },
        ],
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
