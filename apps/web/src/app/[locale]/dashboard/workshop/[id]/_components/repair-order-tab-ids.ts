/**
 * Tab ids of the repair order page. A plain module (not "use client"): the
 * server page calls isRepairOrderTab() to pick the initial tab, and a function
 * exported from a client module is only a reference on the server — calling it
 * there throws and takes the whole page down.
 */
export const REPAIR_ORDER_TABS = [
  "overview",
  "lines",
  "warehouse",
  "containers",
  "history",
  "documents",
  "related",
] as const;
export type RepairOrderTab = (typeof REPAIR_ORDER_TABS)[number];

export function isRepairOrderTab(value: unknown): value is RepairOrderTab {
  return REPAIR_ORDER_TABS.includes(value as RepairOrderTab);
}
