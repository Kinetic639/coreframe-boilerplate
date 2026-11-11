import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { InternalOrderLinesTable } from "@/components/warehouse/internal-order-lines";
import {
  InternalOrderOperationsService,
  InternalOrdersService,
} from "@/server/services/internal-orders.service";
import { InternalOrderActions } from "../_components/internal-order-actions";

type PageProps = { params: Promise<{ id: string }> };

/** One internal order (ZW): who it is for, its lines with Z / R / W / A, its deliveries. */
export default async function InternalOrderPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
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
  const t = await getTranslations("modules.warehouse.internalOrders");
  const supabase = await createClient();
  const result = await InternalOrdersService.get(supabase, context.app.activeOrgId, id);
  if (!result.success) {
    return <p className="text-destructive p-6 text-sm">{t("loadError")}</p>;
  }
  const order = result.data;
  if (!order) notFound();
  const branchesResult = order.repairOrderId
    ? null
    : await InternalOrderOperationsService.listBranches(supabase, context.app.activeOrgId);
  const otherBranches = (branchesResult?.success ? branchesResult.data : []).filter(
    (b) => b.id !== context.app.activeBranchId
  );

  const receipts = new Map<
    string,
    { number: string | null; postedAt: string | null; quantity: number }
  >();
  for (const r of order.receipts) {
    const entry = receipts.get(r.movementId) ?? {
      number: r.documentNumber,
      postedAt: r.postedAt,
      quantity: 0,
    };
    entry.quantity += r.quantity;
    receipts.set(r.movementId, entry);
  }

  return (
    <div
      className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-6"
      data-testid="internal-order-page"
    >
      <Link
        href="/dashboard/warehouse/internal-orders"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.number}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {order.externalNumber
              ? t("externalNumber", { number: order.externalNumber })
              : t("noExternalNumber")}
            {" · "}
            {t(`sources.${order.source}`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.destinationCode && (
            <Badge variant="secondary">{t("forBranch", { branch: order.destinationCode })}</Badge>
          )}
          <Badge variant="outline">{t(`statuses.${order.status}`)}</Badge>
        </div>
      </div>

      <dl className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">{t("columns.for")}</dt>
          <dd>
            {order.repairOrderId ? (
              <Link
                href={{ pathname: "/dashboard/workshop/[id]", params: { id: order.repairOrderId } }}
                className="text-primary font-mono hover:underline"
              >
                {order.repairOrderZl ?? t("repairOrder")}
              </Link>
            ) : order.destinationCode ? (
              t("forBranch", { branch: order.destinationCode })
            ) : (
              (order.externalZlNumber ?? "—")
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t("client")}</dt>
          <dd>{order.clientName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t("columns.created")}</dt>
          <dd>{new Date(order.createdAt).toLocaleString(locale)}</dd>
        </div>
      </dl>

      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("linesTitle")}</h2>
          <InternalOrderActions
            order={order}
            canOperate={checkPermission(snapshot, WAREHOUSE_INVENTORY_OPERATE)}
            branches={otherBranches}
          />
        </div>
        {order.source === "matcher" && (
          <p className="text-muted-foreground text-xs">{t("deliveryOnlyHint")}</p>
        )}
        <div className="overflow-x-auto rounded-md border">
          <InternalOrderLinesTable order={order} />
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold">{t("receiptsTitle")}</h2>
        {receipts.size === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noReceipts")}</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm" data-testid="internal-order-receipts">
            {[...receipts.entries()].map(([movementId, r]) => (
              <li key={movementId} className="flex items-center justify-between gap-3 px-3 py-2">
                <Link
                  href={{
                    pathname: "/dashboard/warehouse/inventory/movements/[movementId]",
                    params: { movementId },
                  }}
                  className="text-primary font-mono hover:underline"
                >
                  {r.number ?? "—"}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {r.postedAt ? new Date(r.postedAt).toLocaleString(locale) : "—"}
                </span>
                <span className="tabular-nums">{r.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
