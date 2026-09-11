import { notFound } from "next/navigation";
import { redirect, Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WORKSHOP_REPAIR_ORDERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { ArrowLeft } from "lucide-react";
import { RepairOrderStatusBadge } from "../_components/repair-order-status-badge";

type PageProps = { params: Promise<{ id: string }> };

/**
 * Phase 6 -- minimal real RepairOrder detail shell ("option A" from the
 * work order): identifier/context only, no lines/provenance/lifecycle
 * editing/advisor picker. Deliberately not Phase 7's full header view --
 * this exists only so a Workshop list row has somewhere real to open to
 * before Phase 7 builds the real detail experience.
 */
export default async function RepairOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
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

  const result = await RepairOrdersService.getByIdForWorkshop(supabase, orgId, branchId, id);
  if (!result.success || !result.data) {
    notFound();
  }

  const order = result.data;

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
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {order.zlNumber ?? t("detail.unresolvedTitle")}
        </h1>
        <RepairOrderStatusBadge status={order.status} />
      </div>

      <div
        className="bg-card text-card-foreground border-border grid max-w-2xl grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-5 sm:grid-cols-2"
        data-testid="repair-order-detail-card"
      >
        <Field label={t("columns.zlNumber")} value={order.zlNumber} mono />
        <Field label={t("columns.orderNumber")} value={order.orderNumber} mono />
        <Field label={t("columns.vin")} value={order.vin} mono />
        <Field
          label={t("detail.identityStatus")}
          value={t(`identityStatus.${order.identityStatus}`)}
        />
        <Field label={t("columns.advisor")} value={order.advisorDisplayName} />
        <Field
          label={t("columns.created")}
          value={new Date(order.createdAt).toLocaleString(locale)}
        />
        <Field
          label={t("detail.updated")}
          value={new Date(order.updatedAt).toLocaleString(locale)}
        />
      </div>

      <p className="text-muted-foreground max-w-2xl text-xs">{t("detail.futurePhasesNote")}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value ?? "—"}</span>
    </div>
  );
}
