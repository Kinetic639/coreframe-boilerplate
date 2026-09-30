"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Boxes } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { WAREHOUSE_INVENTORY_OPERATE } from "@repo/contracts/permissions";
import {
  useRepairOrderLineReservationsQuery,
  useRepairOrderLineAllocationsQuery,
  useAllocateRepairOrderLineMutation,
  usePlaceAllocationInContainerMutation,
} from "@/hooks/queries/workshop";

export type LineContainerOption = { id: string; code: string };

type Props = {
  repairOrderLineId: string;
  branchId: string | null;
  containers: LineContainerOption[];
};

/**
 * Phase 10D: the minimal path from a reserved part to a part inside one of
 * the RepairOrder's containers -- "Przydziel" (allocate a reservation line)
 * then "Dodaj do kontenera" (place an allocation line into a container).
 * Same compact popover shape as the line's reservation affordance; nothing
 * is fetched until opened (no N+1 across lines).
 *
 * Quantities default to what is still outstanding and remain editable. The
 * server (allocate / place RPCs) is the real boundary for ownership and
 * quantity conservation; controls are hidden without
 * `warehouse.inventory.operate` as client convenience only.
 */
export function RepairOrderLineContainer({ repairOrderLineId, branchId, containers }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.lines.container");
  const router = useRouter();
  const { can } = usePermissions();
  const canOperate = can(WAREHOUSE_INVENTORY_OPERATE);

  const [open, setOpen] = useState(false);
  const [placingAllocationId, setPlacingAllocationId] = useState<string | null>(null);
  const [containerId, setContainerId] = useState("");
  const [quantity, setQuantity] = useState("");

  const reservationsQuery = useRepairOrderLineReservationsQuery(repairOrderLineId, open, branchId);
  const allocationsQuery = useRepairOrderLineAllocationsQuery(repairOrderLineId, open, branchId);
  const allocateMutation = useAllocateRepairOrderLineMutation(repairOrderLineId, branchId);
  const placeMutation = usePlaceAllocationInContainerMutation(repairOrderLineId, branchId, () => {
    setPlacingAllocationId(null);
    setContainerId("");
    setQuantity("");
    router.refresh();
  });

  const isLoading = reservationsQuery.isLoading || allocationsQuery.isLoading;
  const isError = reservationsQuery.isError || allocationsQuery.isError;

  const reservationLines = (reservationsQuery.data ?? [])
    .flatMap((r) => r.lines)
    .filter((line) => line.outstandingQuantity > 0);
  const allocationLines = (allocationsQuery.data ?? []).filter(
    (line) => line.outstandingQuantity > 0
  );

  function handleAllocate(reservationLineId: string, outstanding: number) {
    allocateMutation.mutate({ repairOrderLineId, reservationLineId, quantity: outstanding });
  }

  function startPlacing(allocationLineId: string, outstanding: number) {
    setPlacingAllocationId(allocationLineId);
    setQuantity(String(outstanding));
    setContainerId(containers.length === 1 ? containers[0].id : "");
  }

  function handlePlace() {
    const parsed = Number(quantity);
    if (!placingAllocationId || !containerId || !parsed || parsed <= 0) return;
    placeMutation.mutate({
      repairOrderLineId,
      allocationLineId: placingAllocationId,
      containerId,
      quantity: parsed,
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-2"
          data-testid="repair-order-line-container-trigger"
        >
          <Boxes className="h-3 w-3" />
          {t("trigger")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="start"
        data-testid="repair-order-line-container-popover"
      >
        <p className="mb-2 text-xs font-medium">{t("popoverTitle")}</p>

        {isError ? (
          <p className="text-destructive flex items-center gap-1 text-xs">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {t("errorState")}
          </p>
        ) : isLoading ? (
          <p className="text-muted-foreground text-xs">{t("loading")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reservationLines.length === 0 && allocationLines.length === 0 && (
              <p
                className="text-muted-foreground text-xs"
                data-testid="repair-order-line-container-empty"
              >
                {t("noReservation")}
              </p>
            )}

            {reservationLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between gap-2 text-xs"
                data-testid="repair-order-line-container-reservation"
              >
                <span>{t("reservedToAllocate", { quantity: line.outstandingQuantity })}</span>
                {canOperate && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={allocateMutation.isPending}
                    onClick={() => handleAllocate(line.id, line.outstandingQuantity)}
                    data-testid="repair-order-line-container-allocate"
                  >
                    {t("allocate")}
                  </Button>
                )}
              </div>
            ))}

            {allocationLines.map((line) => (
              <div
                key={line.id}
                className="border-border flex flex-col gap-2 border-t pt-2 text-xs first:border-t-0 first:pt-0"
                data-testid="repair-order-line-container-allocation"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-mono">{line.allocationNumber}</span> ·{" "}
                    {t("allocated", { quantity: line.outstandingQuantity })}
                  </span>
                  {canOperate && placingAllocationId !== line.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={containers.length === 0}
                      onClick={() => startPlacing(line.id, line.outstandingQuantity)}
                      data-testid="repair-order-line-container-start-place"
                    >
                      {t("addToContainer")}
                    </Button>
                  )}
                </div>

                {placingAllocationId === line.id && (
                  <div className="flex flex-col gap-2">
                    <Select value={containerId} onValueChange={setContainerId}>
                      <SelectTrigger data-testid="repair-order-line-container-select">
                        <SelectValue placeholder={t("containerPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {containers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      placeholder={t("quantityPlaceholder")}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      data-testid="repair-order-line-container-quantity"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handlePlace}
                        disabled={placeMutation.isPending || !containerId || !quantity}
                        data-testid="repair-order-line-container-submit"
                      >
                        {t("confirmAdd")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlacingAllocationId(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {allocationLines.length > 0 && containers.length === 0 && (
              <p className="text-muted-foreground text-xs">{t("noContainers")}</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
