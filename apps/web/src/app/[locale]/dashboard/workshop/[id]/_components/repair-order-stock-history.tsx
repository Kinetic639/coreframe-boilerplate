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

export async function RepairOrderStockDocuments({
  lines,
  view,
  events,
  locale,
}: {
  lines: LineInfo[];
  view: RepairOrderLineWarehouseView[];
  events: ReservationEventView[];
  locale: string;
}) {
  const t = await getTranslations("modules.workshop.repairOrders.stock");
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

  return (
    <section className="grid gap-3" data-testid="repair-order-stock-documents">
      <div>
        <h2 className="text-base font-semibold">{t("documents.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("documents.subtitle")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("documents.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-3 font-medium">{t("documents.date")}</th>
                <th className="py-2 pr-3 font-medium">{t("documents.document")}</th>
                <th className="py-2 pr-3 font-medium">{t("documents.kind")}</th>
                <th className="py-2 pr-3 font-medium">{t("documents.part")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("documents.quantity")}</th>
                <th className="py-2 pr-3 font-medium">{t("documents.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b last:border-b-0"
                  data-testid="stock-document-row"
                >
                  <td className="py-2 pl-3 pr-3 text-xs text-muted-foreground">
                    {row.date ? new Date(row.date).toLocaleString(locale) : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <DocumentLink number={row.number} movementId={row.movementId} />
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{t(`kinds.${row.kind}`)}</Badge>
                  </td>
                  <td className="py-2 pr-3">{part(byId, row.lineId)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(row.quantity)}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{row.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
              {sorted.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0" data-testid="stock-history-row">
                  <td className="py-2 pl-3 pr-3 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{t(`kinds.${e.eventType}`)}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {part(byId, e.repairOrderLineId ?? e.toRepairOrderLineId)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(e.quantity)}</td>
                  <td className="py-2 pr-3 text-xs">{where(e)}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
