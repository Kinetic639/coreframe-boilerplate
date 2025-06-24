import { ModuleConfig } from "@/lib/types/module";

export const catalogModule: ModuleConfig = {
  id: "catalog",
  slug: "catalog",
  title: "Katalog",
  description: "Katalog produktów dla sklepu internetowego",
  color: "#f97316",
  items: [
    {
      id: "products",
      label: "Produkty",
      path: "/dashboard/catalog/products",
      icon: "Package",
    },
    {
      id: "categories",
      label: "Kategorie",
      path: "/dashboard/catalog/categories",
      icon: "Folder",
    },
  ],
};
