"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { Plus, Search, MapPin, Building2, Loader } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/badge";
import { buildLocationTree } from "@/modules/warehouse/utils/buildLocationstree";
import { LocationTree } from "@/modules/warehouse/locations/location-tree";
import { LocationTreeMobile } from "@/modules/warehouse/locations/location-tree-mobile";
import { LocationFormDialog } from "@/modules/warehouse/locations/location-form-dialog";
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
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<LocationTreeItem | undefined>();
  const [parentLocation, setParentLocation] = React.useState<LocationTreeItem | undefined>();
  const [locations, setLocations] = React.useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = React.useState(true);

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
      } else {
        setLocations(data as LocationTreeItem[]);
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

    return buildLocationTree(filtered);
  }, [branchLocations, searchQuery, activeBranchId]);

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

  const handleSaveLocation = async (data: any) => {
    const supabase = createClient();
    if (editingLocation) {
      const { error } = await supabase.from("locations").update(data).eq("id", editingLocation.id);

      if (error) {
        console.error("Error updating location:", error);
        toast.error("Błąd podczas aktualizacji lokalizacji.");
      } else {
        toast.success(`Lokalizacja "${data.name}" została zaktualizowana.`);
      }
    } else {
      const { error } = await supabase.from("locations").insert({
        ...data,
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
      setLocations(newLocations as LocationTreeItem[]);
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
            {activeBranchName && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {activeBranchName}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground md:text-base">
            Zarządzanie strukturą lokalizacji magazynowych w aktywnym oddziale
          </p>
        </div>
        <Button onClick={handleAddLocation} className="h-9 md:h-10">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Dodaj lokalizację</span>
          <span className="sm:hidden">Dodaj</span>
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Wyszukiwanie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Szukaj lokalizacji po nazwie lub kodzie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <MapPin className="h-5 w-5" />
              Struktura lokalizacji
              {activeBranchName && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {activeBranchName}
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              Hierarchiczna struktura wszystkich lokalizacji magazynowych w aktywnym oddziale
            </CardDescription>
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
                  />
                </div>

                {/* Mobile Tree - Hidden on desktop */}
                <div className="lg:hidden">
                  <LocationTreeMobile
                    locations={locationTree}
                    onEdit={handleEditLocation}
                    onAddChild={handleAddChildLocation}
                    onDelete={handleDeleteLocation}
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
    </div>
  );
}
