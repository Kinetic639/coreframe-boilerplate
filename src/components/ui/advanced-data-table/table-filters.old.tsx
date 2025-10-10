"use client";

import * as React from "react";
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
import { Label } from "@/components/ui/label";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { ColumnConfig } from "./types";
import { getActiveFilterCount, isFilterActive } from "./utils/filter-utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableStore } from "./store/table-store";

interface TableFiltersProps<T = any> {
  columns: ColumnConfig<T>[];
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function TableFilters<T>({
  columns,
  searchPlaceholder = "Search...",
  showSearch = true,
}: TableFiltersProps<T>) {
  // Get state and actions from Zustand store
  const filters = useTableStore((state) => state.filters);
  const searchQuery = useTableStore((state) => state.searchQuery);
  const setSearchQuery = useTableStore((state) => state.setSearchQuery);
  const clearFilters = useTableStore((state) => state.clearFilters);
  const removeFilterAction = useTableStore((state) => state.removeFilter);
  const updateFilterAction = useTableStore((state) => state.updateFilter);

  const activeFilterCount = getActiveFilterCount(filters);
  const filterableColumns = columns.filter((col) => col.filterType);

  const updateFilter = (key: string, value: any, type: any) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      removeFilterAction(key);
    } else {
      updateFilterAction(key, { type, value });
    }
  };

  const clearAllFilters = () => {
    clearFilters();
  };

  const removeFilter = (key: string) => {
    removeFilterAction(key);
  };

  return (
    <div className="space-y-3">
      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search Input */}
        {showSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Filter Button with Count Badge */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {(activeFilterCount > 0 || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      {filterableColumns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterableColumns.map((column) => {
            const filterValue = filters[column.key];
            const isActive = isFilterActive(filterValue);

            return (
              <Popover key={column.key}>
                <PopoverTrigger asChild>
                  <Button variant={isActive ? "default" : "outline"} size="sm" className="gap-1">
                    {column.header}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                    {isActive && (
                      <X
                        className="ml-1 h-3 w-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFilter(column.key);
                        }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <FilterContent
                    column={column}
                    value={filterValue}
                    onChange={(value) => updateFilter(column.key, value, column.filterType)}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filter content component based on filter type
function FilterContent({ column, value, onChange }: any) {
  const currentValue = value?.value;

  switch (column.filterType) {
    case "text":
      return (
        <div className="space-y-2">
          <Label>{column.header}</Label>
          <Input
            placeholder={`Filter by ${column.header.toLowerCase()}...`}
            value={currentValue || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label>{column.header}</Label>
          <Select value={currentValue || "all"} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${column.header.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {column.filterOptions?.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "multi-select":
      const selectedValues = currentValue || [];
      return (
        <div className="space-y-2">
          <Label>{column.header}</Label>
          <div className="space-y-2">
            {column.filterOptions?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${column.key}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option.value]);
                    } else {
                      onChange(selectedValues.filter((v: string) => v !== option.value));
                    }
                  }}
                />
                <label
                  htmlFor={`${column.key}-${option.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      );

    case "number-range":
      const rangeValue = currentValue || { min: "", max: "" };
      return (
        <div className="space-y-3">
          <Label>{column.header}</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <Input
                type="number"
                placeholder="Min"
                value={rangeValue.min || ""}
                onChange={(e) =>
                  onChange({
                    ...rangeValue,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                placeholder="Max"
                value={rangeValue.max || ""}
                onChange={(e) =>
                  onChange({
                    ...rangeValue,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
        </div>
      );

    case "boolean":
      return (
        <div className="space-y-2">
          <Label>{column.header}</Label>
          <Select
            value={currentValue === undefined ? "all" : currentValue.toString()}
            onValueChange={(val) => {
              if (val === "all") {
                onChange(undefined);
              } else {
                onChange(val === "true");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
