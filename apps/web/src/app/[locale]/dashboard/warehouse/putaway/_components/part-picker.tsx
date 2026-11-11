"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ReceivingPendingItem } from "@/server/services/inventory-receiving.service";
import { formatQty as fmt, itemKey } from "./putaway-utils";

export type PickState = Record<string, { checked: boolean; quantity: number }>;

export function initialPick(items: ReceivingPendingItem[], checked: boolean): PickState {
  return Object.fromEntries(items.map((i) => [itemKey(i), { checked, quantity: i.quantity }]));
}

export function pickedLines(items: ReceivingPendingItem[], pick: PickState) {
  return items.flatMap((item) => {
    const p = pick[itemKey(item)];
    if (!p?.checked || !(p.quantity > 0)) return [];
    return [
      {
        variantId: item.variantId,
        quantity: Math.min(p.quantity, item.quantity),
        repairOrderLineId: item.repairOrderLineId,
      },
    ];
  });
}

type Props = {
  items: ReceivingPendingItem[];
  pick: PickState;
  onChange: (next: PickState) => void;
  /** Optional per-item hint (e.g. "stała kuweta R01-A-K01"). */
  hint?: (item: ReceivingPendingItem) => string | null;
};

/**
 * Touch-first part list: the whole row toggles the part, quantity has big
 * -/+ buttons (no keyboard needed for the usual "all of it" case).
 */
export function PartPicker({ items, pick, onChange, hint }: Props) {
  const t = useTranslations("modules.warehouse.putaway.scan");
  const allChecked = items.length > 0 && items.every((i) => pick[itemKey(i)]?.checked);

  const set = (
    item: ReceivingPendingItem,
    patch: Partial<{ checked: boolean; quantity: number }>
  ) => {
    const key = itemKey(item);
    const current = pick[key] ?? { checked: false, quantity: item.quantity };
    onChange({ ...pick, [key]: { ...current, ...patch } });
  };

  const step = (item: ReceivingPendingItem, delta: number) => {
    const current = pick[itemKey(item)]?.quantity ?? item.quantity;
    const next = Math.min(Math.max(current + delta, 0), item.quantity);
    set(item, { quantity: next, checked: next > 0 });
  };

  if (items.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{t("noParts")}</p>;
  }

  return (
    <div className="flex flex-col gap-2" data-testid="part-picker">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() =>
          onChange(
            Object.fromEntries(
              items.map((i) => [itemKey(i), { checked: !allChecked, quantity: i.quantity }])
            )
          )
        }
        data-testid="part-picker-all"
      >
        {allChecked ? t("uncheckAll") : t("checkAll", { count: items.length })}
      </Button>
      {items.map((item) => {
        const p = pick[itemKey(item)] ?? { checked: false, quantity: item.quantity };
        const note = hint?.(item);
        return (
          <div
            key={itemKey(item)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-colors",
              p.checked ? "border-primary bg-primary/5" : "bg-card"
            )}
            data-testid="part-picker-row"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => set(item, { checked: !p.checked })}
              aria-pressed={p.checked}
            >
              <Checkbox checked={p.checked} className="h-5 w-5 shrink-0" tabIndex={-1} />
              <span className="min-w-0">
                <span className="block font-mono text-sm font-semibold">{item.sku ?? "—"}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {item.productName ?? ""}
                </span>
                {note && <span className="block text-xs text-amber-700">{note}</span>}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => step(item, -1)}
                aria-label={t("less")}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-mono text-sm" data-testid="part-picker-qty">
                {fmt(p.quantity)}
                <span className="text-muted-foreground block text-[10px]">
                  / {fmt(item.quantity)} {item.unitCode ?? ""}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => step(item, 1)}
                aria-label={t("more")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
