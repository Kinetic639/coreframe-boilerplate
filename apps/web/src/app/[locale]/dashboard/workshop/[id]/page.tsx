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
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { ArrowLeft } from "lucide-react";
import { RepairOrderStatusBadge } from "../_components/repair-order-status-badge";
import { RepairOrderHeaderEditor } from "./_components/repair-order-header-editor";

type PageProps = { params: Promise<{ id: string }> };

/**
 * Phase 7 -- the real RepairOrder header/detail view: editable business
 * fields, advisor display + reassignment (manage_all), lifecycle actions
 * (open/closed/archived), identity status. Deliberately still NOT lines,
 * source-document provenance, or warehouse detail -- those remain later
 * phases (8/9/10/11), per the work order's explicit scope boundary.
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

  const snapshot = context.user.permissionSnapshot;
  const canManageOwn = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN);
  const canManageAll = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);

  const [orderResult, advisorCandidatesResult, ownAdvisorResult] = await Promise.all([
    RepairOrdersService.getByIdForWorkshop(supabase, orgId, branchId, id),
    canManageAll
      ? RepairOrdersService.listAdvisorCandidates(supabase, orgId)
      : Promise.resolve({ success: true as const, data: [] }),
    canManageOwn && !canManageAll && context.user.user?.id
      ? RepairOrdersService.getOwnAdvisorContactId(supabase, orgId)
      : Promise.resolve({ success: true as const, data: null }),
  ]);

  if (!orderResult.success || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const advisorCandidates = advisorCandidatesResult.success ? advisorCandidatesResult.data : [];
  const ownAdvisorContactId = ownAdvisorResult.success ? ownAdvisorResult.data : null;

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

      <RepairOrderHeaderEditor
        order={order}
        advisorCandidates={advisorCandidates}
        canManageOwn={canManageOwn}
        canManageAll={canManageAll}
        ownAdvisorContactId={ownAdvisorContactId}
        createdAtLabel={new Date(order.createdAt).toLocaleString(locale)}
        updatedAtLabel={new Date(order.updatedAt).toLocaleString(locale)}
      />

      <p className="text-muted-foreground max-w-2xl text-xs">{t("detail.futurePhasesNote")}</p>
    </div>
  );
}
