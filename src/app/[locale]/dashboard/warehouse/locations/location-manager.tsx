"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { Plus, Search, MapPin, Building2, Loader, ArrowUpDown } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { buildLocationTree } from "@/modules/warehouse/utils/buildLocationstree";
import { LocationTree } from "@/modules/warehouse/locations/location-tree";
import { LocationTreeMobile } from "@/modules/warehouse/locations/location-tree-mobile";
import { LocationFormDialog } from "@/modules/warehouse/locations/location-form-dialog";
import { MoveLocationDialog } from "@/modules/warehouse/locations/move-location-dialog";
import { toast } from "react-toastify";

interface LocationManagerProps {
  activeBranchId: string | null;
  activeBranchName: string;
}

export default function LocationManager({
  activeBranchId,
  activeBranchName,
}: LocationManagerProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<"name" | "code" | "created_at">("name");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<LocationTreeItem | undefined>();
  const [movingLocation, setMovingLocation] = React.useState<LocationTreeItem | undefined>();
  const [parentLocation, setParentLocation] = React.useState<LocationTreeItem | undefined>();
  const [locations, setLocations] = React.useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Function to calculate total product count including children
  const calculateLocationProductCounts = async (
    locations: LocationTreeItem[]
  ): Promise<LocationTreeItem[]> => {
    const supabase = createClient();

    // Get all product stock counts by location
    const { data: stockData, error } = await supabase
      .from("product_stock_locations")
      .select("location_id, quantity");

    if (error) {
      console.error("Error fetching stock data:", error);
      return locations;
    }

    // Create a map of location to total quantity
    const locationStockMap = new Map<string, number>();
    stockData?.forEach((stock) => {
      const current = locationStockMap.get(stock.location_id) || 0;
      locationStockMap.set(stock.location_id, current + (stock.quantity || 0));
    });

    // Function to calculate total count including descendants
    const calculateTotalCount = (
      locationId: string,
      locationMap: Map<string, LocationTreeItem>
    ): number => {
      const location = locationMap.get(locationId);
      if (!location) return 0;

      let totalCount = locationStockMap.get(locationId) || 0;

      // Add counts from all descendants
      const descendants = locations.filter((l) => l.parent_id === locationId);
      descendants.forEach((child) => {
        totalCount += calculateTotalCount(child.id, locationMap);
      });

      return totalCount;
    };

    // Create a map for quick location lookup
    const locationMap = new Map(locations.map((loc) => [loc.id, loc]));

    // Update product counts for all locations
    return locations.map((location) => ({
      ...location,
      productCount: calculateTotalCount(location.id, locationMap),
    }));
  };

  React.useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", activeBranchId)
        .is("deleted_at", null);

      if (error) {
        console.error("Error fetching locations:", error);
        toast.error("Błąd podczas ładowania lokalizacji.");
        setLocations([]);
      } else {
        const locationsWithCounts = await calculateLocationProductCounts(
          data as LocationTreeItem[]
        );
        setLocations(locationsWithCounts);
      }
      setLoading(false);
    };

    if (activeBranchId) {
      fetchLocations();
    } else {
      setLocations([]);
      setLoading(false);
    }
  }, [activeBranchId]);

  const branchLocations = locations;

  const locationTree = React.useMemo(() => {
    const filtered = searchQuery
      ? branchLocations.filter(
          (loc) =>
            loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.code?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : branchLocations;

    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0;
      if (sortKey === "name") {
        compareValue = a.name.localeCompare(b.name);
      } else if (sortKey === "code") {
        compareValue = (a.code || "").localeCompare(b.code || "");
      } else if (sortKey === "created_at") {
        compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return buildLocationTree(sorted);
  }, [branchLocations, searchQuery, sortKey, sortOrder, activeBranchId]);

  const handleAddLocation = () => {
    setEditingLocation(undefined);
    setParentLocation(undefined);
    setIsDialogOpen(true);
  };

  const handleEditLocation = (location: LocationTreeItem) => {
    setEditingLocation(location);
    setParentLocation(undefined);
    setIsDialogOpen(true);
  };

  const handleAddChildLocation = (parent: LocationTreeItem) => {
    setEditingLocation(undefined);
    setParentLocation(parent);
    setIsDialogOpen(true);
  };

  const handleDeleteLocation = async (location: LocationTreeItem) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("locations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", location.id);

    if (error) {
      console.error("Error deleting location:", error);
      toast.error("Błąd podczas usuwania lokalizacji.");
    } else {
      setLocations((prev) => prev.filter((loc) => loc.id !== location.id));
      toast.success(`Lokalizacja "${location.name}" została usunięta.`);
    }
  };

  const handleMoveLocation = (location: LocationTreeItem) => {
    setMovingLocation(location);
    setIsMoveDialogOpen(true);
  };

  const handleConfirmMove = async (locationId: string, newParentId: string | null) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("locations")
      .update({ parent_id: newParentId })
      .eq("id", locationId);

    if (error) {
      console.error("Error moving location:", error);
      toast.error("Błąd podczas przenoszenia lokalizacji.");
    } else {
      // Re-fetch locations to update the tree
      const { data: newLocations, error: fetchError } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", activeBranchId)
        .is("deleted_at", null);

      if (fetchError) {
        console.error("Error re-fetching locations:", fetchError);
      } else {
        const locationsWithCounts = await calculateLocationProductCounts(
          newLocations as LocationTreeItem[]
        );
        setLocations(locationsWithCounts);
      }

      const movingLoc = locations.find((l) => l.id === locationId);
      toast.success(`Lokalizacja "${movingLoc?.name}" została przeniesiona.`);
    }
  };

  const handleSaveLocation = async (data: any) => {
    const supabase = createClient();
    // Destructure to exclude image_file from the data sent to Supabase
    if (data.image_file) {
      delete data.image_file;
    }
    const locationDataToSave = data;

    if (editingLocation) {
      const { error } = await supabase
        .from("locations")
        .update(locationDataToSave)
        .eq("id", editingLocation.id);

      if (error) {
        console.error("Error updating location:", error);
        toast.error("Błąd podczas aktualizacji lokalizacji.");
      } else {
        toast.success(`Lokalizacja "${data.name}" została zaktualizowana.`);
      }
    } else {
      const { error } = await supabase.from("locations").insert({
        ...locationDataToSave,
        branch_id: activeBranchId,
        parent_id: parentLocation?.id || null,
      });

      if (error) {
        console.error("Error adding location:", error);
        toast.error("Błąd podczas dodawania lokalizacji.");
      } else {
        toast.success(`Lokalizacja "${data.name}" została dodana.`);
      }
    }
    // Re-fetch locations to update the tree
    const { data: newLocations, error } = await supabase
      .from("locations")
      .select("*")
      .eq("branch_id", activeBranchId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error re-fetching locations:", error);
    } else {
      const locationsWithCounts = await calculateLocationProductCounts(
        newLocations as LocationTreeItem[]
      );
      setLocations(locationsWithCounts);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Lokalizacje</h1>
          </div>
          <p className="text-sm text-muted-foreground md:text-base">
            Zarządzanie strukturą lokalizacji magazynowych w wybranym oddziale
          </p>
        </div>
      </motion.div>

      {/* Search and Sort */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="relative flex-grow">
                <h3 className="mb-2 text-sm font-medium">Wyszukiwanie</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj lokalizacji po nazwie lub kodzie..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Sortowanie</h3>
                <div className="flex items-center gap-2">
                  <Select
                    value={sortKey}
                    onValueChange={(value: "name" | "code" | "created_at") => setSortKey(value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sortuj według" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nazwa</SelectItem>
                      <SelectItem value="code">Kod</SelectItem>
                      <SelectItem value="created_at">Data utworzenia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    <ArrowUpDown className={sortOrder === "asc" ? "rotate-180" : ""} />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Location Tree */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center justify-between text-base md:text-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Struktura lokalizacji
                  {activeBranchName && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {activeBranchName}
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription className="text-sm">
                Hierarchiczna struktura lokalizacji magazynowych w oddziale
              </CardDescription>
            </div>
            <Button onClick={handleAddLocation} className="h-9 md:h-10" variant="themed">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Dodaj lokalizację</span>
              <span className="sm:hidden">Dodaj</span>
            </Button>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground md:py-12">
                <Loader className="mx-auto mb-4 h-12 w-12 opacity-50 md:h-16 md:w-16" />
                <h3 className="mb-2 text-base font-medium md:text-lg">Ładowanie lokalizacji...</h3>
              </div>
            ) : locationTree.length > 0 ? (
              <>
                {/* Desktop Tree - Hidden on mobile */}
                <div className="hidden lg:block">
                  <LocationTree
                    locations={locationTree}
                    onEdit={handleEditLocation}
                    onAddChild={handleAddChildLocation}
                    onDelete={handleDeleteLocation}
                    onMove={handleMoveLocation}
                  />
                </div>

                {/* Mobile Tree - Hidden on desktop */}
                <div className="lg:hidden">
                  <LocationTreeMobile
                    locations={locationTree}
                    onEdit={handleEditLocation}
                    onAddChild={handleAddChildLocation}
                    onDelete={handleDeleteLocation}
                    onMove={handleMoveLocation}
                  />
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground md:py-12">
                <MapPin className="mx-auto mb-4 h-12 w-12 opacity-50 md:h-16 md:w-16" />
                <h3 className="mb-2 text-base font-medium md:text-lg">
                  {searchQuery ? "Brak wyników" : "Brak lokalizacji"}
                </h3>
                <p className="mb-4 text-sm md:text-base">
                  {searchQuery
                    ? "Nie znaleziono lokalizacji pasujących do wyszukiwania."
                    : `Dodaj pierwszą lokalizację w oddziale ${activeBranchName || "aktywnym"}.`}
                </p>
                {!searchQuery && (
                  <Button onClick={handleAddLocation}>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj pierwszą lokalizację
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Location Form Dialog */}
      <LocationFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        location={editingLocation}
        parentLocation={parentLocation}
        onSave={handleSaveLocation}
      />

      {/* Move Location Dialog */}
      <MoveLocationDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        location={movingLocation}
        allLocations={locations}
        onMove={handleConfirmMove}
      />
    </div>
  );
}
