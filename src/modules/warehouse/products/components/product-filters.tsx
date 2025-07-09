"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, XCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductFilters } from "@/modules/warehouse/products/hooks/use-product-filters";

interface ProductFiltersProps {
  onFilterChange: (filters: {
    search?: string;
    minPrice?: number | "";
    maxPrice?: number | "";
    supplierId?: string | "";
    locationId?: string | "";
  }) => void;
}

export function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  const { availableSuppliers, availableLocations } = useProductFilters([]); // Pass empty array as products are not needed here

  const [search, setSearch] = React.useState("");
  const [minPrice, setMinPrice] = React.useState<number | "">("");
  const [maxPrice, setMaxPrice] = React.useState<number | "">("");
  const [supplierId, setSupplierId] = React.useState<string | "">("all");
  const [locationId, setLocationId] = React.useState<string | "">("all");

  React.useEffect(() => {
    const handler = setTimeout(() => {
      onFilterChange({
        search,
        minPrice: minPrice === "" ? "" : Number(minPrice),
        maxPrice: maxPrice === "" ? "" : Number(maxPrice),
        supplierId: supplierId === "all" ? "" : supplierId,
        locationId: locationId === "all" ? "" : locationId,
      });
    }, 300); // Debounce search input

    return () => {
      clearTimeout(handler);
    };
  }, [search, minPrice, maxPrice, supplierId, locationId, onFilterChange]);

  const handleClearFilters = () => {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setSupplierId("all");
    setLocationId("all");
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div className="relative">
        <Label htmlFor="search">Szukaj</Label>
        <Search className="absolute left-3 top-1/2 mt-2 h-4 w-4 text-muted-foreground" />
        <Input
          id="search"
          placeholder="Nazwa, SKU, kod kreskowy..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div>
        <Label htmlFor="minPrice">Cena zakupu od</Label>
        <Input
          id="minPrice"
          type="number"
          placeholder="Min. cena"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
        />
      </div>

      <div>
        <Label htmlFor="maxPrice">Cena zakupu do</Label>
        <Input
          id="maxPrice"
          type="number"
          placeholder="Max. cena"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
        />
      </div>

      <div>
        <Label htmlFor="supplier">Dostawca</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
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
        <Select value={locationId} onValueChange={setLocationId}>
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

      <div className="flex items-end">
        <Button variant="outline" onClick={handleClearFilters} className="w-full">
          <XCircle className="mr-2 h-4 w-4" />
          Wyczyść filtry
        </Button>
      </div>
    </div>
  );
}
