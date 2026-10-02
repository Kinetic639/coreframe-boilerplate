import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";

export function itemKey(item: ReceivingPendingItem) {
  return `${item.variantId}:${item.repairOrderLineId ?? "free"}`;
}

export function locLabel(code: string | null | undefined, name: string | null | undefined) {
  if (code && name) return `${code} · ${name}`;
  return code ?? name ?? "—";
}

export function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Repair-order parts that go into containers (not bulk material). */
export function isContainerPart(item: ReceivingPendingItem) {
  return !!item.repairOrderLineId && item.handlingMode !== "bulk";
}

/** Parts put away loose on a location: free stock and bulk material. */
export function isLoosePart(item: ReceivingPendingItem) {
  return !item.repairOrderLineId || item.handlingMode === "bulk";
}

export type RepairOrderInfo = {
  zlNumber: string | null;
  clientName: string | null;
  vehicleBrand: string | null;
  containers: Array<{
    id: string;
    code: string;
    status: string;
    location: { id: string; code: string | null; name: string | null } | null;
  }>;
};
