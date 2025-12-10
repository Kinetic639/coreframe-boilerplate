"use server";

import { createMovement as createMovementAction } from "@/app/[locale]/dashboard/warehouse/movements/_actions";
import type { CreateStockMovementInput } from "@/server/schemas/stock-movements.schema";

// Legacy wrapper to keep backwards compatibility with older imports
// Routes now rely on the co-located warehouse/movements/_actions implementation
export async function createMovement(data: CreateStockMovementInput) {
  return createMovementAction(data);
}
