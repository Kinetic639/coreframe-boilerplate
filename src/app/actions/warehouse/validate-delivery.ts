"use server";

import { validateMovement } from "@/app/[locale]/dashboard/warehouse/movements/validation/_actions";
import type { CreateStockMovementInput } from "@/server/schemas/stock-movements.schema";

export async function validateDelivery(data: CreateStockMovementInput) {
  return validateMovement(data);
}
