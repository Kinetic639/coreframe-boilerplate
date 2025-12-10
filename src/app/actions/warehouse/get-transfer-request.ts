"use server";

import { getTransferRequestAction } from "@/app/[locale]/dashboard/warehouse/transfers/_actions";

export async function getTransferRequest(transferId: string) {
  return getTransferRequestAction(transferId);
}
