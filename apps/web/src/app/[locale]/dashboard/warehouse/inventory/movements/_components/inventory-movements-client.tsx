"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PackagePlus } from "lucide-react";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/lib/data-view/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type {
  InventoryMovementDetail,
  InventoryMovementListRow,
} from "@/lib/warehouse/inventory-types";
import {
  getInventoryMovementAction,
  listInventoryMovementsAction,
} from "@/app/actions/warehouse/inventory";
import { InventoryMovementDetailPanel } from "./inventory-movement-detail-panel";

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type InventoryMovementsClientProps = {
  initialData: PaginatedResult<InventoryMovementListRow>;
  activeBranchId: string | null;
  locations: LocationOption[];
  canOperate: boolean;
};

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryMovementsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryMovementAction({ id: id.replace("branch-transfer:", "") });
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
  reversed: "outline",
  cancelled: "destructive",
  in_transit: "outline",
  accepted: "default",
  declined: "destructive",
};

export function InventoryMovementsClient({
  initialData,
  activeBranchId,
  locations,
  canOperate,
}: InventoryMovementsClientProps) {
  const t = useTranslations("warehouseInventory.movements");
  const tc = useTranslations("warehouseInventory.common");

  const columns = useMemo<DataViewColumnDef<InventoryMovementListRow>[]>(
    () => [
      {
        key: "document_number",
        header: t("movement"),
        accessor: (row) => (
          <span className="font-medium">{row.document_number ?? row.draft_number}</span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "movement_type_name",
        header: t("kind"),
        accessor: (row) => row.movement_type_name,
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
        key: "external_reference",
        header: t("reference"),
        accessor: (row) => row.external_reference ?? "",
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
      key: "movement_type_code",
      label: t("kind"),
      options: ["101", "201", "301", "401", "801"].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      type: "select",
      key: "status",
      label: tc("status"),
      options: [
        "draft",
        "posted",
        "reversed",
        "cancelled",
        "in_transit",
        "accepted",
        "declined",
      ].map((value) => ({
        label: value,
        value,
      })),
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/dashboard/warehouse/inventory/movements/new">
            <PackagePlus className="mr-2 h-4 w-4" />
            {t("newMovement")}
          </Link>
        </Button>
      </div>
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
          <InventoryMovementDetailPanel
            detail={detail}
            activeBranchId={activeBranchId}
            locations={locations}
            canOperate={canOperate}
          />
        )}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
