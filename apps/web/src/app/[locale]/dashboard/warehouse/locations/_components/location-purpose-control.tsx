"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "react-toastify";

import { getLocationPurposeAction, updateLocationAction } from "@/app/actions/warehouse/locations";

/**
 * Zone 5 -- smallest safe visible control for designating a location as the
 * branch's receiving/staging buffer. Deliberately self-contained and
 * additive: calls the REAL, already-wired `updateLocationAction` /
 * `getLocationPurposeAction` directly, independent of the large Ambra
 * visual location model (`LogicalLocation`/capabilities) this pass did not
 * modify, avoiding any conflation with that model's own, unrelated
 * `capabilities.canReceive` concept.
 *
 * Rules enforced here (client-side, first line of defense only -- the DB's
 * own CHECK/unique constraints remain authoritative, per
 * warehouse_locations_receiving_must_be_stockable /
 * warehouse_locations_one_receiving_per_branch):
 *   - only a stockable location may be set to "Receiving",
 *   - "Standard" remains the default,
 *   - a duplicate/invalid attempt surfaces the DB's own safe, normalized
 *     error message (see WarehouseLocationsService.update), never a raw one.
 */

type Props = {
  locationId: string;
};

export function LocationPurposeControl({ locationId }: Props) {
  const [purpose, setPurpose] = useState<"standard" | "receiving" | null>(null);
  const [canStoreInventory, setCanStoreInventory] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getLocationPurposeAction(locationId);
      if (cancelled) return;
      if (result.success === true) {
        setPurpose(result.data.purpose);
        setCanStoreInventory(result.data.canStoreInventory);
      } else {
        setLoadError(result.error ?? "Could not load location purpose.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  function setLocationPurpose(next: "standard" | "receiving") {
    if (next === purpose) return;
    startTransition(async () => {
      // Cast rather than widen updateLocationAction's own (pre-existing,
      // widely-used) inferred return type -- keeping this workaround local
      // to this new component instead of touching that shared action.
      const result = (await updateLocationAction({ id: locationId, purpose: next })) as
        | { success: true }
        | { success: false; error: string };
      if (result.success === true) {
        setPurpose(next);
        toast.success(
          next === "receiving" ? "Location set as receiving." : "Location set to standard."
        );
      }
      if (result.success === false) {
        toast.error(result.error ?? "Could not update location purpose.");
      }
    });
  }

  if (loadError) {
    return <p className="text-xs text-destructive">{loadError}</p>;
  }
  if (purpose === null) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }

  return (
    <div className="flex items-center gap-2" data-testid="location-purpose-control">
      <span className="text-muted-foreground text-xs">Purpose:</span>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={purpose === "standard"}
        onClick={() => setLocationPurpose("standard")}
        className={`rounded border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
          purpose === "standard"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        }`}
      >
        Standard
      </button>
      <button
        type="button"
        disabled={isPending || (!canStoreInventory && purpose !== "receiving")}
        aria-pressed={purpose === "receiving"}
        title={
          !canStoreInventory ? "Only a stockable location can be the receiving location" : undefined
        }
        onClick={() => setLocationPurpose("receiving")}
        className={`rounded border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
          purpose === "receiving"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background"
        }`}
      >
        Receiving
      </button>
    </div>
  );
}
