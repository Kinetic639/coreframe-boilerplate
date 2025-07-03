import { QuickAction } from "@/lib/types/home";

export const mockQuickActions: QuickAction[] = [
  {
    id: "qa-1",
    label: "Dodaj produkt",
    href: "/dashboard/warehouse/products?action=add",
    icon: "PlusCircle",
  },
  {
    id: "qa-2",
    label: "Wygeneruj etykiety",
    href: "/dashboard/warehouse/labels/products",
    icon: "Tag",
  },
  {
    id: "qa-3",
    label: "Rozpocznij audyt",
    href: "/dashboard/warehouse/audit",
    icon: "ScanLine",
  },
  {
    id: "qa-4",
    label: "Dodaj lokalizację",
    href: "/dashboard/warehouse/locations?action=add",
    icon: "MapPin",
  },
  {
    id: "qa-5",
    label: "Zgłoś problem",
    href: "/dashboard/support",
    icon: "AlertCircle",
  },
];
