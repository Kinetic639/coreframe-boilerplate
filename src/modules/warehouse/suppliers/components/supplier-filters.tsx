"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface SupplierFilters {
  search?: string;
  active?: boolean;
  preferred?: boolean;
}

interface SupplierFiltersProps {
  onFilterChange: (filters: SupplierFilters) => void;
}

export function SupplierFilters({ onFilterChange }: SupplierFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [active, setActive] = React.useState(searchParams.get("active") === "true");
  const [preferred, setPreferred] = React.useState(searchParams.get("preferred") === "true");

  const debouncedSearch = useDebounce(search, 300);

  const updateUrlParams = React.useCallback(
    (newFilters: Record<string, string | boolean | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === "" || value === false) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      router.push(
        {
          pathname: pathname as any,
          query: Object.fromEntries(params),
        },
        { scroll: false }
      );
    },
    [router, searchParams]
  );

  // Update filters when debounced search changes
  React.useEffect(() => {
    const newFilters = {
      search: debouncedSearch || undefined,
      active: active || undefined,
      preferred: preferred || undefined,
    };

    onFilterChange(newFilters);
    updateUrlParams(newFilters);
  }, [debouncedSearch, active, preferred, onFilterChange, updateUrlParams]);

  const clearFilters = () => {
    setSearch("");
    setActive(false);
    setPreferred(false);
    router.push(pathname as any);
  };

  const hasActiveFilters = search || active || preferred;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        {/* Search Input */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="search">Szukaj dostawców</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Nazwa dostawcy, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={active}
              onCheckedChange={(checked) => setActive(checked as boolean)}
            />
            <Label htmlFor="active">Tylko aktywni</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="preferred"
              checked={preferred}
              onCheckedChange={(checked) => setPreferred(checked as boolean)}
            />
            <Label htmlFor="preferred">Preferowani</Label>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Wyczyść
          </Button>
        )}
      </div>
    </div>
  );
}
