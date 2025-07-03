import { StockAlert } from "@/lib/types/home";
import { mockProducts } from "./products";

export const mockStockAlerts: StockAlert[] = [
  {
    id: "prod-1",
    product_id: "prod-001",
    status: "low_stock",
    current_stock: 5,
    min_quantity: 10,
  },
  {
    id: "prod-2",
    product_id: "prod-002",
    status: "out_of_stock",
    current_stock: 0,
    min_quantity: 5,
  },
  {
    id: "prod-3",
    product_id: "prod-003",
    status: "recently_stocked",
    current_stock: 50,
    min_quantity: 10,
  },
];

export function getStockAlertsWithProductDetails() {
  return mockStockAlerts.map((alert) => {
    const product = mockProducts.find((p) => p.id === alert.product_id);
    return {
      ...alert,
      product_name: product ? product.name : "Unknown Product",
    };
  });
}
