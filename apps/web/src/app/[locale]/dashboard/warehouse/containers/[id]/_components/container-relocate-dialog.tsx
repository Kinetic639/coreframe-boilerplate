"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowRight, Camera, MoveRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
import { relocateContainerAction } from "@/app/actions/warehouse/relocate-container";
import { QrCameraScanner, type QrScanLookup } from "@/components/features/qr/qr-camera-scanner";

type Props = {
  containerId: string;
  containerCode: string;
  branchId: string;
  currentLocationId: string | null;
  currentLocationLabel: string | null;
};

function locationLabel(loc: { code: string | null; name: string }) {
  return loc.code ? `${loc.code} · ${loc.name}` : loc.name;
}

/**
 * Phase 10E: "Przenieś kontener" -- pick the destination by scanning its
 * location sticker or from the branch's stockable locations, confirm, and
 * the whole container moves (801 for its contents, same container and QR).
 */
export function ContainerRelocateDialog({
  containerId,
  containerCode,
  branchId,
  currentLocationId,
  currentLocationLabel,
}: Props) {
  const t = useTranslations("modules.warehouse.containers.relocate");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [destinationId, setDestinationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const locationsQuery = useWarehouseLocationsQuery(open ? branchId : null);
  const destinations = useMemo(
    () =>
      (locationsQuery.data ?? []).filter(
        (loc) => loc.can_store_inventory !== false && loc.id !== currentLocationId
      ),
    [locationsQuery.data, currentLocationId]
  );
  const destination = destinations.find((loc) => loc.id === destinationId) ?? null;

  function openDialog() {
    setDestinationId("");
    setScanning(false);
    setOpen(true);
  }

  function startScan() {
    setScannerKey((k) => k + 1);
    setScanning(true);
  }

  async function handleScanned(lookup: QrScanLookup): Promise<string | null> {
    if (lookup.assignment?.target_type !== "warehouse.location") return t("scanNotLocation");
    const targetId = lookup.assignment.target_id;
    if (targetId === currentLocationId) return t("errors.same_location");
    const match = destinations.find((loc) => loc.id === targetId);
    if (!match) return t("scanNotAvailable");
    setDestinationId(match.id);
    setScanning(false);
    return null;
  }

  async function handleConfirm() {
    if (!destination) return;
    setSubmitting(true);
    try {
      const result = await relocateContainerAction({
        containerId,
        destinationLocationId: destination.id,
      });
      if (!result.success) {
        const key = `errors.${(result as { success: false; error: string }).error}`;
        toast.error(t.has(key) ? t(key) : t("errors.unexpected"));
        return;
      }
      toast.success(t("movedToast", { code: containerCode, location: locationLabel(destination) }));
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(t("errors.unexpected"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="w-full sm:w-fit"
        data-testid="container-relocate-open"
      >
        <MoveRight className="mr-2 h-4 w-4" />
        {t("open")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(440px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>{t("title", { code: containerCode })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          {scanning ? (
            <QrCameraScanner
              key={scannerKey}
              onScanned={handleScanned}
              onBack={() => setScanning(false)}
              backLabel={t("scanBack")}
              hintLabel={t("scanHint")}
            />
          ) : (
            <div className="flex flex-col gap-4" data-testid="container-relocate-form">
              <Button
                type="button"
                onClick={startScan}
                className="w-full"
                data-testid="container-relocate-scan"
              >
                <Camera className="mr-2 h-4 w-4" />
                {t("scan")}
              </Button>

              <div className="flex flex-col gap-1.5">
                <Label>{t("orPick")}</Label>
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger data-testid="container-relocate-destination">
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

              <div
                className="bg-muted/50 flex items-center gap-2 rounded-md p-3 text-sm"
                data-testid="container-relocate-summary"
              >
                <span className="font-mono">{currentLocationLabel ?? "—"}</span>
                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="font-mono font-medium">
                  {destination ? locationLabel(destination) : "…"}
                </span>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!destination || submitting}
                  data-testid="container-relocate-confirm"
                >
                  {submitting ? t("moving") : t("confirm")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
