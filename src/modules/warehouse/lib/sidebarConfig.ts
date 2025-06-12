import { ModuleMenu } from "../../common/types/moduleMenu";

export const warehouseModuleSidebar: ModuleMenu = {
  title: "Magazyn",
  items: [
    {
      path: "/magazyn",
      label: "Przegląd magazynu",
      icon: "Warehouse",
    },
    {
      path: "/magazyn/dostawy",
      label: "Dostawy",
      icon: "Truck",
    },
    {
      path: "/magazyn/dostawcy",
      label: "Dostawcy",
      icon: "Users",
    },
    {
      path: "/magazyn/produkty",
      label: "Produkty",
      icon: "Package",
      submenu: [
        {
          path: "/magazyn/produkty",
          label: "Lista produktów",
          icon: "Package",
        },
        {
          path: "/magazyn/kategorie",
          label: "Kategorie produktów",
          icon: "Archive",
        },
      ],
    },
    {
      path: "/magazyn/raporty",
      label: "Raporty",
      icon: "FileText",
    },
    {
      path: "/magazyn/ustawienia",
      label: "Ustawienia",
      icon: "Settings",
      submenu: [
        {
          path: "/magazyn/ustawienia/jednostki",
          label: "Jednostki miary",
        },
        {
          path: "/magazyn/ustawienia/lokalizacje",
          label: "Lokalizacje",
        },
      ],
    },
  ],
};
