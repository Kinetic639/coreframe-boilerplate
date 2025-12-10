"use server";

import { createSalesOrderAction } from "@/app/[locale]/dashboard/warehouse/sales-orders/_actions";
import type { CreateSalesOrderInput } from "@/server/schemas/sales-orders.schema";

export async function createSalesOrder(data: CreateSalesOrderInput) {
  return createSalesOrderAction(data);
}
