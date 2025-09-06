"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, XCircle, Filter, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductFilters } from "@/modules/warehouse/products/hooks/use-product-filters";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductAdvancedFiltersDialog } from "./product-advanced-filters-dialog"; // Will be created in next step

interface ProductFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    supplierId?: string;
    locationId?: string;
    tags?: string[];
    showLowStock?: boolean;
  }) => void;
}

interface FilterState {
  search: string;
  minPrice: number | "";
  maxPrice: number | "";
  supplierId: string;
  locationId: string;
  tags: string[];
  showLowStock: boolean;
}

export function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { availableSuppliers, availableLocations } = useProductFilters([]); // This will be updated to accept filters later

  const getFilterValue = (param: string) => searchParams.get(param) || "";
  const getNumberFilterValue = (param: string) => {
    const value = searchParams.get(param);
    return value ? parseFloat(value) : "";
  };
  const getBooleanFilterValue = (param: string) => searchParams.get(param) === "true";
  const getArrayFilterValue = (param: string) => {
    const value = searchParams.get(param);
    return value ? value.split(",") : [];
  };

  const [filters, setFilters] = React.useState<FilterState>({
    search: getFilterValue("search"),
    minPrice: getNumberFilterValue("minPrice"),
    maxPrice: getNumberFilterValue("maxPrice"),
    supplierId: getFilterValue("supplierId") || "all",
    locationId: getFilterValue("locationId") || "all",
    tags: getArrayFilterValue("tags"),
    showLowStock: getBooleanFilterValue("showLowStock"),
  });

  // Sync URL params with filter state and trigger onFilterChange
  React.useEffect(() => {
    const newSearchParams = new URLSearchParams();

    const updateParam = (key: string, value: any, defaultValue?: any) => {
      if (
        value === defaultValue ||
        value === "" ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
      ) {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, String(value));
      }
    };

    updateParam("search", filters.search);
    updateParam("minPrice", filters.minPrice);
    updateParam("maxPrice", filters.maxPrice);
    updateParam("supplierId", filters.supplierId, "all");
    updateParam("locationId", filters.locationId, "all");
    updateParam("tags", filters.tags.join(","));
    updateParam("showLowStock", filters.showLowStock, false);

    // Debounce URL update to prevent excessive re-renders/navigation
    const handler = setTimeout(() => {
      router.replace(`?${newSearchParams.toString()}`);
      onFilterChange({
        search: filters.search || undefined,
        minPrice: filters.minPrice === "" ? undefined : Number(filters.minPrice),
        maxPrice: filters.maxPrice === "" ? undefined : Number(filters.maxPrice),
        supplierId: filters.supplierId === "all" ? undefined : filters.supplierId,
        locationId: filters.locationId === "all" ? undefined : filters.locationId,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        showLowStock: filters.showLowStock || undefined,
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [filters, onFilterChange, router, searchParams]);

  // Update local state when URL params change (e.g., from back/forward buttons or direct URL entry)
  React.useEffect(() => {
    setFilters({
      search: getFilterValue("search"),
      minPrice: getNumberFilterValue("minPrice"),
      maxPrice: getNumberFilterValue("maxPrice"),
      supplierId: getFilterValue("supplierId") || "all",
      locationId: getFilterValue("locationId") || "all",
      tags: getArrayFilterValue("tags"),
      showLowStock: getBooleanFilterValue("showLowStock"),
    });
  }, [searchParams]);

  const handleClearFilters = () => {
    setFilters({
      search: "",
      minPrice: "",
      maxPrice: "",
      supplierId: "all",
      locationId: "all",
      tags: [],
      showLowStock: false,
    });
  };

  const handleApplyAdvancedFilters = (appliedCriteria: FilterState) => {
    setFilters(appliedCriteria);
    // Convert FilterState to the expected format
    const convertedFilters = {
      search: appliedCriteria.search || undefined,
      minPrice: typeof appliedCriteria.minPrice === "number" ? appliedCriteria.minPrice : undefined,
      maxPrice: typeof appliedCriteria.maxPrice === "number" ? appliedCriteria.maxPrice : undefined,
      supplierId: appliedCriteria.supplierId !== "all" ? appliedCriteria.supplierId : undefined,
      locationId: appliedCriteria.locationId !== "all" ? appliedCriteria.locationId : undefined,
      tags: appliedCriteria.tags.length > 0 ? appliedCriteria.tags : undefined,
      showLowStock: appliedCriteria.showLowStock,
    };
    onFilterChange(convertedFilters);
  };

  const [isAdvancedFilterDialogOpen, setIsAdvancedFilterDialogOpen] = React.useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div className="relative">
        <Label htmlFor="search">Szukaj</Label>
        <Search className="absolute left-3 top-1/2 mt-2 h-4 w-4 text-muted-foreground" />
        <Input
          id="search"
          placeholder="Nazwa, SKU, kod kreskowy..."
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          className="pl-10"
        />
      </div>

      <div>
        <Label htmlFor="minPrice">Cena zakupu od</Label>
        <Input
          id="minPrice"
          type="number"
          placeholder="Min. cena"
          value={filters.minPrice}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              minPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
            }))
          }
        />
      </div>

      <div>
        <Label htmlFor="maxPrice">Cena zakupu do</Label>
        <Input
          id="maxPrice"
          type="number"
          placeholder="Max. cena"
          value={filters.maxPrice}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              maxPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
            }))
          }
        />
      </div>

      <div>
        <Label htmlFor="supplier">Dostawca</Label>
        <Select
          value={filters.supplierId}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, supplierId: value }))}
        >
          <SelectTrigger id="supplier">
            <SelectValue placeholder="Wybierz dostawcę" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy dostawcy</SelectItem>
            {availableSuppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="location">Lokalizacja magazynowa</Label>
        <Select
          value={filters.locationId}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, locationId: value }))}
        >
          <SelectTrigger id="location">
            <SelectValue placeholder="Wybierz lokalizację" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
            {availableLocations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tagi (rozdziel przecinkami)</Label>
        <Input
          id="tags"
          placeholder="np. Promocja, Nowość"
          value={filters.tags.join(", ")}
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              tags: e.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            }))
          }
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="showLowStock"
          checked={filters.showLowStock}
          onChange={(e) => setFilters((prev) => ({ ...prev, showLowStock: e.target.checked }))}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <Label htmlFor="showLowStock">Niski</Label>
      </div>

      <div className="flex items-end gap-2">
        <Button variant="outline" onClick={handleClearFilters} className="w-full">
          <XCircle className="mr-2 h-4 w-4" />
          Wyczyść filtry
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Button
          variant="outline"
          onClick={() => setIsAdvancedFilterDialogOpen(true)}
          className="w-full"
        >
          <Save className="mr-2 h-4 w-4" />
          Zapisz bieżące filtry
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsAdvancedFilterDialogOpen(true)}
          className="w-full"
        >
          <Filter className="mr-2 h-4 w-4" />
          Zarządzaj zapisanymi filtrami
        </Button>
        <ProductAdvancedFiltersDialog
          open={isAdvancedFilterDialogOpen}
          onOpenChange={setIsAdvancedFilterDialogOpen}
          onApplyFilter={handleApplyAdvancedFilters as any}
          currentFilters={{
            search: filters.search || undefined,
            minPrice: typeof filters.minPrice === "number" ? filters.minPrice : undefined,
            maxPrice: typeof filters.maxPrice === "number" ? filters.maxPrice : undefined,
            supplierId: filters.supplierId !== "all" ? filters.supplierId : undefined,
            locationId: filters.locationId !== "all" ? filters.locationId : undefined,
            tags: filters.tags.length > 0 ? filters.tags : undefined,
            showLowStock: filters.showLowStock,
          }}
        />
      </div>
    </div>
  );
}
