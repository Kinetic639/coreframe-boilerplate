"use server";

import { updateOrderStatusAction } from "@/app/[locale]/dashboard/warehouse/sales-orders/_actions";
import type { UpdateOrderStatusInput } from "@/server/schemas/sales-orders.schema";

export async function updateOrderStatus(id: string, data: UpdateOrderStatusInput) {
  return updateOrderStatusAction(id, data);
}
