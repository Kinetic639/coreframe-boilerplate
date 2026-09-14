"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Unlock, AlertTriangle } from "lucide-react";
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
  useReserveRepairOrderLineMutation,
  useReleaseRepairOrderLineReservationMutation,
} from "@/hooks/queries/workshop";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";

type Props = {
  repairOrderLineId: string;
  branchId: string | null;
};

/**
 * Phase 10A: the minimal, line-level reservation affordance -- NOT the full
 * Magazyn UI (that remains Phase 11+), not a reservation management center,
 * not an allocation/container UI. Deliberately mirrors `LineSourcesPopover`
 * (Phase 9)'s own compact "small trigger + popover" shape, matching this
 * page's existing convention rather than introducing a new UI pattern.
 *
 * Nothing is fetched until the popover is opened (`enabled: open` on the
 * reservations query) -- no N+1 query per line on initial page load.
 * Locations are fetched via the EXISTING `useWarehouseLocationsQuery`
 * (Warehouse module's own hook, reused as-is -- no new location-listing
 * infrastructure built for this phase).
 *
 * The Reserve/Release controls are hidden entirely (not merely disabled)
 * for a viewer lacking `warehouse.inventory.operate` -- client-side
 * convenience only; `RepairOrdersService.reserveForLine`/
 * `releaseReservationForLine`'s own server-side check (via their actions)
 * remains the real authorization boundary, matching this repo's own
 * "layered security" convention (CLAUDE.md).
 *
 * Phase 10A correction (2026-09-14, external review): the reservations
 * query is lazy (`enabled: open`), so before the popover has ever been
 * opened `query.data` is `undefined` -- collapsing that to `data ?? []`
 * (the original implementation) rendered "No reservation" for a line that
 * genuinely HAS a reservation but whose lazy query simply hasn't run yet,
 * and likewise collapsed a genuine query ERROR into the same empty-state
 * copy. Both are now derived from react-query's own status flags via
 * `deriveReservationViewState`, distinguishing five true states: never
 * fetched (neutral trigger wording, never "No reservation"), loading,
 * error (local to this popover, generic message, never raw server text,
 * never rendered as "No reservation" either), success+empty ("No
 * reservation"), success+outstanding ("Reserved N"). Lazy loading itself
 * is unchanged -- still zero eager fetches, still no N+1 across lines.
 */
type ReservationViewState = "never-fetched" | "loading" | "error" | "empty" | "populated";

function deriveReservationViewState(
  query: { isLoading: boolean; isError: boolean; isSuccess: boolean },
  activeCount: number
): ReservationViewState {
  if (query.isError) return "error";
  if (query.isLoading) return "loading";
  if (query.isSuccess) return activeCount > 0 ? "populated" : "empty";
  // Not loading, not errored, not yet successful -- enabled is false
  // (popover never opened) or the query has not started yet.
  return "never-fetched";
}

export function RepairOrderLineReservation({ repairOrderLineId, branchId }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.lines.reservation");
  const { can } = usePermissions();
  const canOperate = can(WAREHOUSE_INVENTORY_OPERATE);

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [locationId, setLocationId] = useState("");

  const reservationsQuery = useRepairOrderLineReservationsQuery(repairOrderLineId, open, branchId);
  const locationsQuery = useWarehouseLocationsQuery(branchId);
  const reserveMutation = useReserveRepairOrderLineMutation(repairOrderLineId, branchId);
  const releaseMutation = useReleaseRepairOrderLineReservationMutation(repairOrderLineId, branchId);

  const reservations = reservationsQuery.data ?? [];
  // Only reservations with something still outstanding are shown as
  // "active" in this compact view -- a fully released/fulfilled
  // reservation has nothing left for this affordance to act on. Only
  // meaningful once the query has genuinely succeeded (see viewState
  // below) -- an empty `reservations` array before the query has ever run
  // is NOT evidence of "no reservation".
  const activeReservations = reservations.filter((r) => r.outstandingQuantity > 0);
  const totalOutstanding = activeReservations.reduce((sum, r) => sum + r.outstandingQuantity, 0);
  const viewState = deriveReservationViewState(reservationsQuery, activeReservations.length);

  function handleReserve() {
    const parsedQuantity = Number(quantity);
    if (!parsedQuantity || parsedQuantity <= 0 || !locationId) return;
    reserveMutation.mutate(
      { repairOrderLineId, locationId, quantity: parsedQuantity },
      {
        onSuccess: () => {
          setShowForm(false);
          setQuantity("");
          setLocationId("");
        },
      }
    );
  }

  function handleRelease(reservationId: string) {
    releaseMutation.mutate({ repairOrderLineId, reservationId });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline decoration-dotted underline-offset-2"
          data-testid="repair-order-line-reservation-trigger"
        >
          <Lock className="h-3 w-3" />
          {viewState === "populated"
            ? t("badgeReserved", { quantity: totalOutstanding })
            : viewState === "empty"
              ? t("badgeNone")
              : t("badgeUnknown")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="start"
        data-testid="repair-order-line-reservation-popover"
      >
        <p className="mb-2 text-xs font-medium">{t("popoverTitle")}</p>

        {viewState === "error" ? (
          <p
            className="text-destructive flex items-center gap-1 text-xs"
            data-testid="repair-order-line-reservation-error"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {t("errorState")}
          </p>
        ) : viewState === "loading" || viewState === "never-fetched" ? (
          <p
            className="text-muted-foreground text-xs"
            data-testid="repair-order-line-reservation-loading"
          >
            {t("loading")}
          </p>
        ) : viewState === "empty" ? (
          <p
            className="text-muted-foreground text-xs"
            data-testid="repair-order-line-reservation-empty"
          >
            {t("emptyState")}
          </p>
        ) : (
          <ul className="mb-2 flex flex-col gap-2">
            {activeReservations.map((r) => (
              <li
                key={r.id}
                className="border-border flex items-center justify-between gap-2 border-t pt-2 text-xs first:border-t-0 first:pt-0"
                data-testid="repair-order-line-reservation-row"
              >
                <div>
                  <div className="font-mono font-medium">{r.reservationNumber}</div>
                  <div className="text-muted-foreground">
                    {t("outstandingLabel", { quantity: r.outstandingQuantity })}
                  </div>
                </div>
                {canOperate && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRelease(r.id)}
                    disabled={releaseMutation.isPending}
                    data-testid="repair-order-line-reservation-release"
                  >
                    <Unlock className="mr-1 h-3 w-3" />
                    {t("release")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canOperate &&
          (showForm ? (
            <div className="flex flex-col gap-2 border-t pt-2">
              <Input
                type="number"
                min={1}
                placeholder={t("quantityPlaceholder")}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="repair-order-line-reservation-quantity"
              />
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger data-testid="repair-order-line-reservation-location">
                  <SelectValue placeholder={t("locationPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(locationsQuery.data ?? []).map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleReserve}
                  disabled={reserveMutation.isPending || !quantity || !locationId}
                  data-testid="repair-order-line-reservation-submit"
                >
                  {t("confirmReserve")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setShowForm(true)}
              data-testid="repair-order-line-reservation-open-form"
            >
              {t("reserve")}
            </Button>
          ))}
      </PopoverContent>
    </Popover>
  );
}
