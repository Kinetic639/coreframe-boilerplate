import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Trash2, Edit, Filter } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tables } from "@/supabase/types/types";

interface SavedFilter {
  id: string;
  name: string;
  isPublic: boolean;
  criteria: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    supplierId?: string;
    locationId?: string;
    tags?: string[];
    showLowStock?: boolean;
  };
}

interface ProductAdvancedFiltersDialogProps {
  onApplyFilter: (filters: SavedFilter["criteria"]) => void;
  currentFilters: SavedFilter["criteria"];
  availableSuppliers: Tables<"suppliers">[];
  availableLocations: Tables<"locations">[];
}

export function ProductAdvancedFiltersDialog({
  onApplyFilter,
  currentFilters,
  availableSuppliers,
  availableLocations,
}: ProductAdvancedFiltersDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [filterName, setFilterName] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);
  const [savedFilters, setSavedFilters] = React.useState<SavedFilter[]>(() => {
    if (typeof window !== "undefined") {
      const storedFilters = localStorage.getItem("product_saved_filters");
      return storedFilters ? JSON.parse(storedFilters) : [];
    }
    return [];
  });
  const [editingFilterId, setEditingFilterId] = React.useState<string | null>(null);

  const [currentSearch, setCurrentSearch] = React.useState(currentFilters.search || "");
  const [currentMinPrice, setCurrentMinPrice] = React.useState<number | string>(
    currentFilters.minPrice || ""
  );
  const [currentMaxPrice, setCurrentMaxPrice] = React.useState<number | string>(
    currentFilters.maxPrice || ""
  );
  const [currentSupplierId, setCurrentSupplierId] = React.useState(
    currentFilters.supplierId || "all"
  );
  const [currentLocationId, setCurrentLocationId] = React.useState(
    currentFilters.locationId || "all"
  );
  const [currentTags, setCurrentTags] = React.useState<string[]>(currentFilters.tags || []);
  const [currentShowLowStock, setCurrentShowLowStock] = React.useState(
    currentFilters.showLowStock || false
  );

  React.useEffect(() => {
    if (open) {
      setCurrentSearch(currentFilters.search || "");
      setCurrentMinPrice(currentFilters.minPrice || "");
      setCurrentMaxPrice(currentFilters.maxPrice || "");
      setCurrentSupplierId(currentFilters.supplierId || "all");
      setCurrentLocationId(currentFilters.locationId || "all");
      setCurrentTags(currentFilters.tags || []);
      setCurrentShowLowStock(currentFilters.showLowStock || false);
      setFilterName("");
      setIsPublic(false);
      setEditingFilterId(null);
    }
  }, [open, currentFilters]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("product_saved_filters", JSON.stringify(savedFilters));
    }
  }, [savedFilters]);

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: editingFilterId || `filter-${Date.now()}`,
      name: filterName.trim(),
      isPublic,
      criteria: {
        search: currentSearch || undefined,
        minPrice: typeof currentMinPrice === "number" ? currentMinPrice : undefined,
        maxPrice: typeof currentMaxPrice === "number" ? currentMaxPrice : undefined,
        supplierId: currentSupplierId === "all" ? undefined : currentSupplierId,
        locationId: currentLocationId === "all" ? undefined : currentLocationId,
        tags: currentTags.length > 0 ? currentTags : undefined,
        showLowStock: currentShowLowStock || undefined,
      },
    };

    if (editingFilterId) {
      setSavedFilters(savedFilters.map((f) => (f.id === editingFilterId ? newFilter : f)));
    } else {
      setSavedFilters([...savedFilters, newFilter]);
    }
    setFilterName("");
    setIsPublic(false);
    setEditingFilterId(null);
  };

  const handleEditFilter = (filter: SavedFilter) => {
    setFilterName(filter.name);
    setIsPublic(filter.isPublic);
    setEditingFilterId(filter.id);
    setCurrentSearch(filter.criteria.search || "");
    setCurrentMinPrice(filter.criteria.minPrice || "");
    setCurrentMaxPrice(filter.criteria.maxPrice || "");
    setCurrentSupplierId(filter.criteria.supplierId || "all");
    setCurrentLocationId(filter.criteria.locationId || "all");
    setCurrentTags(filter.criteria.tags || []);
    setCurrentShowLowStock(filter.criteria.showLowStock || false);
  };

  const handleDeleteFilter = (id: string) => {
    setSavedFilters(savedFilters.filter((f) => f.id !== id));
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.criteria);
    setOpen(false);
  };

  const userFilters = savedFilters.filter((f) => !f.isPublic);
  const publicFilters = savedFilters.filter((f) => f.isPublic);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Filter className="mr-2 h-4 w-4" />
          Zaawansowane filtry
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Zaawansowane filtry produktów</DialogTitle>
          <DialogDescription>Twórz, zapisuj i zarządzaj filtrami produktów.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create-new" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create-new">Stwórz nowy / Edytuj</TabsTrigger>
            <TabsTrigger value="saved-filters">Zapisane filtry</TabsTrigger>
          </TabsList>
          <TabsContent value="create-new" className="mt-4 space-y-4">
            <ScrollArea className="h-[400px] rounded-lg pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="filterName">Nazwa filtru</Label>
                  <Input
                    id="filterName"
                    placeholder="Np. 'Produkty o niskiej cenie', 'Lakiery z Krakowa'"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentSearch">Szukaj</Label>
                  <Input
                    id="currentSearch"
                    placeholder="Nazwa, SKU, kod kreskowy..."
                    value={currentSearch}
                    onChange={(e) => setCurrentSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentMinPrice">Cena zakupu od</Label>
                    <Input
                      id="currentMinPrice"
                      type="number"
                      placeholder="Min. cena"
                      value={currentMinPrice}
                      onChange={(e) =>
                        setCurrentMinPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentMaxPrice">Cena zakupu do</Label>
                    <Input
                      id="currentMaxPrice"
                      type="number"
                      placeholder="Max. cena"
                      value={currentMaxPrice}
                      onChange={(e) =>
                        setCurrentMaxPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentSupplier">Dostawca</Label>
                  <Select value={currentSupplierId} onValueChange={setCurrentSupplierId}>
                    <SelectTrigger id="currentSupplier">
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
                <div className="space-y-2">
                  <Label htmlFor="currentLocation">Lokalizacja magazynowa</Label>
                  <Select value={currentLocationId} onValueChange={setCurrentLocationId}>
                    <SelectTrigger id="currentLocation">
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
                  <Label htmlFor="currentTags">Tagi (rozdziel przecinkami)</Label>
                  <Input
                    id="currentTags"
                    placeholder="np. Promocja, Nowość"
                    value={currentTags.join(", ")}
                    onChange={(e) =>
                      setCurrentTags(
                        e.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="currentShowLowStock"
                    checked={currentShowLowStock}
                    onChange={(e) => setCurrentShowLowStock(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="currentShowLowStock">
                    Pokaż tylko produkty z niskim stanem magazynowym
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isPublic">Udostępnij publicznie</Label>
                </div>
                <Button onClick={handleSaveFilter} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {editingFilterId ? "Zapisz zmiany" : "Zapisz filtr"}
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="saved-filters" className="mt-4 space-y-4">
            <h4 className="font-medium">Moje filtry</h4>
            <ScrollArea className="h-40 rounded-md border p-4">
              {userFilters.length === 0 ? (
                <p className="text-muted-foreground">Brak zapisanych filtrów.</p>
              ) : (
                userFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center justify-between py-2">
                    <span>{filter.name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditFilter(filter)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleApplyFilter(filter)}>
                        <Filter className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFilter(filter.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>

            <Separator />

            <h4 className="font-medium">Filtry publiczne</h4>
            <ScrollArea className="h-40 rounded-md border p-4">
              {publicFilters.length === 0 ? (
                <p className="text-muted-foreground">Brak publicznych filtrów.</p>
              ) : (
                publicFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center justify-between py-2">
                    <span>{filter.name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleApplyFilter(filter)}>
                        <Filter className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
