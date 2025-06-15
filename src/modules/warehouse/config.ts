import { ModuleConfig } from "@/lib/types/module";

export const warehouseModule: ModuleConfig = {
  id: "warehouse",
  title: "Magazyn",
  description: "Zarządzanie magazynem i zapasami",
  color: "#10b981",
  items: [
    {
      id: "products",
      label: "Produkty",
      path: "/dashboard/magazyn/produkty",
      icon: "Package",
      submenu: [
        {
          id: "products-list",
          label: "Lista produktów",
          path: "/dashboard/magazyn/produkty/lista",
          icon: "List",
          submenu: [
            {
              id: "materials",
              label: "Materiały",
              path: "/dashboard/magazyn/produkty/materialy",
              icon: "Package",
            },
            {
              id: "parts",
              label: "Części",
              path: "/dashboard/magazyn/produkty/czesci",
              icon: "Cog",
            },
            {
              id: "accessories",
              label: "Akcesoria",
              path: "/dashboard/magazyn/produkty/akcesoria",
              icon: "Archive",
            },
          ],
        },
        {
          id: "categories",
          label: "Kategorie",
          path: "/dashboard/magazyn/kategorie",
          icon: "FolderOpen",
        },
      ],
    },
    {
      id: "inventory",
      label: "Zapasy",
      path: "/dashboard/magazyn/zapasy",
      icon: "BarChart3",
      submenu: [
        {
          id: "stock-levels",
          label: "Poziomy zapasów",
          path: "/dashboard/magazyn/zapasy/poziomy",
          icon: "TrendingUp",
        },
        {
          id: "stock-movements",
          label: "Ruchy magazynowe",
          path: "/dashboard/magazyn/zapasy/ruchy",
          icon: "ArrowUpDown",
        },
      ],
    },
    {
      id: "suppliers",
      label: "Dostawcy",
      path: "/dashboard/magazyn/dostawcy",
      icon: "Users",
      submenu: [
        {
          id: "supplier-list",
          label: "Lista dostawców",
          path: "/dashboard/magazyn/dostawcy",
          icon: "Users",
        },
        {
          id: "deliveries",
          label: "Dostawy",
          path: "/dashboard/magazyn/dostawy",
          icon: "Truck",
        },
      ],
    },
  ],
};
