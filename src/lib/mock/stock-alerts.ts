import { StockAlert } from "@/lib/types/home";

export const mockStockAlerts: StockAlert[] = [
  {
    id: "prod-1",
    name: "Produkt A",
    status: "low_stock",
    current_stock: 5,
    min_quantity: 10,
  },
  {
    id: "prod-2",
    name: "Produkt B",
    status: "out_of_stock",
    current_stock: 0,
    min_quantity: 5,
  },
  {
    id: "prod-3",
    name: "Produkt C",
    status: "recently_stocked",
    current_stock: 50,
    min_quantity: 10,
  },
];
