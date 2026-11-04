/**
 * One document = one AutoStacja magazyn (U3, docs/WAREHOUSE_UNITS_PLAN.md).
 *
 * A delivery whose lines belong to several magazyny is received as one PZ
 * per magazyn. This splits the lines -- keeping their order -- and renumbers
 * the attribution of each part (1-based positions within its own document).
 */
export interface SplitAttribution {
  lineIndex: number;
  zlNumber: string | null;
  productCode: string | null;
  sourceLineId?: string | null;
}

export interface WarehouseDocumentPart<L> {
  warehouseId: string | null;
  lines: L[];
  attribution: SplitAttribution[];
}

export function splitByWarehouse<L extends { warehouse_id?: string | null }>(
  lines: L[],
  attribution: SplitAttribution[]
): WarehouseDocumentPart<L>[] {
  const parts = new Map<string, WarehouseDocumentPart<L>>();
  const positionOf = new Map<number, { key: string; position: number }>();

  lines.forEach((line, index) => {
    const warehouseId = line.warehouse_id ?? null;
    const key = warehouseId ?? "";
    let part = parts.get(key);
    if (!part) {
      part = { warehouseId, lines: [], attribution: [] };
      parts.set(key, part);
    }
    part.lines.push(line);
    positionOf.set(index + 1, { key, position: part.lines.length });
  });

  for (const a of attribution) {
    const at = positionOf.get(a.lineIndex);
    if (!at) continue;
    parts.get(at.key)!.attribution.push({ ...a, lineIndex: at.position });
  }
  return [...parts.values()];
}

/** Distinct magazyny of the lines (null = a line without magazyn). */
export function warehousesOf(lines: Array<{ warehouse_id?: string | null }>): Array<string | null> {
  return [...new Set(lines.map((l) => l.warehouse_id ?? null))];
}
