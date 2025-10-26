// =============================================
// Movement Filters Component
// Advanced filtering UI for stock movements
// =============================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { MovementTypeSelector } from "./movement-type-selector";
import type {
  StockMovementFilters,
  MovementStatus,
  MovementCategory,
} from "../types/stock-movements";
import { format } from "date-fns";

interface MovementFiltersProps {
  filters: StockMovementFilters;
  onChange: (filters: StockMovementFilters) => void;
  onReset: () => void;
}

const MOVEMENT_STATUSES: MovementStatus[] = [
  "pending",
  "approved",
  "completed",
  "cancelled",
  "reversed",
];

const MOVEMENT_CATEGORIES: MovementCategory[] = [
  "receipt",
  "issue",
  "transfer",
  "adjustment",
  "reservation",
  "ecommerce",
];

export function MovementFilters({ filters, onChange, onReset }: MovementFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const updateFilter = <K extends keyof StockMovementFilters>(
    key: K,
    value: StockMovementFilters[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.keys(filters).some((key) => {
    const value = filters[key as keyof StockMovementFilters];
    return value !== undefined && value !== null && value !== "";
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <span className="text-sm font-normal text-muted-foreground">(Active)</span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Movement Type */}
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <MovementTypeSelector
              value={filters.movement_type_code || ""}
              onChange={(value) => updateFilter("movement_type_code", value || undefined)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={filters.category || ""}
              onValueChange={(value) =>
                updateFilter("category", (value || undefined) as MovementCategory | undefined)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {MOVEMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status || ""}
              onValueChange={(value) => updateFilter("status", value as MovementStatus | undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                {MOVEMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product ID */}
          <div className="space-y-2">
            <Label>Product ID</Label>
            <Input
              placeholder="Enter product ID"
              value={filters.product_id || ""}
              onChange={(e) => updateFilter("product_id", e.target.value || undefined)}
            />
          </div>

          {/* Location Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source Location</Label>
              <Input
                placeholder="Source location ID"
                value={filters.source_location_id || ""}
                onChange={(e) => updateFilter("source_location_id", e.target.value || undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label>Destination Location</Label>
              <Input
                placeholder="Destination location ID"
                value={filters.destination_location_id || ""}
                onChange={(e) =>
                  updateFilter("destination_location_id", e.target.value || undefined)
                }
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_from ? format(new Date(filters.date_from), "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.date_from ? new Date(filters.date_from) : undefined}
                    onSelect={(date) => updateFilter("date_from", date?.toISOString() || undefined)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_to ? format(new Date(filters.date_to), "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.date_to ? new Date(filters.date_to) : undefined}
                    onSelect={(date) => updateFilter("date_to", date?.toISOString() || undefined)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label>Reference ID</Label>
            <Input
              placeholder="Reference ID"
              value={filters.reference_id || ""}
              onChange={(e) => updateFilter("reference_id", e.target.value || undefined)}
            />
          </div>

          {/* Created By */}
          <div className="space-y-2">
            <Label>Created By (User ID)</Label>
            <Input
              placeholder="User ID"
              value={filters.created_by || ""}
              onChange={(e) => updateFilter("created_by", e.target.value || undefined)}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
