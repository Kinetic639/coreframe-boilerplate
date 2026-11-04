"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PackagePlus } from "lucide-react";
import { DataView } from "@/components/data-view/data-view";
import { dataViewScope } from "@/lib/data-view/ambra-data-view-scope";
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
import type { DocumentUnit } from "@/server/services/warehouse-stock.service";

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type InventoryMovementsClientProps = {
  organizationId: string;
  initialData: PaginatedResult<InventoryMovementListRow>;
  activeBranchId: string | null;
  locations: LocationOption[];
  canOperate: boolean;
  /** Jednostki and magazyny of the branch, for the filters (U5) */
  units?: DocumentUnit[];
};

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryMovementsAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "unauthorized");
  return result.data;
}

async function detailFetcher(routeKey: string) {
  const result = await getInventoryMovementAction({ identifier: routeKey });
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
  organizationId,
  initialData,
  activeBranchId,
  locations,
  canOperate,
  units = [],
}: InventoryMovementsClientProps) {
  const t = useTranslations("warehouseInventory.movements");
  const td = useTranslations("warehouseInventory.movementDetail");
  const tc = useTranslations("warehouseInventory.common");

  const STATUS_KEYS: Record<string, string> = {
    draft: "statusDraft",
    posted: "statusPosted",
    reversed: "statusReversed",
    cancelled: "statusCancelled",
    in_transit: "statusInTransit",
    accepted: "statusAccepted",
    declined: "statusDeclined",
  };
  const tStatus = (s: string) => td((STATUS_KEYS[s] ?? s) as any);

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
          <Badge variant={statusVariant[row.status] ?? "outline"}>{tStatus(row.status)}</Badge>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "warehouse_code",
        header: t("warehouse"),
        accessor: (row) =>
          row.warehouse_code ? (
            <span className="font-mono text-xs" title={row.warehouse_name ?? undefined}>
              {row.warehouse_code}
              {row.unit_code ? (
                <span className="text-muted-foreground"> · {row.unit_code}</span>
              ) : null}
            </span>
          ) : (
            ""
          ),
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
    [t, tc, td]
  );

  const filters: DataViewFilterDef[] = [
    {
      type: "select",
      key: "movement_type_code",
      label: t("kind"),
      options: ["101", "102", "261", "303", "305", "401", "402", "801", "900"].map((value) => ({
        label: value,
        value,
      })),
    },
    ...(units.length > 0
      ? ([
          {
            type: "select",
            key: "unit_id",
            label: t("unit"),
            options: units.map((u) => ({
              label: `${u.code}${u.name ? ` ${u.name}` : ""}`,
              value: u.id,
            })),
          },
          {
            type: "select",
            key: "warehouse_id",
            label: t("warehouse"),
            options: units.flatMap((u) =>
              u.warehouses.map((w) => ({
                label: `${w.code}${w.name ? ` ${w.name}` : ""} (${u.code})`,
                value: w.id,
              }))
            ),
          },
        ] as DataViewFilterDef[])
      : []),
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
        label: tStatus(value),
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
        scope={dataViewScope.branch(organizationId, activeBranchId)}
        columns={columns}
        filters={filters}
        initialData={initialData}
        queryKey={["inventory-movements"]}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        getRowId={(row) => row.route_key}
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
