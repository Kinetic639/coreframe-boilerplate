"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Boxes } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWarehouseLocationsQuery } from "@/hooks/queries/warehouse";
import { saveProductHandlingAction } from "@/app/actions/warehouse/receiving";
import type { ProductHandlingMode } from "@/server/services/inventory-receiving.service";

type Props = {
  productId: string;
  branchId: string;
  branchName: string;
  handlingMode: ProductHandlingMode;
  defaultLocationId: string | null;
  canManage: boolean;
};

const NO_LOCATION = "__none__";

/**
 * Zone 5: how this product is put away in the active branch -- "standard"
 * (a repair-order part goes into the order's container) or "bulk" (clips,
 * consumables: to a fixed bin/shelf, still reserved for the order, ticked
 * off on the issue) -- plus its optional fixed location.
 */
export function ProductHandlingCard({
  productId,
  branchId,
  branchName,
  handlingMode,
  defaultLocationId,
  canManage,
}: Props) {
  const t = useTranslations("warehouseInventory.detail.handling");
  const router = useRouter();
  const [mode, setMode] = useState<ProductHandlingMode>(handlingMode);
  const [locationId, setLocationId] = useState(defaultLocationId ?? NO_LOCATION);
  const [saving, setSaving] = useState(false);

  const locationsQuery = useWarehouseLocationsQuery(branchId);
  const locations = useMemo(
    () => (locationsQuery.data ?? []).filter((loc) => loc.can_store_inventory !== false),
    [locationsQuery.data]
  );
  const current = locations.find((loc) => loc.id === defaultLocationId) ?? null;
  const dirty =
    mode !== handlingMode || (locationId === NO_LOCATION ? null : locationId) !== defaultLocationId;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveProductHandlingAction({
        productId,
        handlingMode: mode,
        defaultLocationId: locationId === NO_LOCATION ? null : locationId,
      });
      if (!result.success) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="bg-card border-border flex flex-col gap-3 rounded-md border p-4"
      data-testid="product-handling-card"
    >
      <div className="flex items-center gap-2">
        <Boxes className="text-muted-foreground h-4 w-4" />
        <h2 className="text-sm font-semibold">{t("title", { branch: branchName })}</h2>
      </div>

      {canManage ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("modeLabel")}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ProductHandlingMode)}>
              <SelectTrigger data-testid="product-handling-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("mode.standard")}</SelectItem>
                <SelectItem value="bulk">{t("mode.bulk")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("locationLabel")}</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger data-testid="product-handling-location">
                <SelectValue placeholder={t("noLocation")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LOCATION}>{t("noLocation")}</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.code ? `${loc.code} · ${loc.name}` : loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-muted-foreground text-xs sm:col-span-2">{t(`help.${mode}`)}</p>
          <div className="sm:col-span-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
              data-testid="product-handling-save"
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("modeLabel")}</dt>
          <dd>{t(`mode.${handlingMode}`)}</dd>
          <dt className="text-muted-foreground">{t("locationLabel")}</dt>
          <dd>
            {current ? (current.code ? `${current.code} · ${current.name}` : current.name) : "—"}
          </dd>
        </dl>
      )}
    </section>
  );
}
