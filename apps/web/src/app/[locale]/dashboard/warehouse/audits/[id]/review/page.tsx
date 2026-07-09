import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_MANAGE } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { enrichCountLines } from "../../_lib/enrich-count-lines.server";
import { VarianceReviewScreen } from "./_components/variance-review";
import type { ReviewSessionInfo } from "./_components/variance-review/types";
import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VarianceReviewPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_MANAGE)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_manage" } },
      locale,
    });
  }

  const supabase = await createClient();
  const detailResult = await InventoryCountSessionsService.getSessionDetail(supabase, id);

  if (!detailResult.success) {
    return redirect({ href: "/dashboard/warehouse/audits", locale });
  }

  const session = detailResult.data.session as {
    id: string;
    count_number: string;
    status: string;
    scope: unknown;
  };
  const lines = detailResult.data.lines;

  if (session.status === "draft" || session.status === "counting") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/count", params: { id } },
      locale,
    });
  }
  if (session.status === "approved" || session.status === "cancelled") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/report", params: { id } },
      locale,
    });
  }

  const enrichedLines = await enrichCountLines(supabase, lines);

  const sessionInfo: ReviewSessionInfo = {
    id: session.id,
    count_number: session.count_number,
    status: session.status,
    scope: session.scope as CountSessionScope,
  };

  return <VarianceReviewScreen session={sessionInfo} lines={enrichedLines} />;
}
