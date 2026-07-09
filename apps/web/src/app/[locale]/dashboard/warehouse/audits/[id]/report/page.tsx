import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_AUDITS_READ } from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { enrichCountLines } from "../../_lib/enrich-count-lines.server";
import { enrichReorderReportRows } from "../../../_lib/enrich-reorder-report.server";
import { FinalReportScreen } from "./_components/final-report";
import type { AdjustmentLine, FinalReportSessionInfo } from "./_components/final-report/types";
import type { CountSessionScope } from "@/lib/warehouse/count-session-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditFinalReportPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_AUDITS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_audits_read" } },
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
    branch_id: string;
    created_at: string;
    updated_at: string;
    approved_at: string | null;
  };
  const lines = detailResult.data.lines;

  if (session.status === "draft" || session.status === "counting") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/count", params: { id } },
      locale,
    });
  }
  if (session.status === "submitted") {
    return redirect({
      href: { pathname: "/dashboard/warehouse/audits/[id]/review", params: { id } },
      locale,
    });
  }

  const enrichedLines = await enrichCountLines(supabase, lines);
  const scope = session.scope as CountSessionScope;
  const branchId = session.branch_id;

  const [adjustments, reorderResult] = await Promise.all([
    loadAdjustments(supabase, session.id),
    InventoryCountSessionsService.getReorderReport(supabase, context.app.activeOrgId, branchId),
  ]);

  const variantIdsInScope = new Set(lines.map((l) => l.variant_id));
  const reorderRowsAll = reorderResult.success
    ? await enrichReorderReportRows(supabase, context.app.activeOrgId, branchId, reorderResult.data)
    : [];
  const reorderRows = reorderRowsAll.filter((r) => variantIdsInScope.has(r.variant_id));

  const branchName = context.app.availableBranches.find((b) => b.id === branchId)?.name ?? null;

  let supplierName: string | null = null;
  if (scope.count_type === "supplier" && scope.supplier_id) {
    const { data: supplier } = await supabase
      .from("inventory_suppliers")
      .select("name")
      .eq("id", scope.supplier_id)
      .maybeSingle();
    supplierName = (supplier as { name: string } | null)?.name ?? null;
  }

  const sessionInfo: FinalReportSessionInfo = {
    id: session.id,
    count_number: session.count_number,
    status: session.status,
    scope,
    created_at: session.created_at,
    updated_at: session.updated_at,
    approved_at: session.approved_at,
  };

  return (
    <FinalReportScreen
      session={sessionInfo}
      lines={enrichedLines}
      adjustments={adjustments}
      reorderRows={reorderRows}
      branchId={branchId}
      branchName={branchName}
      supplierName={supplierName}
    />
  );
}

/**
 * inventory_create_draft_movement stamps reference_type='inventory_count',
 * reference_id=<session id> on any movement header it creates from
 * approveCountSession's increase/decrease branches — this is the only
 * documented link between the audit and the movements it posted.
 */
async function loadAdjustments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<AdjustmentLine[]> {
  const { data: headers } = await supabase
    .from("inventory_movement_headers")
    .select("id, movement_number")
    .eq("reference_type", "inventory_count")
    .eq("reference_id", sessionId);

  const headerRows = (headers ?? []) as { id: string; movement_number: string }[];
  if (headerRows.length === 0) return [];
  const headerById = new Map(headerRows.map((h) => [h.id, h]));

  const { data: lines } = await supabase
    .from("inventory_movement_lines")
    .select(
      "id, movement_id, variant_id, quantity, source_location_id, destination_location_id, note"
    )
    .in(
      "movement_id",
      headerRows.map((h) => h.id)
    );

  const lineRows = (lines ?? []) as {
    id: string;
    movement_id: string;
    variant_id: string;
    quantity: number;
    source_location_id: string | null;
    destination_location_id: string | null;
    note: string | null;
  }[];
  if (lineRows.length === 0) return [];

  const variantIds = [...new Set(lineRows.map((l) => l.variant_id))];
  const { data: variants } = await supabase
    .from("inventory_variants")
    .select("id, product_id, sku, name")
    .in("id", variantIds);
  const variantRows = (variants ?? []) as {
    id: string;
    product_id: string;
    sku: string;
    name: string | null;
  }[];
  const productIds = [...new Set(variantRows.map((v) => v.product_id))];
  const { data: products } = productIds.length
    ? await supabase
        .from("inventory_products")
        .select("id, name, base_unit_id")
        .in("id", productIds)
    : { data: [] };
  const productRows = (products ?? []) as {
    id: string;
    name: string;
    base_unit_id: string | null;
  }[];
  const unitIds = [
    ...new Set(productRows.map((p) => p.base_unit_id).filter((v): v is string => !!v)),
  ];
  const { data: units } = unitIds.length
    ? await supabase.from("inventory_units").select("id, code").in("id", unitIds)
    : { data: [] };

  const variantsById = new Map(variantRows.map((v) => [v.id, v]));
  const productsById = new Map(productRows.map((p) => [p.id, p]));
  const unitsById = new Map(
    ((units ?? []) as { id: string; code: string }[]).map((u) => [u.id, u])
  );

  return lineRows.map((line) => {
    const header = headerById.get(line.movement_id);
    const variant = variantsById.get(line.variant_id);
    const product = variant ? productsById.get(variant.product_id) : undefined;
    const unit = product?.base_unit_id ? unitsById.get(product.base_unit_id) : undefined;

    return {
      id: line.id,
      movement_number: header?.movement_number ?? "—",
      variant_id: line.variant_id,
      sku: variant?.sku ?? "—",
      productName: product?.name ?? variant?.name ?? "—",
      unitCode: unit?.code ?? "",
      quantity: line.quantity,
      direction: line.destination_location_id ? "increase" : "decrease",
      reasonCode: line.note,
    };
  });
}
