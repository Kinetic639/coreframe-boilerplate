"use server";

import {
  getMovements as getMovementsAction,
  getMovementsWithRelations,
  getMovementById as getMovementByIdAction,
} from "@/app/[locale]/dashboard/warehouse/movements/_actions";
import type { StockMovementFilters } from "@/server/schemas/stock-movements.schema";

export async function getMovements(filters: StockMovementFilters = {}) {
  return getMovementsAction(filters);
}

export async function getMovementsWithDetails(filters: StockMovementFilters = {}) {
  return getMovementsWithRelations(filters);
}

export async function getMovementById(movementId: string) {
  return getMovementByIdAction(movementId);
}
