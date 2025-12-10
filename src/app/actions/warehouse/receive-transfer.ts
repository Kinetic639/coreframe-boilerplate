"use server";

import { receiveTransferAction } from "@/app/[locale]/dashboard/warehouse/transfers/_actions";
import type { ReceiveTransferInput } from "@/server/schemas/inter-warehouse-transfers.schema";

export async function receiveTransfer(input: ReceiveTransferInput) {
  return receiveTransferAction(input);
}
