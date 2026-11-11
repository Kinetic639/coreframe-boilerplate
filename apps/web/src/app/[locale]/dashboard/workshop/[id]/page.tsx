import { notFound } from "next/navigation";
import { redirect, Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  WAREHOUSE_INVENTORY_OPERATE as WAREHOUSE_INVENTORY_OPERATE_PERMISSION,
  WAREHOUSE_INVENTORY_READ,
} from "@/lib/constants/permissions";
import { InventoryReservationsService } from "@/server/services/inventory-reservations.service";
import { RepairOrderPositions } from "./_components/repair-order-positions";
import {
  RepairOrderStockHistory,
  stockDocumentsOf,
} from "./_components/repair-order-stock-history";
import { RepairOrderWarehouseOrders } from "./_components/repair-order-warehouse-orders";
import { NewInternalOrderButton } from "./_components/new-internal-order";
import { InternalOrdersService } from "@/server/services/internal-orders.service";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { ArrowLeft } from "lucide-react";
import { RepairOrderStatusBadge } from "../_components/repair-order-status-badge";
import { RepairOrderHeaderEditor } from "./_components/repair-order-header-editor";
import { RepairOrderProvenance } from "./_components/repair-order-provenance";
import { RepairOrderContainers } from "./_components/repair-order-containers";
import { RepairOrderIssue } from "./_components/repair-order-issue";
import { InventoryContainersService } from "@/server/services/inventory-containers.service";
import { AttachmentsPanel } from "@/components/features/attachments";
import { BranchWarehousesService } from "@/server/services/branch-warehouses.service";
import { ObjectRelationsService } from "@/server/services/object-relations.service";
import { RepairOrderRelations } from "./_components/repair-order-relations";
import { RepairOrderTabs } from "./_components/repair-order-tabs";
import {
  isLegacyRepairOrderWarehouseTab,
  isRepairOrderTab,
  type RepairOrderTab,
} from "./_components/repair-order-tab-ids";

type PageProps = {
  params: Promise<{ id: string }>;
  /**
   * `?tab=` opens a tab of the page: overview (default), lines, warehouse, documents,
   * related. `?tab=stock` / `?tab=receiving` (links from the global search) open the
   * warehouse tab on that inner view.
   */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Phase 7 -- the real RepairOrder header/detail view: editable business
 * fields, advisor display + reassignment (manage_all), lifecycle actions
 * (open/closed/archived), identity status.
 *
 * Phase 8 adds the logical RepairOrderLine list below the header (durable
 * business lines -- SKU/part/ordered/received/outstanding/available --
 * never grouped by source document).
 *
 * Phase 9 adds the "Source documents" provenance section below that --
 * which document(s)/source line(s) this order was materialized from, and
 * (via each Phase 8 line's own "Sources (N)" affordance) which source
 * line(s) contributed to which logical line. Full warehouse receipt/issue
 * detail and the final Magazyn/Zamówienia-Przyjęcia sub-view composition
 * remain later phases (10/11), per the work order's explicit scope
 * boundary.
 */
export default async function RepairOrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const tabParam = (searchParams ? await searchParams : {}).tab;
  // ?tab=stock / ?tab=receiving (global search): the per-part state is on "Pozycje".
  const initialTab: RepairOrderTab = isLegacyRepairOrderWarehouseTab(tabParam)
    ? "lines"
    : isRepairOrderTab(tabParam)
      ? tabParam
      : "overview";
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, WORKSHOP_REPAIR_ORDERS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "workshop_repair_orders_read_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.workshop.repairOrders");
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const branchId = context.app.activeBranchId ?? null;

  const snapshot = context.user.permissionSnapshot;
  const canManageOwn = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN);
  const canManageAll = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);

  const [
    orderResult,
    advisorCandidatesResult,
    ownAdvisorResult,
    linesResult,
    provenanceResult,
    containersResult,
    warehouseResult,
    branchWarehousesResult,
  ] = await Promise.all([
    RepairOrdersService.getByIdForWorkshop(supabase, orgId, branchId, id),
    canManageAll
      ? RepairOrdersService.listAdvisorCandidates(supabase, orgId)
      : Promise.resolve({ success: true as const, data: [] }),
    canManageOwn && !canManageAll && context.user.user?.id
      ? RepairOrdersService.getOwnAdvisorContactId(supabase, orgId)
      : Promise.resolve({ success: true as const, data: null }),
    RepairOrdersService.listRepairOrderLines(supabase, orgId, branchId, id),
    RepairOrdersService.getRepairOrderProvenance(supabase, orgId, branchId, id),
    // Phase 10D: RLS (warehouse.inventory.read) is the real visibility
    // boundary -- a viewer without it simply sees no containers.
    InventoryContainersService.listForRepairOrder(supabase, orgId, branchId, id),
    // Phase 11: PZ / RW documents and current locations per line
    RepairOrdersService.getWarehouseView(supabase, orgId, branchId, id),
    BranchWarehousesService.list(supabase, orgId, branchId),
  ]);

  if (!orderResult.success || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  // Tickets raised for this order and every place it is mentioned with "@"
  const relationsResult = await ObjectRelationsService.listForRepairOrder(supabase, orgId, {
    id: order.id,
    zlNumber: order.zlNumber,
    orderNo: order.orderNo,
    warehouseCode: order.warehouseCode,
  });
  const relations = relationsResult.success ? relationsResult.data : [];
  const advisorCandidates = advisorCandidatesResult.success ? advisorCandidatesResult.data : [];
  const ownAdvisorContactId = ownAdvisorResult.success ? ownAdvisorResult.data : null;
  // A failed lines read must NOT look like a genuinely empty order, and
  // must NOT fail the whole page -- the header above loaded fine either
  // way. Only this boolean crosses into the UI; the already-normalized
  // (never raw) error string stays server-side, matching the Workshop list
  // page's own established loadError convention.
  const lines = linesResult.success ? linesResult.data : [];
  const linesLoadError = !linesResult.success;
  // Same pattern as linesLoadError above -- a failed provenance read must
  // not look like a manually-created order with genuinely zero provenance,
  // and must not fail the rest of the page either.
  const provenance = provenanceResult.success ? provenanceResult.data : [];
  const provenanceLoadError = !provenanceResult.success;
  const containers = containersResult.success ? containersResult.data : [];
  const warehouseLabel =
    (branchWarehousesResult.success ? branchWarehousesResult.data : []).find(
      (w) => w.code === order.warehouseCode
    )?.name ?? null;
  const containersLoadError = !containersResult.success;
  // Stages E6/E7: reservations (R), history and what can be reserved, per line.
  const canReadStock = checkPermission(snapshot, WAREHOUSE_INVENTORY_READ);
  const canOperateStock = checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE_PERMISSION);
  const lineIds = lines.map((l) => l.id);
  const lineVariantIds = [
    ...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v)),
  ];
  const [reservationsResult, historyResult, availableResult] =
    canReadStock && branchId && lineIds.length > 0
      ? await Promise.all([
          InventoryReservationsService.listActiveDetailed(supabase, orgId, branchId, {
            repairOrderLineIds: lineIds,
          }),
          InventoryReservationsService.listHistoryDetailed(supabase, orgId, branchId, {
            repairOrderLineIds: lineIds,
          }),
          InventoryReservationsService.listAvailableStock(
            supabase,
            orgId,
            branchId,
            lineVariantIds
          ),
        ])
      : [null, null, null];
  // Internal orders (ZW) of the order: the "Zamówienia" half and the source of each position.
  const internalOrdersResult =
    canReadStock && branchId
      ? await InternalOrdersService.list(supabase, orgId, branchId, { repairOrderId: order.id })
      : null;
  const internalOrders = internalOrdersResult?.success ? internalOrdersResult.data : [];
  const ordersByLine: Record<
    string,
    { orders: Array<{ id: string; number: string }>; ordered: boolean; cancelled: boolean }
  > = {};
  for (const io of internalOrders) {
    for (const l of io.lines) {
      if (!l.repairOrderLineId) continue;
      const entry = (ordersByLine[l.repairOrderLineId] ??= {
        orders: [],
        ordered: false,
        cancelled: true,
      });
      if (!entry.orders.some((o) => o.id === io.id))
        entry.orders.push({ id: io.id, number: io.number });
      if (l.ordered && !l.cancelledAt) entry.ordered = true;
      if (!l.cancelledAt) entry.cancelled = false;
    }
  }
  const reservations = reservationsResult?.success ? reservationsResult.data : [];
  const history = historyResult?.success ? historyResult.data : [];
  const availableStock = availableResult?.success ? availableResult.data : [];
  const warehouseView = warehouseResult.success ? warehouseResult.data : [];
  const issuedByLine = Object.fromEntries(
    warehouseView.map((v) => [
      v.repairOrderLineId,
      v.issues.filter((d) => d.status === "posted").reduce((sum, d) => sum + d.quantity, 0),
    ])
  );
  const historyLocationIds = [
    ...new Set(
      history.flatMap((e) => [e.locationId, e.toLocationId]).filter((id): id is string => !!id)
    ),
  ];
  const { data: historyLocations } = historyLocationIds.length
    ? await supabase
        .from("warehouse_locations")
        .select("id, code, name")
        .in("id", historyLocationIds)
    : { data: [] };
  const locationNames = Object.fromEntries(
    (
      (historyLocations ?? []) as Array<{ id: string; code: string | null; name: string | null }>
    ).map((l) => [l.id, l.code ?? l.name ?? "—"])
  );
  const lineInfo = lines.map((l) => ({ id: l.id, sku: l.sku, productName: l.productName }));

  const suggestedContainerCode = InventoryContainersService.suggestCode(
    order.zlNumber,
    containers.map((c) => c.code)
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/dashboard/workshop"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {order.orderNo ?? order.zlNumber ?? t("detail.unresolvedTitle")}
          </h1>
          {order.warehouseCode && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              <span className="font-mono">{order.zlNumber}</span> · {t("columns.warehouse")}{" "}
              <span className="text-foreground font-mono font-medium">{order.warehouseCode}</span>
              {warehouseLabel ? ` · ${warehouseLabel}` : ""}
            </p>
          )}
        </div>
        <RepairOrderStatusBadge status={order.status} />
      </div>

      <RepairOrderTabs
        label={t("tabs.label")}
        initialTab={initialTab}
        tabs={[
          {
            id: "overview",
            label: t("tabs.overview"),
            content: (
              <RepairOrderHeaderEditor
                order={order}
                advisorCandidates={advisorCandidates}
                canManageOwn={canManageOwn}
                canManageAll={canManageAll}
                ownAdvisorContactId={ownAdvisorContactId}
                createdAtLabel={new Date(order.createdAt).toLocaleString(locale)}
                updatedAtLabel={new Date(order.updatedAt).toLocaleString(locale)}
              />
            ),
          },
          {
            id: "lines",
            label: t("tabs.lines"),
            count: lines.length,
            content: (
              <div className="grid gap-4">
                <RepairOrderIssue
                  repairOrderId={order.id}
                  zlNumber={order.zlNumber}
                  canOperate={canOperateStock}
                />
                <RepairOrderPositions
                  repairOrderId={order.id}
                  lines={lines.map((l) => ({
                    id: l.id,
                    variantId: l.variantId,
                    sku: l.sku,
                    productName: l.productName,
                    orderedQuantity: l.orderedQuantity,
                    unit: l.unit,
                  }))}
                  issuedByLine={issuedByLine}
                  reservations={reservations}
                  available={availableStock}
                  canOperate={canOperateStock && order.status === "open"}
                  loadError={linesLoadError}
                  stockLoadError={
                    (!!reservationsResult && !reservationsResult.success) ||
                    !warehouseResult.success
                  }
                  ordersByLine={ordersByLine}
                />
              </div>
            ),
          },
          {
            id: "warehouse",
            label: t("tabs.warehouse"),
            count: internalOrders.length,
            content: (
              <RepairOrderWarehouseOrders
                documents={stockDocumentsOf(lineInfo, warehouseView, history)}
                orders={internalOrders}
                locale={locale}
                ordersLoadError={!!internalOrdersResult && !internalOrdersResult.success}
                orderActions={
                  canOperateStock && order.status === "open" ? (
                    <NewInternalOrderButton
                      repairOrderId={order.id}
                      lines={lines.map((l) => ({
                        id: l.id,
                        variantId: l.variantId,
                        sku: l.sku,
                        productName: l.productName,
                      }))}
                    />
                  ) : null
                }
              />
            ),
          },
          {
            id: "containers",
            label: t("tabs.containers"),
            count: containers.length,
            content: (
              <RepairOrderContainers
                repairOrderId={order.id}
                branchId={branchId}
                containers={containers}
                loadError={containersLoadError}
                suggestedCode={suggestedContainerCode}
              />
            ),
          },
          {
            id: "history",
            label: t("tabs.history"),
            count: history.length,
            content: (
              <RepairOrderStockHistory
                lines={lineInfo}
                events={history}
                locationNames={locationNames}
                locale={locale}
              />
            ),
          },
          {
            id: "documents",
            label: t("tabs.documents"),
            count: provenance.length,
            content: (
              <>
                <RepairOrderProvenance documents={provenance} loadError={provenanceLoadError} />
                {/* Phase 12: signed delivery documents, photos (generic attachments, target workshop.repair_order) */}
                <section className="rounded-lg border p-4">
                  <AttachmentsPanel
                    targetType="workshop.repair_order"
                    targetId={order.id}
                    canUpload={order.status !== "archived"}
                    canDelete={canManageAll}
                  />
                </section>
              </>
            ),
          },
          {
            id: "related",
            label: t("tabs.related"),
            count: relations.length,
            content: (
              <RepairOrderRelations items={relations} loadError={!relationsResult.success} />
            ),
          },
        ]}
      />

      <p className="text-muted-foreground max-w-2xl text-xs">{t("detail.futurePhasesNote")}</p>
    </div>
  );
}
