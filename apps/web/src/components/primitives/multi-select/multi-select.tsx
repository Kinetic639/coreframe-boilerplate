"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  maxHeight?: number;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  searchPlaceholder = "Search…",
  emptyText = "No options found.",
  maxHeight = 200,
  className,
}: MultiSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (optValue: string, checked: boolean) => {
    onChange(checked ? [...value, optValue] : value.filter((v) => v !== optValue));
  };

  const clearAll = () => {
    onChange([]);
    setSearch("");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Search */}
      {options.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 pl-7 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Options */}
      <div className="space-y-0.5 overflow-y-auto pr-0.5" style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          filtered.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(ch) => toggle(opt.value, !!ch)}
                  className="shrink-0"
                />
                <span className="min-w-0 truncate">{opt.label}</span>
              </label>
            );
          })
        )}
      </div>

      {/* Clear link */}
      {value.length > 0 && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground text-left"
        >
          Clear {value.length} selected
        </button>
      )}
    </div>
  );
}
