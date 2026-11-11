"use client";

/**
 * The document's AutoStacja magazyn (U3): chosen first, as in AutoStacja.
 * An MM may also name a target magazyn of the same jednostka. Lines from a
 * Matcher session take their magazyn from the delivery documents; a delivery
 * of several magazyny is then posted as one PZ per magazyn.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Warehouse } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listDocumentWarehousesAction,
  listTransferTargetsAction,
} from "@/app/actions/warehouse/inventory";
import type { DocumentUnit } from "@/server/services/warehouse-stock.service";

const NONE = "__none__";

export function useDocumentUnits() {
  const [units, setUnits] = useState<DocumentUnit[] | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = (await listDocumentWarehousesAction()) as {
        success: boolean;
        data?: DocumentUnit[];
      };
      if (alive) setUnits(res.success ? (res.data ?? []) : []);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return units;
}

/** Every jednostka of the organization with its magazyny: the targets of an MMJ. */
export function useTransferTargets(enabled: boolean) {
  const [units, setUnits] = useState<DocumentUnit[] | null>(null);
  useEffect(() => {
    if (!enabled || units !== null) return;
    let alive = true;
    void (async () => {
      const res = (await listTransferTargetsAction()) as {
        success: boolean;
        data?: DocumentUnit[];
      };
      if (alive) setUnits(res.success ? (res.data ?? []) : []);
    })();
    return () => {
      alive = false;
    };
  }, [enabled, units]);
  return units;
}

export function DocumentWarehouseSection({
  units,
  warehouseId,
  destinationWarehouseId,
  showDestination,
  transferTargets,
  fromMatcher,
  readonly,
  onWarehouseChange,
  onDestinationChange,
}: {
  units: DocumentUnit[] | null;
  warehouseId: string | null;
  destinationWarehouseId: string | null;
  /** MM: the target magazyn of the same jednostka */
  showDestination: boolean;
  /** MMJ: the jednostki of the organization; the target is in another jednostka */
  transferTargets?: DocumentUnit[] | null;
  /** Lines from a Matcher session carry their own magazyn */
  fromMatcher: boolean;
  readonly?: boolean;
  onWarehouseChange: (id: string | null) => void;
  onDestinationChange: (id: string | null) => void;
}) {
  const t = useTranslations("warehouseInventory.movementEditor.documentWarehouse");

  const unitOf = useMemo(() => {
    const map = new Map<string, DocumentUnit>();
    for (const u of units ?? []) for (const w of u.warehouses) map.set(w.id, u);
    return map;
  }, [units]);
  const sourceUnit = warehouseId ? unitOf.get(warehouseId) : undefined;
  const destinations = (sourceUnit?.warehouses ?? []).filter((w) => w.id !== warehouseId);
  const isTransfer = transferTargets !== undefined;
  const targetUnits = (transferTargets ?? []).filter((u) => u.id !== sourceUnit?.id);

  // MM: a target magazyn outside the source's jednostka is never kept.
  // MMJ: a target inside the source's jednostka is never kept.
  useEffect(() => {
    if (!destinationWarehouseId) return;
    if (isTransfer) {
      const target = (transferTargets ?? []).find((u) =>
        u.warehouses.some((w) => w.id === destinationWarehouseId)
      );
      if (transferTargets && (!target || target.id === sourceUnit?.id)) onDestinationChange(null);
    } else if (unitOf.get(destinationWarehouseId)?.id !== sourceUnit?.id) {
      onDestinationChange(null);
    }
  }, [
    destinationWarehouseId,
    isTransfer,
    onDestinationChange,
    sourceUnit?.id,
    transferTargets,
    unitOf,
  ]);

  if (units !== null && units.length === 0) return null;

  const label = (u: DocumentUnit, w: { code: string; name: string | null }) =>
    `${w.code}${w.name ? ` · ${w.name}` : ""} (${u.code}${u.name ? ` ${u.name}` : ""})`;

  return (
    <section className="rounded-sm border bg-card p-4" data-testid="document-warehouse">
      <div className="flex items-center gap-2 border-b pb-2 mb-3 text-xs uppercase font-bold tracking-wider text-muted-foreground">
        <Warehouse className="h-4 w-4" />
        {t("title")}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("warehouse")}
            {!fromMatcher && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Select
            value={warehouseId ?? NONE}
            onValueChange={(v) => onWarehouseChange(v === NONE ? null : v)}
            disabled={readonly || units === null}
          >
            <SelectTrigger className="h-9 text-sm" aria-label={t("warehouse")}>
              <SelectValue placeholder={t("choose")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("choose")}</SelectItem>
              {(units ?? []).map((u) => (
                <SelectGroup key={u.id}>
                  <SelectLabel>
                    {u.code}
                    {u.name ? ` ${u.name}` : ""}
                  </SelectLabel>
                  {u.warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {label(u, w)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isTransfer && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("transferTarget")}
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <Select
              value={destinationWarehouseId ?? NONE}
              onValueChange={(v) => onDestinationChange(v === NONE ? null : v)}
              disabled={readonly || !sourceUnit || transferTargets === null}
            >
              <SelectTrigger className="h-9 text-sm" aria-label={t("transferTarget")}>
                <SelectValue placeholder={t("chooseTarget")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("chooseTarget")}</SelectItem>
                {targetUnits.map((u) => (
                  <SelectGroup key={u.id}>
                    <SelectLabel>
                      {u.code}
                      {u.name ? ` ${u.name}` : ""}
                      {u.branchName ? ` · ${u.branchName}` : ""}
                    </SelectLabel>
                    {u.warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {label(u, w)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{t("transferTargetHint")}</p>
          </div>
        )}

        {showDestination && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("destination")}
            </label>
            <Select
              value={destinationWarehouseId ?? NONE}
              onValueChange={(v) => onDestinationChange(v === NONE ? null : v)}
              disabled={readonly || !sourceUnit || destinations.length === 0}
            >
              <SelectTrigger className="h-9 text-sm" aria-label={t("destination")}>
                <SelectValue placeholder={t("sameWarehouse")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("sameWarehouse")}</SelectItem>
                {sourceUnit &&
                  destinations.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {label(sourceUnit, w)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{t("destinationHint")}</p>
          </div>
        )}
      </div>
      {fromMatcher && <p className="mt-2 text-xs text-muted-foreground">{t("fromMatcher")}</p>}
    </section>
  );
}
