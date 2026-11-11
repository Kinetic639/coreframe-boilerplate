import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import type { RepairOrderLineWarehouseView } from "@/server/services/repair-orders.service";
import type { ReservationEventView } from "@/server/services/inventory-reservations.service";

/**
 * "Magazyn" and "Historia" of a repair order (stage E7): every warehouse
 * document of the order in time order (PZ, REZ, MM, RW, releases), and the
 * full reservation history with who / when / document / reason.
 */

type LineInfo = { id: string; sku: string | null; productName: string };

type DocumentRow = {
  key: string;
  date: string;
  kind: string;
  number: string | null;
  movementId: string | null;
  lineId: string | null;
  quantity: number;
  detail: string | null;
};

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function part(lines: Map<string, LineInfo>, id: string | null) {
  const line = id ? lines.get(id) : undefined;
  return line ? `${line.sku ? `${line.sku} · ` : ""}${line.productName}` : "—";
}

function DocumentLink({
  number,
  movementId,
}: {
  number: string | null;
  movementId: string | null;
}) {
  if (!number) return <span className="text-muted-foreground">—</span>;
  return movementId ? (
    <Link
      href={{
        pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
        params: { movementId },
      }}
      className="font-mono text-xs text-primary hover:underline"
    >
      {number}
    </Link>
  ) : (
    <span className="font-mono text-xs">{number}</span>
  );
}

/** One warehouse document of the order with its lines (parts of this order only). */
export type StockDocument = {
  key: string;
  number: string | null;
  movementId: string | null;
  date: string;
  kind: string;
  lines: Array<{ key: string; part: string; quantity: number; detail: string | null }>;
};

/**
 * Every warehouse document of the order (PZ, REZ, MM, RW, releases), oldest
 * first, with its lines -- the "Magazyn" half of "Magazyn i zamówienia".
 */
export function stockDocumentsOf(
  lines: LineInfo[],
  view: RepairOrderLineWarehouseView[],
  events: ReservationEventView[]
): StockDocument[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const rows: DocumentRow[] = [];
  for (const v of view) {
    for (const d of v.receipts) {
      rows.push({
        key: `pz:${d.movementId}:${v.repairOrderLineId}`,
        date: d.date ?? "",
        kind: "receipt",
        number: d.documentNumber,
        movementId: d.movementId,
        lineId: v.repairOrderLineId,
        quantity: d.quantity,
        detail: d.locationName,
      });
    }
    for (const d of v.issues) {
      rows.push({
        key: `rw:${d.movementId}:${v.repairOrderLineId}`,
        date: d.date ?? "",
        kind: "issue",
        number: d.documentNumber,
        movementId: d.movementId,
        lineId: v.repairOrderLineId,
        quantity: d.quantity,
        detail: d.locationName,
      });
    }
  }
  for (const e of events) {
    // An issue is already listed as its RW; the reservation side of it is history.
    if (e.eventType === "issued") continue;
    const isMovement = e.eventType === "moved";
    rows.push({
      key: `ev:${e.id}`,
      date: e.createdAt,
      kind: e.eventType,
      number: isMovement ? e.movementNumber : e.reservationNumber,
      movementId: isMovement ? e.movementId : null,
      lineId: e.repairOrderLineId,
      quantity: e.quantity,
      detail: e.reason,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const documents = new Map<string, StockDocument>();
  for (const row of rows) {
    const key = `${row.kind}:${row.number ?? row.key}`;
    const doc = documents.get(key) ?? {
      key,
      number: row.number,
      movementId: row.movementId,
      date: row.date,
      kind: row.kind,
      lines: [],
    };
    doc.lines.push({
      key: row.key,
      part: part(byId, row.lineId),
      quantity: row.quantity,
      detail: row.detail,
    });
    documents.set(key, doc);
  }
  return [...documents.values()];
}

export async function RepairOrderStockHistory({
  lines,
  events,
  locationNames,
  locale,
}: {
  lines: LineInfo[];
  events: ReservationEventView[];
  locationNames: Record<string, string>;
  locale: string;
}) {
  const t = await getTranslations("modules.workshop.repairOrders.stock");
  const byId = new Map(lines.map((l) => [l.id, l]));
  const where = (e: ReservationEventView) => {
    const from = e.locationId ? (locationNames[e.locationId] ?? "—") : null;
    const to = e.toLocationId ? (locationNames[e.toLocationId] ?? "—") : null;
    if (from && to) return `${from} → ${to}`;
    return from ?? to ?? "—";
  };
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // One operation on several parts = one row: its events share the
  // transaction time, kind, actor, reason and document.
  const operations = new Map<string, ReservationEventView[]>();
  for (const e of sorted) {
    const key = [
      e.createdAt,
      e.eventType,
      e.actorUserId,
      e.reason,
      e.movementId,
      e.reservationNumber,
    ].join("|");
    const group = operations.get(key);
    if (group) group.push(e);
    else operations.set(key, [e]);
  }
  const rows = [...operations.entries()];

  return (
    <section className="grid gap-3" data-testid="repair-order-stock-history">
      <div>
        <h2 className="text-base font-semibold">{t("history.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("history.subtitle")}</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-3 font-medium">{t("history.when")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.event")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.part")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("history.quantity")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.where")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.document")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.reason")}</th>
                <th className="py-2 pr-3 font-medium">{t("history.who")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, group]) => {
                const e = group[0];
                const places = [...new Set(group.map(where))];
                return (
                  <tr
                    key={key}
                    className="border-b last:border-b-0"
                    data-testid="stock-history-row"
                  >
                    <td className="py-2 pl-3 pr-3 text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{t(`kinds.${e.eventType}`)}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {group.length === 1 ? (
                        part(byId, e.repairOrderLineId ?? e.toRepairOrderLineId)
                      ) : (
                        <ul className="grid gap-0.5" data-testid="stock-history-parts">
                          {group.map((g) => (
                            <li key={g.id}>
                              {part(byId, g.repairOrderLineId ?? g.toRepairOrderLineId)}{" "}
                              <span className="text-xs text-muted-foreground">
                                × {fmt(g.quantity)}
                                {places.length > 1 ? ` · ${where(g)}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {fmt(group.reduce((sum, g) => sum + g.quantity, 0))}
                    </td>
                    <td className="py-2 pr-3 text-xs">{places.length === 1 ? places[0] : "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs">{e.reservationNumber ?? "—"}</span>
                      {e.movementNumber ? (
                        <div>
                          <DocumentLink number={e.movementNumber} movementId={e.movementId} />
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs">{e.reason ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{e.actorName ?? t("history.system")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
