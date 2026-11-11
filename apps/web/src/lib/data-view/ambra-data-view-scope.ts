import type { DataViewScope } from "./types";

export const dataViewScope = {
  global: (): DataViewScope => ({ kind: "global" }),
  organization: (organizationId: string): DataViewScope => ({
    kind: "organization",
    organizationId,
  }),
  branch: (organizationId: string, branchId: string | null): DataViewScope => ({
    kind: "branch",
    organizationId,
    branchId,
  }),
};
