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
        id: "audits",
        label: "Audyty",
        icon: "ClipboardCheck", // lub inna ikona pasująca do audytów
        path: "/dashboard/warehouse/audits",
        submenu: [
          {
            id: "audit-overview",
            label: "Audyty magazynowe",
            path: "/dashboard/warehouse/audits",
            icon: "ClipboardCheck",
          },
          {
            id: "audit-schedule",
            label: "Grafik audytów",
            path: "/dashboard/warehouse/audits/schedule",
            icon: "CalendarDays",
          },
          {
            id: "audit-history",
            label: "Historia audytów",
            path: "/dashboard/warehouse/audits/history",
            icon: "History",
          },
        ],
      },
      {
        id: "labels",
        label: "Etykiety i kody QR",
        icon: "QrCode",
        path: "/dashboard/warehouse/labels",
        submenu: [
          {
            id: "label-generator",
            label: "Generator etykiet",
            path: "/dashboard/warehouse/labels/generator",
            icon: "Plus",
          },
          {
            id: "label-templates",
            label: "Szablony etykiet",
            path: "/dashboard/warehouse/labels/templates",
            icon: "FileText",
          },
          {
            id: "label-batches",
            label: "Partie etykiet",
            path: "/dashboard/warehouse/labels/batches",
            icon: "Layers",
          },
          {
            id: "label-history",
            label: "Historia przypisań",
            path: "/dashboard/warehouse/labels/history",
            icon: "History",
          },
        ],
      },
      {
        id: "scanning",
        label: "Skanowanie kodów",
        icon: "ScanLine",
        path: "/dashboard/warehouse/scanning",
        submenu: [
          {
            id: "scan-delivery",
            label: "Skanowanie dostaw",
            path: "/dashboard/warehouse/scanning/delivery",
            icon: "Truck",
          },
          {
            id: "scan-inventory",
            label: "Skanowanie inwentarza",
            path: "/dashboard/warehouse/scanning/inventory",
            icon: "Package",
          },
          {
            id: "scan-assignment",
            label: "Przypisanie lokalizacji",
            path: "/dashboard/warehouse/scanning/assignment",
            icon: "MapPin",
          },
          {
            id: "scan-verification",
            label: "Weryfikacja produktów",
            path: "/dashboard/warehouse/scanning/verification",
            icon: "CheckCircle",
          },
          {
            id: "scan-operations",
            label: "Operacje skanowania",
            path: "/dashboard/warehouse/scanning/operations",
            icon: "Activity",
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
