"use server";

import { shipTransferAction } from "@/app/[locale]/dashboard/warehouse/transfers/_actions";
import type { ShipTransferInput } from "@/server/schemas/inter-warehouse-transfers.schema";

export async function shipTransfer(input: ShipTransferInput) {
  return shipTransferAction(input);
}
