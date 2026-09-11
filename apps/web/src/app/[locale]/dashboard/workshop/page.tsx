import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WORKSHOP_REPAIR_ORDERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { RepairOrdersService } from "@/server/services/repair-orders.service";
import { Wrench, FileSearch, ChevronRight } from "lucide-react";
import { RepairOrdersSearch } from "./_components/repair-orders-search";
import { RepairOrderStatusBadge } from "./_components/repair-order-status-badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/**
 * Phase 6 -- Workshop / RepairOrder list + search.
 *
 * Replaces the previous "coming soon" feature-card placeholder. Real,
 * persisted, branch/org-scoped RepairOrder data only -- no mocks, no
 * fixtures. Server component + URL search params, per the architecture
 * choice sanctioned for this phase (no new client-fetching paradigm).
 */
export default async function WorkshopOverviewPage({ searchParams }: PageProps = {}) {
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
  const resolvedParams = searchParams ? await searchParams : {};
  const query = firstValue(resolvedParams.q).trim();

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const branchId = context.app.activeBranchId ?? null;

  const listResult = await RepairOrdersService.listForWorkshop(
    supabase,
    orgId,
    branchId,
    query || null
  );
  const rows = listResult.success ? listResult.data : [];
  // Cast needed: apps/web's tsconfig strictNullChecks setup does not narrow
  // ServiceResult<T> from `listResult.success ? ... : ...` alone (known
  // repo-wide quirk -- see repair-orders.service.ts's own callers).
  const loadError = listResult.success
    ? null
    : (listResult as { success: false; error: string }).error;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wrench className="text-muted-foreground h-6 w-6" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <RepairOrdersSearch initialQuery={query} />
      </div>

      {loadError ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-6 text-sm">
          {t("errors.loadFailed")}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.zlNumber")}</TableHead>
                  <TableHead>{t("columns.orderNumber")}</TableHead>
                  <TableHead>{t("columns.vin")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.advisor")}</TableHead>
                  <TableHead>{t("columns.created")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid="repair-order-row">
                    <TableCell className="font-mono text-xs font-medium">
                      {row.zlNumber ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.orderNumber ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.vin ?? "—"}</TableCell>
                    <TableCell>
                      <RepairOrderStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-sm">{row.advisorDisplayName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(row.createdAt).toLocaleDateString(locale)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={{ pathname: "/dashboard/workshop/[id]", params: { id: row.id } }}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center"
                        aria-label={t("openRepairOrder")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={{ pathname: "/dashboard/workshop/[id]", params: { id: row.id } }}
                className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-4"
                data-testid="repair-order-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{row.zlNumber ?? "—"}</span>
                  <RepairOrderStatusBadge status={row.status} />
                </div>
                <div className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span>{t("columns.orderNumber")}</span>
                  <span className="text-foreground font-mono">{row.orderNumber ?? "—"}</span>
                  <span>{t("columns.vin")}</span>
                  <span className="text-foreground font-mono break-all">{row.vin ?? "—"}</span>
                  <span>{t("columns.advisor")}</span>
                  <span className="text-foreground">{row.advisorDisplayName ?? "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  const t = await getTranslations("modules.workshop.repairOrders");
  return (
    <div
      className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center"
      data-testid="repair-orders-empty-state"
    >
      <FileSearch className="text-muted-foreground h-10 w-10" />
      <div>
        <p className="text-sm font-medium">
          {hasQuery ? t("emptyState.noResultsTitle") : t("emptyState.title")}
        </p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {hasQuery ? t("emptyState.noResultsSubtitle") : t("emptyState.subtitle")}
        </p>
      </div>
    </div>
  );
}
