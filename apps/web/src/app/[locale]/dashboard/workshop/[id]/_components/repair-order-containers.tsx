"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Boxes, Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { WAREHOUSE_INVENTORY_OPERATE } from "@repo/contracts/permissions";
import { useCreateRepairOrderContainerMutation } from "@/hooks/queries/workshop";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import type { RepairOrderContainerSummary } from "@/server/services/inventory-containers.service";

type Props = {
  repairOrderId: string;
  branchId: string | null;
  containers: RepairOrderContainerSummary[];
  loadError?: boolean;
  suggestedCode: string;
};

/**
 * Phase 10D: the RepairOrder's own containers (product decision A: a
 * RepairOrder's parts live in its containers). Lists them and offers a
 * minimal "create container" form (code + starting location). Parts are
 * placed into a container from each line's own container affordance.
 *
 * Create is hidden (not just disabled) without `warehouse.inventory.operate`
 * -- client convenience only; the create action/RPC re-check it server-side.
 */
export function RepairOrderContainers({
  repairOrderId,
  branchId,
  containers,
  loadError = false,
  suggestedCode,
}: Props) {
  const t = useTranslations("modules.workshop.repairOrders.containers");
  const tStatus = useTranslations("modules.warehouse.containers.status");
  const router = useRouter();
  const { can } = usePermissions();
  const canOperate = can(WAREHOUSE_INVENTORY_OPERATE);

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState(suggestedCode);
  const [locationId, setLocationId] = useState("");

  const locationsQuery = useWarehouseLocationsQuery(showForm ? branchId : null);
  const createMutation = useCreateRepairOrderContainerMutation(() => {
    setShowForm(false);
    setLocationId("");
    router.refresh();
  });

  function handleCreate() {
    if (!code.trim() || !locationId) return;
    createMutation.mutate({ repairOrderId, code: code.trim(), currentLocationId: locationId });
  }

  function statusLabel(status: string) {
    return tStatus.has(status) ? tStatus(status) : status;
  }

  function locationLabel(container: RepairOrderContainerSummary) {
    const loc = container.currentLocation;
    if (!loc) return "—";
    return loc.code ? `${loc.code} · ${loc.name}` : loc.name;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="repair-order-containers-section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
        </div>
        {canOperate && !showForm && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCode(suggestedCode);
              setShowForm(true);
            }}
            data-testid="repair-order-container-open-form"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("create")}
          </Button>
        )}
      </div>

      {showForm && (
        <div
          className="bg-card border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end"
          data-testid="repair-order-container-form"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="container-code">{t("codeLabel")}</Label>
            <Input
              id="container-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={80}
              className="font-mono"
              data-testid="repair-order-container-code"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>{t("locationLabel")}</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger data-testid="repair-order-container-location">
                <SelectValue placeholder={t("locationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {(locationsQuery.data ?? [])
                  .filter((loc) => loc.can_store_inventory !== false && loc.purpose !== "receiving")
                  .map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code ? `${loc.code} · ${loc.name}` : loc.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending || !code.trim() || !locationId}
              data-testid="repair-order-container-submit"
            >
              {createMutation.isPending ? t("creating") : t("confirmCreate")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {loadError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm"
          data-testid="repair-order-containers-error"
        >
          {t("loadError")}
        </div>
      ) : containers.length === 0 ? (
        <div
          className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center"
          data-testid="repair-order-containers-empty"
        >
          <Boxes className="text-muted-foreground h-7 w-7" />
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.code")}</TableHead>
                  <TableHead>{t("columns.location")}</TableHead>
                  <TableHead>{t("columns.contents")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container) => (
                  <TableRow key={container.id} data-testid="repair-order-container-row">
                    <TableCell className="font-mono text-xs font-medium">
                      {container.code}
                    </TableCell>
                    <TableCell className="text-sm">{locationLabel(container)}</TableCell>
                    <TableCell className="text-sm">
                      {t("contentsSummary", { lines: container.lineCount })}
                    </TableCell>
                    <TableCell className="text-sm">{statusLabel(container.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={{
                            pathname: "/dashboard/warehouse/containers/[id]",
                            params: { id: container.id },
                          }}
                        >
                          {t("open")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {containers.map((container) => (
              <Link
                key={container.id}
                href={{
                  pathname: "/dashboard/warehouse/containers/[id]",
                  params: { id: container.id },
                }}
                className="bg-card text-card-foreground border-border flex items-center justify-between gap-2 rounded-lg border p-3"
                data-testid="repair-order-container-card"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{container.code}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {locationLabel(container)}
                  </p>
                </div>
                <div className="text-muted-foreground shrink-0 text-right text-xs">
                  <p>{t("contentsSummary", { lines: container.lineCount })}</p>
                  <p>{statusLabel(container.status)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
