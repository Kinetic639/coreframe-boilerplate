"use client";

import React, { useCallback, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDataView } from "./use-data-view";
import type { DataViewFilterDef } from "./data-view.types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function countActiveFilters(filters: Record<string, string | string[] | boolean | null>): number {
  return Object.values(filters).filter((v) => {
    if (v === null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
}

function getFilterValueLabel(
  def: DataViewFilterDef,
  filters: Record<string, string | string[] | boolean | null>
): string | null {
  if (def.type === "range") {
    const min = filters[def.minKey];
    const max = filters[def.maxKey];
    if (!min && !max) return null;
    if (min && max) return `${min}–${max}`;
    if (min) return `≥${min}`;
    return `≤${max}`;
  }
  if (def.type === "date-range") {
    const from = filters[def.fromKey];
    const to = filters[def.toKey];
    if (!from && !to) return null;
    if (from && to) return `${from} – ${to}`;
    if (from) return `From ${from}`;
    return `To ${to}`;
  }
  const val = filters[def.key];
  if (val === null || val === undefined || val === "") return null;
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    if (def.type === "multi-select") {
      return val.map((v) => def.options.find((o) => o.value === v)?.label ?? v).join(", ");
    }
    return val.join(", ");
  }
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (def.type === "select") {
    return def.options.find((o) => o.value === val)?.label ?? String(val);
  }
  return String(val);
}

function getFilterKeys(def: DataViewFilterDef): string[] {
  if (def.type === "range") return [def.minKey, def.maxKey];
  if (def.type === "date-range") return [def.fromKey, def.toKey];
  return [def.key];
}

// ---------------------------------------------------------------------------
// FilterField — renders the appropriate control for a filter type
// ---------------------------------------------------------------------------

function FilterField({
  def,
  filters,
  onChange,
}: {
  def: DataViewFilterDef;
  filters: Record<string, string | string[] | boolean | null>;
  onChange: (updates: Record<string, string | string[] | boolean | null>) => void;
}) {
  const value =
    def.type !== "range" && def.type !== "date-range" ? (filters[def.key] ?? null) : null;

  if (def.type === "text") {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange({ [def.key]: e.target.value || null })}
          placeholder={`Filter by ${def.label.toLowerCase()}`}
          className="h-8"
        />
      </div>
    );
  }

  if (def.type === "select") {
    const strVal = typeof value === "string" ? value : "";
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <Select
          value={strVal}
          onValueChange={(v) => onChange({ [def.key]: v === "__all__" ? null : v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={`All ${def.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {def.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "multi-select") {
    const arrVal = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {def.options.map((opt) => {
            const checked = arrVal.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(ch) => {
                    const next = ch
                      ? [...arrVal, opt.value]
                      : arrVal.filter((v) => v !== opt.value);
                    onChange({ [def.key]: next.length > 0 ? next : null });
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (def.type === "boolean") {
    const boolVal = typeof value === "boolean" ? value : null;
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <div className="flex gap-2">
          {(
            [
              { label: "Any", v: null },
              { label: "Yes", v: true },
              { label: "No", v: false },
            ] as { label: string; v: boolean | null }[]
          ).map(({ label, v }) => (
            <Button
              key={label}
              variant={boolVal === v ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange({ [def.key]: v })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (def.type === "range") {
    const minVal = typeof filters[def.minKey] === "string" ? (filters[def.minKey] as string) : "";
    const maxVal = typeof filters[def.maxKey] === "string" ? (filters[def.maxKey] as string) : "";
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <div className="flex gap-2">
          <Input
            value={minVal}
            onChange={(e) =>
              onChange({ [def.minKey]: e.target.value || null, [def.maxKey]: maxVal || null })
            }
            placeholder="Min"
            className="h-8"
            type="number"
          />
          <Input
            value={maxVal}
            onChange={(e) =>
              onChange({ [def.minKey]: minVal || null, [def.maxKey]: e.target.value || null })
            }
            placeholder="Max"
            className="h-8"
            type="number"
          />
        </div>
      </div>
    );
  }

  if (def.type === "date-range") {
    const fromVal =
      typeof filters[def.fromKey] === "string" ? (filters[def.fromKey] as string) : "";
    const toVal = typeof filters[def.toKey] === "string" ? (filters[def.toKey] as string) : "";
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
        <div className="flex gap-2">
          <Input
            value={fromVal}
            onChange={(e) =>
              onChange({ [def.fromKey]: e.target.value || null, [def.toKey]: toVal || null })
            }
            placeholder="From"
            className="h-8"
            type="date"
          />
          <Input
            value={toVal}
            onChange={(e) =>
              onChange({ [def.fromKey]: fromVal || null, [def.toKey]: e.target.value || null })
            }
            placeholder="To"
            className="h-8"
            type="date"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// DataViewFilterPill — compact pill for inline mode
// ---------------------------------------------------------------------------

function DataViewFilterPill({
  def,
  filters,
  onChange,
  onClear,
}: {
  def: DataViewFilterDef;
  filters: Record<string, string | string[] | boolean | null>;
  onChange: (updates: Record<string, string | string[] | boolean | null>) => void;
  onClear: (def: DataViewFilterDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = getFilterValueLabel(def, filters);
  const isActive = label !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-8 text-xs gap-1 max-w-48", isActive && "pr-1")}
          aria-label={`Filter by ${def.label}`}
          data-testid={`filter-pill-${def.key}`}
        >
          <span className="truncate font-medium">{def.label}</span>
          {isActive && <span className="truncate text-muted-foreground">: {label}</span>}
          {isActive ? (
            <span
              role="button"
              tabIndex={0}
              className="ml-0.5 shrink-0 rounded-full hover:bg-muted-foreground/20 p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear(def);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onClear(def);
                }
              }}
              aria-label={`Clear ${def.label} filter`}
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        <FilterField def={def} filters={filters} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// DataViewFilters — public component with mode prop
// ---------------------------------------------------------------------------

interface DataViewFiltersProps {
  mode?: "inline" | "dropdown";
}

export function DataViewFilters({ mode = "dropdown" }: DataViewFiltersProps) {
  const { filters: filterDefs, urlState } = useDataView();
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(urlState.filters);

  const handleFilterChange = useCallback(
    (updates: Record<string, string | string[] | boolean | null>) => {
      const next = { ...urlState.filters, ...updates };
      for (const k of Object.keys(next)) {
        if (next[k] === null || next[k] === "") delete next[k];
      }
      urlState.setFilters(next);
    },
    [urlState]
  );

  const clearFilter = useCallback(
    (def: DataViewFilterDef) => {
      const keys = getFilterKeys(def);
      const next = { ...urlState.filters };
      for (const k of keys) delete next[k];
      urlState.setFilters(next);
    },
    [urlState]
  );

  if (filterDefs.length === 0) return null;

  // ── Inline mode: pill per filter, no dropdown wrapper ────────────────────
  if (mode === "inline") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap" data-testid="inline-filters">
        {filterDefs.map((def) => (
          <DataViewFilterPill
            key={def.key}
            def={def}
            filters={urlState.filters}
            onChange={handleFilterChange}
            onClear={clearFilter}
          />
        ))}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => urlState.setFilters({})}
          >
            Clear all
          </Button>
        )}
      </div>
    );
  }

  // ── Dropdown mode: single button + popover ────────────────────────────────
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="dropdown-filters">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2" aria-label="Open filters">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <p className="text-sm font-medium text-foreground">Filters</p>
          {filterDefs.map((def) => (
            <FilterField
              key={def.key}
              def={def}
              filters={urlState.filters}
              onChange={handleFilterChange}
            />
          ))}
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => urlState.setFilters({})}
            >
              Clear all filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Active chips */}
      {filterDefs.map((def) => {
        const label = getFilterValueLabel(def, urlState.filters);
        if (!label) return null;
        return (
          <Badge key={def.key} variant="secondary" className="gap-1 pr-1 h-7 text-xs">
            <span className="font-medium">{def.label}:</span>
            <span className="max-w-24 truncate">{label}</span>
            <button
              onClick={() => clearFilter(def)}
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remove ${def.label} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
