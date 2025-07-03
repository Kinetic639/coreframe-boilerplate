import { Movement } from "@/lib/types/home";
import { mockProducts } from "./products";
import { mockLocations } from "./locations";
import { mockUsers } from "./organization";

export const mockMovements: Movement[] = [
  {
    id: "mov-1",
    type: "inbound",
    product_id: "prod-001",
    quantity: 20,
    location_id: "1",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    id: "mov-2",
    type: "outbound",
    product_id: "prod-002",
    quantity: 10,
    location_id: "2",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440010",
  },
  {
    id: "mov-3",
    type: "correction",
    product_id: "prod-003",
    quantity: -2,
    location_id: "1",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440000",
  },
];

export function getMovementWithDetails() {
  return mockMovements.map((movement) => {
    const product = mockProducts.find((p) => p.id === movement.product_id);
    const location = mockLocations.find((l) => l.id === movement.location_id);
    const user = mockUsers.find((u) => u.id === movement.user_id);

    return {
      ...movement,
      product_name: product ? product.name : "Unknown Product",
      location_name: location ? location.name : "Unknown Location",
      user: user ? `${user.first_name} ${user.last_name}` : "Unknown User",
    };
  });
}
