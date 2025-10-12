"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import { ColumnConfig } from "./types";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableStore } from "./store/table-store";
import { cn } from "@/lib/utils";

interface TableFiltersProps<T = any> {
  columns: ColumnConfig<T>[];
  searchPlaceholder?: string;
  showSearch?: boolean;
  layoutMode?: "full" | "sidebar-detail";
}

export function TableFilters<T>({
  columns,
  searchPlaceholder = "Search...",
  showSearch = true,
  layoutMode: _layoutMode = "full",
}: TableFiltersProps<T>) {
  const [searchExpanded, setSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Get state and actions from Zustand store
  const filters = useTableStore((state) => state.filters);
  const searchQuery = useTableStore((state) => state.searchQuery);
  const setSearchQuery = useTableStore((state) => state.setSearchQuery);
  const removeFilterAction = useTableStore((state) => state.removeFilter);
  const updateFilterAction = useTableStore((state) => state.updateFilter);

  const filterableColumns = columns.filter((col) => col.filterType);

  const updateFilter = (key: string, value: any, type: any) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      removeFilterAction(key);
    } else {
      updateFilterAction(key, { type, value });
    }
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  // Handle search expand
  const handleSearchClick = () => {
    setSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleSearchClose = () => {
    setSearchQuery("");
    setSearchExpanded(false);
  };

  // Collapse search when clicking outside or losing focus
  React.useEffect(() => {
    if (searchExpanded && !searchQuery) {
      const handleClickOutside = (e: MouseEvent) => {
        if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
          setSearchExpanded(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [searchExpanded, searchQuery]);

  return (
    <div className="flex h-9 items-center gap-1 border-b bg-background px-3">
      {/* Search - Compact Icon or Expanded */}
      {showSearch && (
        <>
          {!searchExpanded ? (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSearchClick}>
              <Search className="h-4 w-4" />
            </Button>
          ) : (
            <div className="relative flex items-center">
              <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-64 pl-7 pr-7 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 h-7 w-7 p-0"
                onClick={handleSearchClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Divider */}
      {showSearch && <div className="h-4 w-px bg-border" />}

      {/* All Filters Dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2 text-xs font-normal",
              hasActiveFilters && "text-primary"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>All filters</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-1">
            {filterableColumns.map((column) => {
              const isActive = filters[column.key] !== undefined;
              return (
                <button
                  key={column.key}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                    isActive && "bg-accent"
                  )}
                >
                  <span>{column.header}</span>
                  {isActive && <X className="h-3 w-3 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Individual Filter Buttons */}
      {filterableColumns.map((column) => (
        <FilterButton
          key={column.key}
          column={column}
          activeFilter={filters[column.key]}
          onFilterChange={(value) => updateFilter(column.key, value, column.filterType)}
          onClearFilter={() => removeFilterAction(column.key)}
        />
      ))}
    </div>
  );
}

// Individual Filter Button Component
interface FilterButtonProps {
  column: ColumnConfig<any>;
  activeFilter: any;
  onFilterChange: (value: any) => void;
  onClearFilter: () => void;
}

function FilterButton({ column, activeFilter, onFilterChange, onClearFilter }: FilterButtonProps) {
  const [open, setOpen] = React.useState(false);
  const isActive = activeFilter !== undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1 px-2 text-xs font-normal",
            isActive && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          {column.icon && <span className="h-3.5 w-3.5">{column.icon}</span>}
          <span>{column.header}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <FilterContent
          column={column}
          activeFilter={activeFilter}
          onFilterChange={(value) => {
            onFilterChange(value);
            setOpen(false);
          }}
          onClear={() => {
            onClearFilter();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Filter Content Component
interface FilterContentProps {
  column: ColumnConfig<any>;
  activeFilter: any;
  onFilterChange: (value: any) => void;
  onClear: () => void;
}

function FilterContent({ column, activeFilter, onFilterChange, onClear }: FilterContentProps) {
  const currentValue = activeFilter?.value;
  const hasValue = currentValue !== undefined && currentValue !== null;

  return (
    <div className="space-y-2">
      {/* Filter Options */}
      <div className="space-y-0.5">
        {column.filterType === "text" && (
          <Input
            placeholder={`Filter by ${column.header.toLowerCase()}...`}
            value={currentValue || ""}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        )}

        {column.filterType === "select" &&
          column.filterOptions?.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                currentValue === option.value && "bg-accent font-medium"
              )}
            >
              {option.icon && <span className="h-4 w-4">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}

        {column.filterType === "multi-select" && (
          <>
            {column.filterOptions?.map((option) => {
              const selectedValues = Array.isArray(currentValue) ? currentValue : [];
              const isChecked = selectedValues.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, option.value]
                        : selectedValues.filter((v) => v !== option.value);
                      onFilterChange(newValues.length > 0 ? newValues : undefined);
                    }}
                  />
                  {option.icon && <span className="h-4 w-4">{option.icon}</span>}
                  <span>{option.label}</span>
                </label>
              );
            })}
          </>
        )}

        {column.filterType === "boolean" && (
          <>
            <button
              onClick={() => onFilterChange(true)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                currentValue === true && "bg-accent font-medium"
              )}
            >
              Yes
            </button>
            <button
              onClick={() => onFilterChange(false)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                currentValue === false && "bg-accent font-medium"
              )}
            >
              No
            </button>
          </>
        )}

        {column.filterType === "number-range" && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="number"
                placeholder="Min"
                value={currentValue?.min || ""}
                onChange={(e) =>
                  onFilterChange({
                    ...currentValue,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="number"
                placeholder="Max"
                value={currentValue?.max || ""}
                onChange={(e) =>
                  onFilterChange({
                    ...currentValue,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
          </>
        )}
      </div>

      {/* Clear and Apply Buttons */}
      {hasValue && (
        <div className="flex items-center justify-between border-t pt-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            Clear
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => {
              // Apply is implicit, just close
            }}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
