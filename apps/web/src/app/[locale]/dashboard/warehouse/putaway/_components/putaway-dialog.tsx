"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Camera, MapPin } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import { putawayFromReceivingAction } from "@/app/actions/warehouse/receiving";
import { QrCameraScanner, type QrScanLookup } from "@/components/features/qr/qr-camera-scanner";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";

type Props = {
  item: ReceivingPendingItem;
  branchId: string;
  receivingLocationId: string | null;
  onClose: () => void;
};

function locationLabel(loc: { code: string | null; name: string | null }) {
  if (loc.code && loc.name) return `${loc.code} · ${loc.name}`;
  return loc.code ?? loc.name ?? "—";
}

/** Where the scanner/suggestion should point first, if anywhere. */
function suggestedLocationId(item: ReceivingPendingItem): string | null {
  if (item.handlingMode === "bulk") return item.defaultLocation?.id ?? null;
  if (item.repairOrderLineId) return item.container?.locationId ?? null;
  return item.defaultLocation?.id ?? null;
}

/**
 * Zone 5 putaway of one receiving-zone item: scan the location sticker (or
 * take the suggestion, or pick from the list), adjust the quantity if only
 * part is put away, confirm. The server decides the outcome: RO part into
 * the RO's container there (or a new one), bulk material reserved at its
 * bin, free stock loose.
 */
export function PutawayDialog({ item, branchId, receivingLocationId, onClose }: Props) {
  const t = useTranslations("modules.warehouse.putaway.dialog");
  const tErr = useTranslations("modules.warehouse.putaway.errors");
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [destinationId, setDestinationId] = useState(suggestedLocationId(item) ?? "");
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [submitting, setSubmitting] = useState(false);

  const locationsQuery = useWarehouseLocationsQuery(branchId);
  const destinations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (loc) => loc.can_store_inventory !== false && loc.id !== receivingLocationId
      ),
    [locationsQuery.data, receivingLocationId]
  );
  const destination = destinations.find((loc) => loc.id === destinationId) ?? null;
  const parsedQty = Number(quantity.replace(",", "."));
  const qtyValid = Number.isFinite(parsedQty) && parsedQty > 0 && parsedQty <= item.quantity;

  function outcome(): string {
    if (!destination) return t("outcome.pickFirst");
    if (item.handlingMode === "bulk") {
      return item.repairOrderLineId ? t("outcome.bulkReserved") : t("outcome.loose");
    }
    if (!item.repairOrderLineId) return t("outcome.loose");
    if (item.container && item.container.locationId === destination.id) {
      return t("outcome.intoContainer", { code: item.container.code });
    }
    return t("outcome.newContainer");
  }

  async function handleScanned(lookup: QrScanLookup): Promise<string | null> {
    if (lookup.assignment?.target_type !== "warehouse.location") return t("scanNotLocation");
    const match = destinations.find((loc) => loc.id === lookup.assignment?.target_id);
    if (!match) {
      return lookup.assignment.target_id === receivingLocationId
        ? t("scanIsReceiving")
        : t("scanNotAvailable");
    }
    setDestinationId(match.id);
    setScanning(false);
    return null;
  }

  async function handleConfirm() {
    if (!destination || !qtyValid) return;
    setSubmitting(true);
    try {
      const result = await putawayFromReceivingAction({
        variantId: item.variantId,
        quantity: parsedQty,
        destinationLocationId: destination.id,
        repairOrderLineId: item.repairOrderLineId,
      });
      if (!result.success) {
        const code = (result as { success: false; error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      const data = result.data;
      const where = locationLabel(destination);
      toast.success(
        data.mode === "container" && data.containerCode
          ? t(data.containerCreated ? "doneNewContainer" : "doneContainer", {
              code: data.containerCode,
              location: where,
            })
          : t("doneLocation", { location: where })
      );
      onClose();
      router.refresh();
    } catch {
      toast.error(tErr("unexpected"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(460px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono">{item.sku ?? "—"}</span>
          </DialogTitle>
          <DialogDescription>
            {item.productName ?? ""}
            {item.zlNumber ? ` · ZL ${item.zlNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <QrCameraScanner
            onScanned={handleScanned}
            onBack={() => setScanning(false)}
            backLabel={t("scanBack")}
            hintLabel={t("scanHint")}
          />
        ) : (
          <div className="flex flex-col gap-4" data-testid="putaway-dialog">
            <Button
              type="button"
              onClick={() => setScanning(true)}
              className="w-full"
              data-testid="putaway-scan"
            >
              <Camera className="mr-2 h-4 w-4" />
              {t("scan")}
            </Button>

            <div className="flex flex-col gap-1.5">
              <Label>{t("orPick")}</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger data-testid="putaway-destination">
                  <SelectValue
                    placeholder={locationsQuery.isLoading ? t("loading") : t("placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {locationLabel(loc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="putaway-qty">
                {t("quantity", { max: item.quantity, unit: item.unitCode ?? "" })}
              </Label>
              <Input
                id="putaway-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono"
                data-testid="putaway-qty"
              />
            </div>

            <div
              className="bg-muted/50 flex items-start gap-2 rounded-md p-3 text-sm"
              data-testid="putaway-outcome"
            >
              <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{destination ? locationLabel(destination) : "…"}</p>
                <p className="text-muted-foreground text-xs">{outcome()}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!destination || !qtyValid || submitting}
                data-testid="putaway-confirm"
              >
                {submitting ? t("confirming") : t("confirm")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
