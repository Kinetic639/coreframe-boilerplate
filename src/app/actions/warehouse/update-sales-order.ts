"use server";

import { updateSalesOrderAction } from "@/app/[locale]/dashboard/warehouse/sales-orders/_actions";
import type { UpdateSalesOrderInput } from "@/server/schemas/sales-orders.schema";

export async function updateSalesOrder(id: string, data: UpdateSalesOrderInput) {
  return updateSalesOrderAction(id, data);
}
