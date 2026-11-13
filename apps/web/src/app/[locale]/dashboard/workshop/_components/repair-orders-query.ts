import type { PaginatedResult } from "@/lib/data-view/types";
import { listRepairOrdersPageAction } from "@/app/actions/workshop/repair-orders";
import type { RepairOrderHeader } from "@/server/services/repair-orders.service";
import { repairOrderListParams, type RepairOrderState } from "./repair-orders-state";

// One cache entry per page the address asks for, per organization and
// branch, under the workshop's own key (workshopKeys.all, written out: that
// module is the client's, and the page puts the first page here too).

export type RepairOrdersScope = { organizationId: string; branchId: string | null };
export type RepairOrderList = PaginatedResult<RepairOrderHeader>;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;

export const repairOrderKeys = {
  list: (scope: RepairOrdersScope, state: RepairOrderState) =>
    [
      "workshop-repair-orders",
      "list",
      scope.organizationId,
      scope.branchId,
      repairOrderListParams(state),
    ] as const,
};

export const repairOrderListQuery = (scope: RepairOrdersScope, state: RepairOrderState) => ({
  queryKey: repairOrderKeys.list(scope, state),
  queryFn: async (): Promise<RepairOrderList> => {
    const result = await listRepairOrdersPageAction(scope, repairOrderListParams(state));
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});
