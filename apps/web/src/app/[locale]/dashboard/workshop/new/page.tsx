import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { NewRepairOrderForm } from "./_components/new-repair-order-form";

/**
 * Phase 7 -- manual RepairOrder header creation. DEMO READY gate
 * requirement: RepairOrders must not depend exclusively on Matcher import.
 * Header/context only -- manual LINE entry remains PILOT scope (Phase 14).
 */
export default async function NewRepairOrderPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const snapshot = context.user.permissionSnapshot;
  const canManageOwn = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN);
  const canManageAll = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);
  if (!canManageOwn && !canManageAll) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "workshop_repair_orders_manage_required" },
      },
      locale,
    });
  }

  if (!context.app.activeBranchId) {
    return redirect({
      href: { pathname: "/dashboard/workshop", query: { noBranch: "1" } },
      locale,
    });
  }

  const t = await getTranslations("modules.workshop.repairOrders");
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const advisorCandidatesResult = canManageAll
    ? await RepairOrdersService.listAdvisorCandidates(supabase, orgId)
    : { success: true as const, data: [] };
  const advisorCandidates = advisorCandidatesResult.success ? advisorCandidatesResult.data : [];

  const ownAdvisorResult =
    canManageOwn && !canManageAll && context.user.user?.id
      ? await RepairOrdersService.getOwnAdvisorContactId(supabase, orgId)
      : { success: true as const, data: null };
  const ownAdvisorContactId = ownAdvisorResult.success ? ownAdvisorResult.data : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("newOrder.title")}</h1>
      <NewRepairOrderForm
        advisorCandidates={advisorCandidates}
        canManageAll={canManageAll}
        ownAdvisorContactId={ownAdvisorContactId}
      />
    </div>
  );
}
