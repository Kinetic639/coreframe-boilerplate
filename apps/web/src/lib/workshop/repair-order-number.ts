/**
 * DMS repair-order number: `<prefix>/<number>/<year>/<warehouse>/BL`, e.g. ZL/178024/26/3122/BL
 * or ZLEC/175605/26/3332/BL. The same number exists in several warehouses, so the identity of
 * an order is warehouse + number + year. Mirrors `public.parse_repair_order_number` in the
 * database (migration 20261008120213), which fills the repair_orders columns.
 */
export interface RepairOrderNumberParts {
  prefix: "ZL" | "ZLEC";
  orderNo: string;
  /** Two-digit year, e.g. 26. */
  year: number;
  warehouseCode: string;
}

const NUMBER_RE = /^(ZLEC|ZL)\/([0-9]+)\/([0-9]{2,4})\/([0-9]{3,5})(\/|$)/i;

export function parseRepairOrderNumber(
  value: string | null | undefined
): RepairOrderNumberParts | null {
  const m = value?.trim().match(NUMBER_RE);
  if (!m) return null;
  return {
    prefix: m[1]!.toUpperCase() as "ZL" | "ZLEC",
    orderNo: m[2]!,
    year: Number(m[3]) % 100,
    warehouseCode: m[4]!,
  };
}

/** Canonical form, e.g. `ZL/178024/26/3122/BL`; unparsable values are only trimmed. */
export function normalizeRepairOrderNumber(value: string): string {
  const p = parseRepairOrderNumber(value);
  if (!p) return value.trim();
  return `${p.prefix}/${p.orderNo}/${String(p.year).padStart(2, "0")}/${p.warehouseCode}/BL`;
}

/** Identity key: warehouse + number + year (null when the number is not in DMS format). */
export function repairOrderNumberKey(value: string | null | undefined): string | null {
  const p = parseRepairOrderNumber(value);
  return p ? `${p.warehouseCode}|${p.orderNo}|${p.year}` : null;
}
