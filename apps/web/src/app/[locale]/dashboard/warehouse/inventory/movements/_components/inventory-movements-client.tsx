"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/lib/data-view/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InventoryMovementDetail,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";
import {
  getInventoryMovementAction,
  listInventoryMovementsAction,
  reverseMovementAction,
} from "@/app/actions/warehouse/inventory";

type InventoryMovementsClientProps = {
  initialData: PaginatedResult<InventoryMovementListRow>;
  canReverse: boolean;
};

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryMovementsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryMovementAction({ id });
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
  reversed: "outline",
  cancelled: "destructive",
};

export function InventoryMovementsClient({
  initialData,
  canReverse,
}: InventoryMovementsClientProps) {
  const t = useTranslations("warehouseInventory.movements");
  const tc = useTranslations("warehouseInventory.common");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const columns = useMemo<DataViewColumnDef<InventoryMovementListRow>[]>(
    () => [
      {
        key: "movement_number",
        header: t("movement"),
        accessor: (row) => <span className="font-medium">{row.movement_number}</span>,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "movement_kind",
        header: t("kind"),
        accessor: (row) =>
          row.adjustment_direction
            ? `${row.movement_kind} / ${row.adjustment_direction}`
            : row.movement_kind,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "status",
        header: tc("status"),
        accessor: (row) => (
          <Badge variant={statusVariant[row.status] ?? "outline"}>{row.status}</Badge>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "reference",
        header: t("reference"),
        accessor: (row) => row.reference ?? "",
        defaultVisible: true,
      },
      {
        key: "line_count",
        header: t("lines"),
        accessor: (row) => <span className="tabular-nums">{row.line_count}</span>,
        defaultVisible: true,
      },
      {
        key: "product_names",
        header: tc("products"),
        accessor: (row) => <span className="line-clamp-1">{row.product_names}</span>,
        defaultVisible: true,
      },
      {
        key: "posted_at",
        header: t("posted"),
        accessor: (row) =>
          row.posted_at ? (
            <span className="text-xs text-muted-foreground">
              {new Date(row.posted_at).toLocaleString()}
            </span>
          ) : (
            ""
          ),
        sortable: true,
        defaultVisible: true,
      },
    ],
    [t, tc]
  );

  const filters: DataViewFilterDef[] = [
    {
      type: "select",
      key: "movement_kind",
      label: t("kind"),
      options: ["receipt", "issue", "transfer", "adjustment", "opening_balance"].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      type: "select",
      key: "status",
      label: tc("status"),
      options: ["draft", "posted", "reversed", "cancelled"].map((value) => ({
        label: value,
        value,
      })),
    },
  ];

  const reverseMovement = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await reverseMovementAction({
        id: String(formData.get("movement_id") ?? ""),
        note: String(formData.get("note") ?? "") || null,
      });
      setMessage(
        result.success ? t("reversed") : "error" in result ? result.error : tc("unexpectedError")
      );
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {canReverse ? (
        <form
          action={reverseMovement}
          className="grid gap-2 border-b pb-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <Input name="movement_id" placeholder={t("movementId")} />
          <Input name="note" placeholder={t("reversalNote")} />
          <Button type="submit" variant="outline" disabled={isPending}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("reverse")}
          </Button>
        </form>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <DataView<InventoryMovementListRow, InventoryMovementDetail>
        entity="inventory-movements"
        columns={columns}
        filters={filters}
        initialData={initialData}
        queryKey={["inventory-movements"]}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        getRowId={(row) => row.id}
        renderDetail={(detail) => (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.movement_number}</h2>
              <p className="text-sm text-muted-foreground">{detail.movement_kind}</p>
            </div>
            <p className="text-sm">{detail.note ?? ""}</p>
            <div className="space-y-2">
              {detail.lines.map((line) => (
                <div key={line.id} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">
                    {line.sku} - {line.product_name}
                  </div>
                  <div className="text-muted-foreground">
                    {line.quantity} {line.unit_code}
                    {line.source_location_name
                      ? ` ${t("from", { location: line.source_location_name })}`
                      : ""}
                    {line.destination_location_name
                      ? ` ${t("to", { location: line.destination_location_name })}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
