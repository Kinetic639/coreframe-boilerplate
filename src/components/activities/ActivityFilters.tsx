"use client";

import { useState, useMemo } from "react";
import { CalendarIcon, FilterIcon, XIcon } from "lucide-react";
import { format } from "date-fns";
import { pl, enUS, type Locale } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useActivityModules,
  useActivityEntityTypes,
  useActivityActions,
} from "@/hooks/queries/useActivities";
import type { ActivityFilters, ActivityStatus } from "@/types/activities";

interface ActivityFiltersProps {
  filters: Omit<ActivityFilters, "organizationId">;
  onFiltersChange: (filters: Omit<ActivityFilters, "organizationId">) => void;
  showCompact?: boolean;
}

export function ActivityFilters({
  filters,
  onFiltersChange,
  showCompact = false,
}: ActivityFiltersProps) {
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;
  const [isOpen, setIsOpen] = useState(!showCompact);

  const { data: modules = [] } = useActivityModules();
  const { data: entityTypes = [] } = useActivityEntityTypes();
  const { data: actions = [] } = useActivityActions();

  const statusOptions: { value: ActivityStatus; label: string }[] = [
    { value: "recorded", label: "Recorded" },
    { value: "processed", label: "Processed" },
    { value: "archived", label: "Archived" },
    { value: "error", label: "Error" },
  ];

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.moduleIds?.length) count++;
    if (filters.entityTypeIds?.length) count++;
    if (filters.actionIds?.length) count++;
    if (filters.status?.length) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.searchTerm) count++;
    return count;
  }, [filters]);

  const updateFilter = (key: keyof typeof filters, value: unknown) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
    });
  };

  const toggleMultiSelect = (currentValues: string[] = [], value: string) => {
    if (currentValues.includes(value)) {
      return currentValues.filter((v) => v !== value);
    } else {
      return [...currentValues, value];
    }
  };

  if (showCompact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="mb-4 w-full">
            <FilterIcon className="mr-2 h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4">
              <FilterContent
                filters={filters}
                modules={modules}
                entityTypes={entityTypes}
                actions={actions}
                statusOptions={statusOptions}
                dateLocale={dateLocale}
                updateFilter={updateFilter}
                toggleMultiSelect={toggleMultiSelect}
                clearAllFilters={clearAllFilters}
                activeFiltersCount={activeFiltersCount}
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="mr-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FilterContent
          filters={filters}
          modules={modules}
          entityTypes={entityTypes}
          actions={actions}
          statusOptions={statusOptions}
          dateLocale={dateLocale}
          updateFilter={updateFilter}
          toggleMultiSelect={toggleMultiSelect}
          clearAllFilters={clearAllFilters}
          activeFiltersCount={activeFiltersCount}
        />
      </CardContent>
    </Card>
  );
}

interface FilterContentProps {
  filters: Omit<ActivityFilters, "organizationId">;
  modules: Array<{ id: string; slug: string; name: string }>;
  entityTypes: Array<{ id: string; slug: string; table_name?: string }>;
  actions: Array<{ id: string; slug: string; description?: string }>;
  statusOptions: { value: ActivityStatus; label: string }[];
  dateLocale: Locale;
  updateFilter: (key: keyof typeof filters, value: unknown) => void;
  toggleMultiSelect: (currentValues: string[], value: string) => string[];
  clearAllFilters: () => void;
  activeFiltersCount: number;
}

function FilterContent({
  filters,
  modules,
  entityTypes,
  actions,
  statusOptions,
  dateLocale,
  updateFilter,
  toggleMultiSelect,
}: FilterContentProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <Label htmlFor="search">Search in descriptions</Label>
        <Input
          id="search"
          type="text"
          placeholder="Search activities..."
          value={filters.searchTerm || ""}
          onChange={(e) => updateFilter("searchTerm", e.target.value || undefined)}
        />
      </div>

      <Separator />

      {/* Module filter */}
      <div>
        <Label>Modules</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {modules.map((module) => (
            <Badge
              key={module.id}
              variant={filters.moduleIds?.includes(module.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                updateFilter("moduleIds", toggleMultiSelect(filters.moduleIds, module.id))
              }
            >
              {module.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* Entity Type filter */}
      <div>
        <Label>Entity Types</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {entityTypes.map((entityType) => (
            <Badge
              key={entityType.id}
              variant={filters.entityTypeIds?.includes(entityType.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                updateFilter(
                  "entityTypeIds",
                  toggleMultiSelect(filters.entityTypeIds, entityType.id)
                )
              }
            >
              {entityType.slug}
            </Badge>
          ))}
        </div>
      </div>

      {/* Action filter */}
      <div>
        <Label>Actions</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Badge
              key={action.id}
              variant={filters.actionIds?.includes(action.id) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                updateFilter("actionIds", toggleMultiSelect(filters.actionIds, action.id))
              }
            >
              {action.slug}
            </Badge>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div>
        <Label>Status</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <Badge
              key={status.value}
              variant={filters.status?.includes(status.value) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                updateFilter("status", toggleMultiSelect(filters.status, status.value))
              }
            >
              {status.label}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>From Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom
                  ? format(filters.dateFrom, "PPP", { locale: dateLocale })
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => updateFilter("dateFrom", date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label>To Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo
                  ? format(filters.dateTo, "PPP", { locale: dateLocale })
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => updateFilter("dateTo", date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
