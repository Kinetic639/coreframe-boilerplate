import { ModuleConfig } from "@/lib/types/module";

export const warehouseModule: ModuleConfig = {
  id: "warehouse",
  slug: "warehouse",
  title: "Magazyn",
  description: "Zarządzanie magazynem i zapasami",
  color: "#10b981",
  items: [
    {
      id: "products",
      label: "Produkty",
      path: "/dashboard/warehouse/products", // kanoniczna baza
      icon: "Package",
      submenu: [
        {
          id: "products-list",
          label: "Lista produktów",
          path: "/dashboard/warehouse/products/list", // jeszcze nie dodane do routingu
          icon: "List",
          submenu: [
            {
              id: "materials",
              label: "Materiały",
              path: "/dashboard/warehouse/products/materials",
              icon: "Package",
            },
            {
              id: "parts",
              label: "Części",
              path: "/dashboard/warehouse/products/parts",
              icon: "Cog",
            },
            {
              id: "accessories",
              label: "Akcesoria",
              path: "/dashboard/warehouse/products/accessories", // nowa
              icon: "Archive",
            },
          ],
        },
        {
          id: "categories",
          label: "Kategorie",
          path: "/dashboard/warehouse/categories", // nowa
          icon: "FolderOpen",
        },
      ],
    },
    {
      id: "inventory",
      label: "Zapasy",
      path: "/dashboard/warehouse/inventory", // nowa
      icon: "BarChart3",
      submenu: [
        {
          id: "stock-levels",
          label: "Poziomy zapasów",
          path: "/dashboard/warehouse/inventory/levels", // nowa
          icon: "TrendingUp",
        },
        {
          id: "stock-movements",
          label: "Ruchy magazynowe",
          path: "/dashboard/warehouse/inventory/movements", // nowa
          icon: "ArrowUpDown",
        },
      ],
    },
    {
      id: "suppliers",
      label: "Dostawcy",
      path: "/dashboard/warehouse/suppliers",
      icon: "Users",
      submenu: [
        {
          id: "supplier-list",
          label: "Lista dostawców",
          path: "/dashboard/warehouse/suppliers", // już istnieje
          icon: "Users",
        },
        {
          id: "deliveries",
          label: "Dostawy",
          path: "/dashboard/warehouse/deliveries",
          icon: "Truck",
        },
      ],
    },
  ],
};
