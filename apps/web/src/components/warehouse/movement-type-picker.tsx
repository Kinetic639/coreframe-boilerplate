"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  Inbox,
  Lock,
  Package,
  Search,
  Truck,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { InventoryMovementType } from "@/lib/warehouse/inventory-types";

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; order: number }> = {
  receipt: { icon: <Inbox className="h-3.5 w-3.5" />, order: 1 },
  issue: { icon: <ArrowUp className="h-3.5 w-3.5" />, order: 2 },
  transfer: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, order: 3 },
  bin_operation: { icon: <Package className="h-3.5 w-3.5" />, order: 4 },
  adjustment: { icon: <Wrench className="h-3.5 w-3.5" />, order: 5 },
  reservation: { icon: <ArrowDown className="h-3.5 w-3.5" />, order: 6 },
  quality: { icon: <Search className="h-3.5 w-3.5" />, order: 7 },
  consignment: { icon: <Truck className="h-3.5 w-3.5" />, order: 8 },
  other: { icon: <Package className="h-3.5 w-3.5" />, order: 99 },
};

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  receipt: "catReceipts",
  issue: "catIssues",
  transfer: "catTransfers",
  bin_operation: "catBinOperations",
  adjustment: "catAdjustments",
  reservation: "catReservations",
  quality: "catQuality",
  consignment: "catConsignment",
  other: "catOther",
};

type MovementTypePickerProps = {
  value: string | null;
  onChange: (code: string) => void;
  movementTypes: InventoryMovementType[];
  disabled?: boolean;
  readonly?: boolean;
};

export function MovementTypePicker({
  value,
  onChange,
  movementTypes,
  disabled,
  readonly,
}: MovementTypePickerProps) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  function effectSummary(mt: InventoryMovementType): string {
    if (mt.requires_source_location && mt.requires_destination_location) {
      return t("effectSrcDest");
    } else if (mt.requires_destination_location) {
      return t("effectDestOnHand");
    } else if (mt.requires_source_location) {
      return t("effectSrcOnHand");
    }
    return t("effectMetadataOnly");
  }

  const selected = movementTypes.find((t) => t.code === value) ?? null;

  const filtered = useMemo(() => {
    if (!search) return movementTypes;
    const q = search.toLowerCase();
    return movementTypes.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.document_type_code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.name_pl && t.name_pl.toLowerCase().includes(q)) ||
        (t.name_en && t.name_en.toLowerCase().includes(q)) ||
        t.category.toLowerCase().includes(q)
    );
  }, [movementTypes, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, InventoryMovementType[]>();
    for (const mt of filtered) {
      const cat = mt.category;
      const arr = groups.get(cat) ?? [];
      arr.push(mt);
      groups.set(cat, arr);
    }
    return [...groups.entries()].sort(
      (a, b) => (CATEGORY_ICONS[a[0]]?.order ?? 99) - (CATEGORY_ICONS[b[0]]?.order ?? 99)
    );
  }, [filtered]);

  if (readonly && selected) {
    return (
      <div className="flex items-center gap-2 h-8 px-2 rounded-md border border-input bg-muted/30 text-xs">
        <span className="font-mono font-semibold">{selected.code}</span>
        <Badge variant="outline" className="text-[10px]">
          {selected.document_type_code}
        </Badge>
        <span className="text-foreground truncate">{selected.name_pl ?? selected.name}</span>
        <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-left transition-colors",
            "hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {selected ? (
            <>
              <span className="font-mono font-semibold">{selected.code}</span>
              <Badge variant="outline" className="text-[10px]">
                {selected.document_type_code}
              </Badge>
              <span className="text-foreground truncate">{selected.name_pl ?? selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t("selectMovementType")}</span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <div className="border-b px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("searchByCodeTypeName")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-auto">
          {grouped.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("noMovementTypesMatch")}
            </div>
          ) : (
            grouped.map(([category, types]) => {
              const meta = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
              const labelKey = CATEGORY_LABEL_KEYS[category] ?? "catOther";
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0">
                    {meta.icon}
                    {t(labelKey as any)}
                  </div>
                  {types.map((mt) => (
                    <button
                      key={mt.code}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                        "hover:bg-muted/40",
                        value === mt.code && "bg-primary/5"
                      )}
                      onClick={() => {
                        onChange(mt.code);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-mono font-semibold text-xs w-8 shrink-0">
                        {mt.code}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {mt.document_type_code}
                      </Badge>
                      <span className="text-xs text-foreground truncate">
                        {mt.name_pl ?? mt.name}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {effectSummary(mt)}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
