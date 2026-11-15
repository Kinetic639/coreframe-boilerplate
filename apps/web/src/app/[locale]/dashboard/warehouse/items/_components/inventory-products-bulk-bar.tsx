"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
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
import { ListBulkBar } from "@/components/data-table/bulk-bar";
import { downloadCsv, rowsToCsv } from "@/components/data-table/csv";
import type { InventoryProductListRow } from "@/lib/warehouse/inventory-types";
import { invalidateInventoryProducts } from "./inventory-product-query";

export { rowsToCsv };

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

  const exportCsv = () => downloadCsv(csv(), "produkty");

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
    <ListBulkBar count={rows.length} labels={labels} onClear={onClear} onExport={exportCsv}>
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
    </ListBulkBar>
  );
}
