"use client";

import { useState, useTransition } from "react";
import { Archive, Download, X } from "lucide-react";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { archiveInventoryProductsAction } from "@/app/actions/warehouse/inventory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { InventoryProductListRow } from "@/lib/warehouse/inventory-types";
import { invalidateInventoryProducts } from "./inventory-product-query";

const BOM = String.fromCharCode(0xfeff);

/** A CSV cell: quoted when it has to be, quotes doubled. */
function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The ticked rows as a CSV of the columns shown (semicolons, a BOM: Excel in
 * Polish opens it as it is). Built from the rows on screen: no request.
 */
export function rowsToCsv(
  rows: InventoryProductListRow[],
  columns: { id: string; label: string }[],
  value: (row: InventoryProductListRow, id: string) => unknown
) {
  const head = columns.map((column) => csvCell(column.label)).join(";");
  const body = rows.map((row) => columns.map((column) => csvCell(value(row, column.id))).join(";"));
  return BOM + [head, ...body].join("\r\n");
}

/**
 * Over the list while rows are ticked: how many, and what can be done to all
 * of them at once (export, archive), or untick them.
 */
export function ProductsBulkBar({
  rows,
  csv,
  canArchive,
  labels,
  onClear,
}: {
  rows: InventoryProductListRow[];
  /** The ticked rows as CSV (the columns shown). */
  csv: () => string;
  canArchive: boolean;
  labels: Record<string, string>;
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const productIds = [...new Set(rows.map((row) => row.id))];

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csv()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `produkty-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const archive = () =>
    startTransition(async () => {
      const result = await archiveInventoryProductsAction({ ids: productIds });
      setConfirm(false);
      if (!result.success || !("data" in result)) {
        toast.error("error" in result ? result.error : labels.loadError);
        return;
      }
      const { archived, failed } = result.data;
      if (archived) toast.success(`${labels.bulkArchived}: ${archived}`);
      if (failed.length) toast.error(`${labels.bulkArchiveFailed}: ${failed.length}`);
      onClear();
      await invalidateInventoryProducts(queryClient);
    });

  return (
    <div
      role="toolbar"
      aria-label={labels.bulkActions}
      className="flex h-10 shrink-0 items-center gap-2 border-b bg-primary/5 px-3 text-xs"
    >
      <strong className="font-medium tabular-nums">
        {labels.bulkSelected}: {rows.length}
      </strong>
      <Button size="sm" variant="outline" className="h-7" onClick={exportCsv}>
        <Download className="mr-1.5 size-3.5" />
        {labels.bulkExport}
      </Button>
      {canArchive ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => setConfirm(true)}
        >
          <Archive className="mr-1.5 size-3.5" />
          {labels.bulkArchive}
        </Button>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
        {labels.bulkClear}
      </button>
      <AlertDialog open={confirm} onOpenChange={(open) => !pending && setConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {labels.bulkArchiveTitle} ({productIds.length})
            </AlertDialogTitle>
            <AlertDialogDescription>{labels.bulkArchiveHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                archive();
              }}
            >
              {labels.bulkArchive}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
