import { notFound } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Boxes, MapPin, Wrench } from "lucide-react";
import { redirect, Link } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  QR_ASSIGN,
  QR_EXPORT,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { InventoryContainersService } from "@/server/services/inventory-containers.service";
import { QrAssignmentsService } from "@/server/services/qr.service";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContainerQrCard } from "./_components/container-qr-card";
import { ContainerCrossBranchPrompt } from "./_components/container-cross-branch-prompt";

type PageProps = { params: Promise<{ id: string }> };

/**
 * Phase 10D -- the container detail screen, the target of a container QR
 * scan (`inventory.container` registry entry). Mobile-first: it is usually
 * opened from a phone scan on the warehouse floor.
 *
 * Visibility: `warehouse.inventory.read` on the container's own branch (RLS
 * on `inventory_containers`/`_lines`). A container in another branch that the
 * caller can read is never rendered under the current branch -- the caller
 * gets a confirm-then-switch prompt instead (same contract as the location
 * QR flow). Anything the caller cannot read is a plain 404.
 */
export default async function ContainerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }
  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  const snapshot = context.user.permissionSnapshot;
  if (!checkPermission(snapshot, WAREHOUSE_INVENTORY_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_read_required" },
      },
      locale,
    });
  }

  const t = await getTranslations("modules.warehouse.containers");
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const detailResult = await InventoryContainersService.getDetail(supabase, orgId, id);
  if (!detailResult.success || !detailResult.data) {
    notFound();
  }
  const container = detailResult.data;

  const activeBranchId = context.app.activeBranchId ?? null;
  if (activeBranchId && container.branchId !== activeBranchId) {
    const targetBranch = context.app.availableBranches.find((b) => b.id === container.branchId);
    if (!targetBranch) notFound();
    return (
      <ContainerCrossBranchPrompt
        containerCode={container.code}
        targetBranchId={container.branchId}
        targetBranchName={targetBranch.name}
      />
    );
  }

  const assignmentResult = await QrAssignmentsService.getActiveForTarget(
    supabase,
    "inventory.container",
    container.id
  );
  const qrCodeId = assignmentResult.success ? (assignmentResult.data?.qr_code_id ?? null) : null;

  const canAssignQr =
    checkPermission(snapshot, QR_ASSIGN) && checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE);
  const canPrintQr = checkPermission(snapshot, QR_EXPORT);

  const statusLabel = t.has(`status.${container.status}`)
    ? t(`status.${container.status}`)
    : container.status;
  const location = container.currentLocation;
  const repairOrder = container.repairOrder;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6" data-testid="container-detail">
      {repairOrder ? (
        <Link
          href={{ pathname: "/dashboard/workshop/[id]", params: { id: repairOrder.id } }}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      ) : (
        <Link
          href="/dashboard/warehouse/locations"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToWarehouse")}
        </Link>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="text-muted-foreground h-6 w-6" />
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">{t("title")}</p>
            <h1
              className="font-mono text-2xl font-semibold tracking-tight"
              data-testid="container-code"
            >
              {container.code}
            </h1>
          </div>
        </div>
        <Badge variant="outline" data-testid="container-status">
          {statusLabel}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-card border-border flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Wrench className="text-muted-foreground h-4 w-4" />
            <h2 className="text-sm font-semibold">{t("repairOrder")}</h2>
          </div>
          {repairOrder ? (
            <dl
              className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"
              data-testid="container-repair-order"
            >
              <dt className="text-muted-foreground">ZL</dt>
              <dd>
                <Link
                  href={{ pathname: "/dashboard/workshop/[id]", params: { id: repairOrder.id } }}
                  className="font-mono font-medium underline-offset-2 hover:underline"
                >
                  {repairOrder.zlNumber ?? "—"}
                </Link>
              </dd>
              <dt className="text-muted-foreground">{t("client")}</dt>
              <dd>{repairOrder.clientName ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("vehicle")}</dt>
              <dd>{repairOrder.vehicleBrand ?? "—"}</dd>
              <dt className="text-muted-foreground">{t("vin")}</dt>
              <dd className="font-mono text-xs">{repairOrder.vin ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noRepairOrder")}</p>
          )}
        </div>

        <div className="bg-card border-border flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground h-4 w-4" />
            <h2 className="text-sm font-semibold">{t("location")}</h2>
          </div>
          {location ? (
            <Link
              href={{
                pathname: "/dashboard/warehouse/locations",
                query: { selected: location.id, view: "tree" },
              }}
              className="text-sm underline-offset-2 hover:underline"
              data-testid="container-location"
            >
              {location.code ? (
                <>
                  <span className="font-mono font-medium">{location.code}</span> · {location.name}
                </>
              ) : (
                location.name
              )}
            </Link>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noLocation")}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{t("contents")}</h2>
        {container.lines.length === 0 ? (
          <div
            className="border-border text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm"
            data-testid="container-contents-empty"
          >
            {t("contentsEmpty")}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.sku")}</TableHead>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead className="text-right">{t("columns.quantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {container.lines.map((line) => (
                    <TableRow key={line.id} data-testid="container-line-row">
                      <TableCell className="font-mono text-xs font-medium">
                        {line.sku ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{line.productName ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatQuantity(line.quantity)} {line.unitCode ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-2 md:hidden">
              {container.lines.map((line) => (
                <div
                  key={line.id}
                  className="bg-card border-border flex items-start justify-between gap-2 rounded-lg border p-3"
                  data-testid="container-line-card"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.productName ?? "—"}</p>
                    <p className="text-muted-foreground font-mono text-xs">{line.sku ?? "—"}</p>
                  </div>
                  <p className="shrink-0 font-mono text-sm">
                    {formatQuantity(line.quantity)} {line.unitCode ?? ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ContainerQrCard
        containerId={container.id}
        containerCode={container.code}
        qrCodeId={qrCodeId}
        canAssign={canAssignQr}
        canPrint={canPrintQr}
      />
    </div>
  );
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString();
}
