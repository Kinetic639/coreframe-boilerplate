import { Movement } from "@/lib/types/home";

export const mockMovements: Movement[] = [
  {
    id: "mov-1",
    type: "inbound",
    product_name: "Produkt A",
    quantity: 20,
    location_name: "Magazyn Główny",
    timestamp: new Date().toISOString(),
    user: "Jan Kowalski",
  },
  {
    id: "mov-2",
    type: "outbound",
    product_name: "Produkt B",
    quantity: 10,
    location_name: "Sklep 1",
    timestamp: new Date().toISOString(),
    user: "Anna Nowak",
  },
  {
    id: "mov-3",
    type: "correction",
    product_name: "Produkt C",
    quantity: -2,
    location_name: "Magazyn Główny",
    timestamp: new Date().toISOString(),
    user: "Audytor",
  },
];
