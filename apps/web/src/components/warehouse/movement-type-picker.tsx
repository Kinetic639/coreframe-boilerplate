"use client";

import React, { useMemo, useState } from "react";
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

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; order: number }> = {
  receipt: { label: "Receipts", icon: <Inbox className="h-3.5 w-3.5" />, order: 1 },
  issue: { label: "Issues", icon: <ArrowUp className="h-3.5 w-3.5" />, order: 2 },
  transfer: { label: "Transfers", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, order: 3 },
  bin_operation: { label: "Bin Operations", icon: <Package className="h-3.5 w-3.5" />, order: 4 },
  adjustment: { label: "Adjustments", icon: <Wrench className="h-3.5 w-3.5" />, order: 5 },
  reservation: { label: "Reservations", icon: <ArrowDown className="h-3.5 w-3.5" />, order: 6 },
  quality: { label: "Quality Control", icon: <Search className="h-3.5 w-3.5" />, order: 7 },
  consignment: { label: "Consignment", icon: <Truck className="h-3.5 w-3.5" />, order: 8 },
  other: { label: "Other", icon: <Package className="h-3.5 w-3.5" />, order: 99 },
};

function effectSummary(mt: InventoryMovementType): string {
  const parts: string[] = [];
  if (mt.requires_source_location && mt.requires_destination_location) {
    parts.push("− source / + destination");
  } else if (mt.requires_destination_location) {
    parts.push("+ destination on_hand");
  } else if (mt.requires_source_location) {
    parts.push("− source on_hand");
  }
  return parts.join(" · ") || "metadata only";
}

function requirementHints(mt: InventoryMovementType): string {
  const hints: string[] = [];
  if (mt.requires_source_location) hints.push("source");
  if (mt.requires_destination_location) hints.push("destination");
  if (mt.requires_reference) hints.push("reference");
  if (mt.requires_note) hints.push("note");
  return hints.length ? `Requires: ${hints.join(", ")}` : "";
}

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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
    for (const t of filtered) {
      const cat = t.category;
      const arr = groups.get(cat) ?? [];
      arr.push(t);
      groups.set(cat, arr);
    }
    return [...groups.entries()].sort(
      (a, b) => (CATEGORY_META[a[0]]?.order ?? 99) - (CATEGORY_META[b[0]]?.order ?? 99)
    );
  }, [filtered]);

  if (readonly && selected) {
    return (
      <div className="flex items-center gap-2 h-8 px-2 rounded-md border border-input bg-muted/30 text-xs">
        <span className="font-mono font-semibold">{selected.code}</span>
        <Badge variant="outline" className="text-[9px]">
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
              <Badge variant="outline" className="text-[9px]">
                {selected.document_type_code}
              </Badge>
              <span className="text-foreground truncate">{selected.name_pl ?? selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select movement type...</span>
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
              placeholder="Search by code, type, name..."
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
              No movement types match your search.
            </div>
          ) : (
            grouped.map(([category, types]) => {
              const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0">
                    {meta.icon}
                    {meta.label}
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
                      <Badge variant="outline" className="text-[9px] shrink-0">
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

export function MovementTypeEffectPreview({ type }: { type: InventoryMovementType | null }) {
  if (!type) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      {type.document_type_code} · {effectSummary(type)} · Doc number at posting
    </span>
  );
}
