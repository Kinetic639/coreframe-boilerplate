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

/**
 * Older links (global search, notifications) open `?tab=receiving` or
 * `?tab=stock`; the per-part state now lives on "Pozycje" ("lines").
 */
export const LEGACY_REPAIR_ORDER_WAREHOUSE_TABS = ["receiving", "stock"] as const;

export function isLegacyRepairOrderWarehouseTab(
  value: unknown
): value is (typeof LEGACY_REPAIR_ORDER_WAREHOUSE_TABS)[number] {
  return LEGACY_REPAIR_ORDER_WAREHOUSE_TABS.includes(
    value as (typeof LEGACY_REPAIR_ORDER_WAREHOUSE_TABS)[number]
  );
}
