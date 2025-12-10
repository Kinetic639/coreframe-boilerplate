"use server";

import { listTransferRequestsAction } from "@/app/[locale]/dashboard/warehouse/transfers/_actions";
import type { TransferFilters } from "@/server/schemas/inter-warehouse-transfers.schema";

export async function getTransferRequests(
  organizationId: string,
  branchId?: string,
  filters?: TransferFilters
) {
  // New action derives organization and branch from context; retain signature for compatibility
  return listTransferRequestsAction(branchId, filters);
}
