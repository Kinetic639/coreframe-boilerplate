import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import { NewStandaloneInternalOrderButton } from "./_components/new-standalone-internal-order";
import { BranchWarehousesService } from "@/server/services/branch-warehouses.service";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  InternalOrdersService,
  type InternalOrderListFilter,
} from "@/server/services/internal-orders.service";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const KINDS = ["all", "repair_order", "standalone"] as const;
type Kind = (typeof KINDS)[number];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Internal orders (ZW) of the active branch: under repair orders or on their
 * own (ordered by another branch). One row per Ambra ZW, with its AutoStacja
 * number and what of it is here, reserved, issued.
 */
export default async function InternalOrdersPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_inventory_read_required" },
      },
      locale,
    });
  }
  const t = await getTranslations("modules.warehouse.internalOrders");
  const branchId = context.app.activeBranchId;
  if (!branchId) return <p className="text-muted-foreground p-6 text-sm">{t("noBranch")}</p>;

  const params = searchParams ? await searchParams : {};
  const kindParam = one(params.kind);
  const kind: Kind = KINDS.includes(kindParam as Kind) ? (kindParam as Kind) : "all";
  const search = one(params.q)?.trim() ?? "";
  const filter: InternalOrderListFilter = { search: search || undefined };
  if (kind !== "all") filter.kind = kind;

  const supabase = await createClient();
  const result = await InternalOrdersService.list(
    supabase,
    context.app.activeOrgId,
    branchId,
    filter
  );
  const orders = result.success ? result.data : [];
  const warehousesResult = await BranchWarehousesService.list(
    supabase,
    context.app.activeOrgId,
    branchId
  );
  const warehouses = (warehousesResult.success ? warehousesResult.data : []).map((w) => ({
    code: w.code,
    name: w.name ?? null,
  }));

  return (
    <div
      className="mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6"
      data-testid="internal-orders-page"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        {checkPermission(context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE) && (
          <NewStandaloneInternalOrderButton warehouses={warehouses} />
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" action="">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Link
              key={k}
              href={{
                pathname: "/dashboard/warehouse/internal-orders",
                query: { ...(k === "all" ? {} : { kind: k }), ...(search ? { q: search } : {}) },
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                kind === k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground"
              )}
              data-testid={`internal-orders-kind-${k}`}
            >
              {t(`kinds.${k}`)}
            </Link>
          ))}
        </div>
        {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
        <Input
          name="q"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-full sm:w-72"
        />
        <Button type="submit" size="sm" variant="outline" className="h-9">
          {t("search")}
        </Button>
      </form>

      {!result.success ? (
        <p className="text-destructive text-sm">{t("loadError")}</p>
      ) : orders.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="internal-orders-empty">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 pl-3 font-medium">{t("columns.order")}</th>
                <th className="py-2 pr-3 font-medium">{t("columns.external")}</th>
                <th className="py-2 pr-3 font-medium">{t("columns.for")}</th>
                <th className="py-2 pr-3 font-medium">{t("columns.created")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("columns.lines")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("columns.reserved")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("columns.issued")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const reserved = o.lines.reduce((sum, l) => sum + l.reservedQuantity, 0);
                const issued = o.lines.reduce((sum, l) => sum + l.issuedQuantity, 0);
                return (
                  <tr
                    key={o.id}
                    className="border-b last:border-b-0"
                    data-testid="internal-order-row"
                  >
                    <td className="py-2 pr-3 pl-3">
                      <Link
                        href={{
                          pathname: "/dashboard/warehouse/internal-orders/[id]",
                          params: { id: o.id },
                        }}
                        className="text-primary font-mono hover:underline"
                      >
                        {o.number}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{o.externalNumber ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {o.repairOrderId ? (
                        <Link
                          href={{
                            pathname: "/dashboard/workshop/[id]",
                            params: { id: o.repairOrderId },
                          }}
                          className="text-primary font-mono text-xs hover:underline"
                        >
                          {o.repairOrderZl ?? t("repairOrder")}
                        </Link>
                      ) : o.destinationCode ? (
                        <Badge variant="secondary">
                          {t("forBranch", { branch: o.destinationCode })}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {o.externalZlNumber ?? "—"}
                        </span>
                      )}
                      {o.clientName && (
                        <p className="text-muted-foreground truncate text-xs">{o.clientName}</p>
                      )}
                    </td>
                    <td className="text-muted-foreground py-2 pr-3 text-xs">
                      {new Date(o.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{o.lines.length}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{reserved}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{issued}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
