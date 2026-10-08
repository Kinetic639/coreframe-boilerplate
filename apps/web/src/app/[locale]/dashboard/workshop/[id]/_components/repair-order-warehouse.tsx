import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDownToLine, ArrowUpFromLine, MapPin, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils";
import type {
  RepairOrderLineReadModel,
  RepairOrderLineWarehouseView,
  RepairOrderWarehouseDocument,
} from "@/server/services/repair-orders.service";

type Props = {
  lines: RepairOrderLineReadModel[];
  view: RepairOrderLineWarehouseView[];
  loadError: boolean;
};

/**
 * Zone 3 / Phase 11: the two warehouse views of a RepairOrder.
 * - "Zamówienia-Przyjęcia": per line ordered / received / outstanding, with the PZ documents
 *   that received it;
 * - "Magazyn": per line available for issue, where it is now (location, container) and the
 *   RW documents that issued it.
 * Every document links to its movement detail.
 */
export async function RepairOrderWarehouse({ lines, view, loadError }: Props) {
  const t = await getTranslations("modules.workshop.repairOrders.warehouse");
  const locale = await getLocale();
  const byLine = new Map(view.map((v) => [v.repairOrderLineId, v]));
  const when = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  if (lines.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="repair-order-warehouse">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
      </div>

      {loadError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
          {t("loadFailed")}
        </div>
      )}

      <Tabs defaultValue="receiving">
        <TabsList>
          <TabsTrigger value="receiving">{t("tabs.receiving")}</TabsTrigger>
          <TabsTrigger value="stock">{t("tabs.stock")}</TabsTrigger>
        </TabsList>

        <TabsContent value="receiving" className="mt-3 flex flex-col gap-2">
          {lines.map((line) => {
            const v = byLine.get(line.id);
            const complete = line.outstandingToReceive <= 0;
            return (
              <LineCard key={line.id} line={line}>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <Stat label={t("ordered")} value={line.orderedQuantity} unit={line.unit} />
                  <Stat label={t("received")} value={line.receivedQuantity} unit={line.unit} />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      complete
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                    )}
                  >
                    {complete
                      ? t("complete")
                      : t("outstanding", { quantity: format(line.outstandingToReceive) })}
                  </span>
                </div>
                <DocumentList
                  documents={v?.receipts ?? []}
                  empty={t("noReceipts")}
                  icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
                  locationPrefix="→"
                  when={when}
                  unit={line.unit}
                />
              </LineCard>
            );
          })}
        </TabsContent>

        <TabsContent value="stock" className="mt-3 flex flex-col gap-2">
          {lines.map((line) => {
            const v = byLine.get(line.id);
            return (
              <LineCard key={line.id} line={line}>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <Stat label={t("available")} value={line.availableForIssue} unit={line.unit} />
                  <Stat label={t("issued")} value={line.issuedQuantity} unit={line.unit} />
                </div>
                {v?.locationsError ? (
                  <p className="text-destructive text-xs">{t("locationsFailed")}</p>
                ) : (v?.locations.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("notInStock")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {v!.locations.map((loc) => (
                      <li
                        key={loc.locationId}
                        className="flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        <MapPin className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="font-medium">{loc.locationName ?? "—"}</span>
                        <span className="text-muted-foreground">
                          · {format(loc.quantity)} {line.unit ?? ""}
                        </span>
                        {loc.containerCodes.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px]"
                          >
                            <Package className="h-3 w-3" />
                            {code}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
                <DocumentList
                  documents={v?.issues ?? []}
                  empty={t("noIssues")}
                  icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
                  locationPrefix="←"
                  when={when}
                  unit={line.unit}
                />
              </LineCard>
            );
          })}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function LineCard({
  line,
  children,
}: {
  line: RepairOrderLineReadModel;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card text-card-foreground flex flex-col gap-2 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={line.productName}>
          {line.productName}
        </p>
        <p className="text-muted-foreground font-mono text-xs">{line.sku ?? "—"}</p>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string | null }) {
  return (
    <span>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-mono font-medium">{format(value)}</span>
      {unit ? <span className="text-muted-foreground"> {unit}</span> : null}
    </span>
  );
}

function DocumentList({
  documents,
  empty,
  icon,
  locationPrefix,
  when,
  unit,
}: {
  documents: RepairOrderWarehouseDocument[];
  empty: string;
  icon: React.ReactNode;
  locationPrefix: string;
  when: (iso: string | null) => string;
  unit: string | null;
}) {
  if (documents.length === 0) return <p className="text-muted-foreground text-xs">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1 border-t pt-2">
      {documents.map((doc, i) => (
        <li key={`${doc.movementId}-${i}`} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{icon}</span>
          <Link
            href={{
              pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
              params: { movementId: doc.movementId },
            }}
            className="font-mono font-medium underline-offset-2 hover:underline"
          >
            {doc.documentNumber ?? doc.documentTypeCode ?? "—"}
          </Link>
          <span className="text-muted-foreground">· {when(doc.date)}</span>
          <span className="font-mono">
            · {format(doc.quantity)} {unit ?? ""}
          </span>
          {doc.locationName && (
            <span className="text-muted-foreground">
              {locationPrefix} {doc.locationName}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString();
}
