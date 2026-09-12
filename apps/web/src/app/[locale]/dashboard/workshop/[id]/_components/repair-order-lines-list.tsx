import { getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type {
  RepairOrderLineReadModel,
  RepairOrderProvenanceDocument,
} from "@/server/services/repair-orders.service";
import { groupProvenanceByRepairOrderLine } from "@/server/services/repair-orders.service";
import { LineSourcesPopover, type LineSourceEntry } from "./repair-order-line-sources";

type Props = {
  lines: RepairOrderLineReadModel[];
  /**
   * True when `RepairOrdersService.listRepairOrderLines` itself failed
   * (a genuine query error, already normalized server-side -- never the
   * raw DB error) -- distinct from a successful read that simply found
   * zero lines. Collapsing these two states into the same empty-state UI
   * would be factually misleading (an order that could not be checked
   * would look identical to a real, confirmed-empty order). Deliberately
   * does NOT fail the whole RepairOrder detail page for this -- the header
   * above may have loaded successfully even when this one section's own
   * read did not, so only this section degrades.
   */
  loadError?: boolean;
  /**
   * Phase 9: the SAME provenance tree `RepairOrderProvenance` (the
   * "Source documents" section) already renders -- passed down here too,
   * purely to compute each line's own "Sources (N)" affordance
   * server-side via `groupProvenanceByRepairOrderLine` (a pure re-index,
   * not a second query -- see that function's own doc comment). Optional
   * and defaults to an empty tree so this component still works
   * standalone (e.g. in tests) without Phase 9 data. Omitted entirely
   * (no prop, no query) when the provenance read itself failed -- a
   * missing "Sources" affordance is a silent, harmless degradation, not
   * something that needs its own error state layered onto Phase 8's list.
   */
  provenance?: RepairOrderProvenanceDocument[];
};

/**
 * Phase 8: the logical RepairOrderLine list -- durable business lines, NOT
 * grouped by source document (that is Phase 9's own provenance concern).
 * Pure read-only display (no editing/receiving/issuing UI -- Phase 10 owns
 * wiring real movement lines); a plain server component, matching this
 * page's own existing convention of fetching detail data server-side
 * (RepairOrderHeaderEditor is the one client component on this page, and
 * only because it needs interactivity for editing/lifecycle actions -- this
 * list needs none of that for Phase 8).
 *
 * Deliberately does NOT render a source-document column (would blur the
 * logical-line/provenance boundary the architecture doc draws between
 * Phase 8 and Phase 9) and does NOT render the real `status` column value
 * as a status indicator (every currently-materialized line reads 'pending'
 * -- see RepairOrderLineReadModel's own doc comment for why rendering it
 * would misrepresent the line's true state; the numeric received/
 * outstanding/available columns are this phase's truthful signal instead).
 */
export async function RepairOrderLinesList({ lines, loadError = false, provenance = [] }: Props) {
  const t = await getTranslations("modules.workshop.repairOrders.lines");

  function sourcesFor(lineId: string): LineSourceEntry[] {
    return groupProvenanceByRepairOrderLine(provenance, lineId).map(
      ({ document, sourceLine, contribution }) => ({
        documentType: document.documentType,
        externalDocumentNumber: document.externalDocumentNumber,
        sourceLineProductCode: sourceLine.productCode,
        sourceLineProductName: sourceLine.productName,
        quantityContribution: contribution.quantityContribution,
      })
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="repair-order-lines-section">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
      </div>

      {loadError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm"
          data-testid="repair-order-lines-error-state"
        >
          {t("errors.loadFailed")}
        </div>
      ) : lines.length === 0 ? (
        <div
          className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center"
          data-testid="repair-order-lines-empty-state"
        >
          <PackageSearch className="text-muted-foreground h-8 w-8" />
          <div>
            <p className="text-sm font-medium">{t("emptyStateTitle")}</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">{t("emptyStateSubtitle")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.sku")}</TableHead>
                  <TableHead>{t("columns.description")}</TableHead>
                  <TableHead className="text-right">{t("columns.ordered")}</TableHead>
                  <TableHead className="text-right">{t("columns.received")}</TableHead>
                  <TableHead className="text-right">{t("columns.outstanding")}</TableHead>
                  <TableHead className="text-right">{t("columns.available")}</TableHead>
                  <TableHead>{t("columns.unit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id} data-testid="repair-order-line-row">
                    <TableCell className="font-mono text-xs font-medium">
                      {line.sku ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      <div className="truncate" title={line.productName}>
                        {line.productName}
                      </div>
                      <LineSourcesPopover sources={sourcesFor(line.id)} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.orderedQuantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.receivedQuantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.outstandingToReceive)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQuantity(line.availableForIssue)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {line.unit ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards -- compact stacked records, not a squeezed table. */}
          <div className="flex flex-col gap-2 md:hidden">
            {lines.map((line) => (
              <div
                key={line.id}
                className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-3"
                data-testid="repair-order-line-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={line.productName}>
                      {line.productName}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">{line.sku ?? "—"}</p>
                    <LineSourcesPopover sources={sourcesFor(line.id)} />
                  </div>
                  {line.unit && (
                    <span className="text-muted-foreground shrink-0 text-xs">{line.unit}</span>
                  )}
                </div>
                <div className="text-muted-foreground grid grid-cols-4 gap-x-2 gap-y-0.5 text-[11px]">
                  <span>{t("columns.ordered")}</span>
                  <span>{t("columns.received")}</span>
                  <span>{t("columns.outstanding")}</span>
                  <span>{t("columns.available")}</span>
                  <span className="text-foreground font-mono text-sm">
                    {formatQuantity(line.orderedQuantity)}
                  </span>
                  <span className="text-foreground font-mono text-sm">
                    {formatQuantity(line.receivedQuantity)}
                  </span>
                  <span className="text-foreground font-mono text-sm">
                    {formatQuantity(line.outstandingToReceive)}
                  </span>
                  <span className="text-foreground font-mono text-sm">
                    {formatQuantity(line.availableForIssue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Quantities are Postgres NUMERIC, returned as plain JS numbers by
 * PostgREST (matching every other quantity field already handled this way
 * elsewhere in this service, e.g. ordered_quantity itself) -- no decimal
 * library needed for pcs-scale workshop-parts quantities. Trims a trailing
 * ".0" for whole numbers (the common case) without hiding genuine
 * fractional quantities. */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString();
}
