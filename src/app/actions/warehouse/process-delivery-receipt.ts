"use server";

import { processDeliveryReceiptAction } from "@/app/[locale]/dashboard/warehouse/receipts/_actions";
import type { ProcessDeliveryReceiptInput } from "@/server/schemas/receipts.schema";

export async function processDeliveryReceipt(input: ProcessDeliveryReceiptInput) {
  return processDeliveryReceiptAction(input);
}
