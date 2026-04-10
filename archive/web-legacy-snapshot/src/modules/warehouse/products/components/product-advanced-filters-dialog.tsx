import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Trash2, Edit, Filter } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductAdvancedFiltersDialog({
  onApplyFilter,
  currentFilters,
  open,
  onOpenChange,
}: ProductAdvancedFiltersDialogProps) {
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

  React.useEffect(() => {
    if (open) {
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
      criteria: currentFilters, // Use currentFilters directly
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
  };

  const handleDeleteFilter = (id: string) => {
    setSavedFilters(savedFilters.filter((f) => f.id !== id));
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.criteria);
    onOpenChange(false);
  };

  const userFilters = savedFilters.filter((f) => !f.isPublic);
  const publicFilters = savedFilters.filter((f) => f.isPublic);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Zarządzaj zapisanymi filtrami produktów</DialogTitle>
          <DialogDescription>Twórz, zapisuj i zarządzaj filtrami produktów.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create-new" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create-new">Zapisz bieżące filtry</TabsTrigger>
            <TabsTrigger value="saved-filters">Zapisane filtry</TabsTrigger>
          </TabsList>
          <TabsContent value="create-new" className="mt-4 space-y-4">
            <ScrollArea className="h-[150px] rounded-lg pr-4">
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
