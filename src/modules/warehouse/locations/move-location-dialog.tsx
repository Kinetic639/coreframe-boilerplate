"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface MoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationTreeItem | undefined;
  allLocations: LocationTreeItem[];
  onMove: (locationId: string, newParentId: string | null) => void;
}

export function MoveLocationDialog({
  open,
  onOpenChange,
  location,
  allLocations,
  onMove,
}: MoveLocationDialogProps) {
  const [selectedParentId, setSelectedParentId] = React.useState<string | null>(null);

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open && location) {
      setSelectedParentId((location as any).parent_id);
    }
  }, [open, location]);

  // Get all valid parent options (excluding the location itself and its descendants)
  const getValidParentOptions = (
    locationToMove: LocationTreeItem,
    allLocs: LocationTreeItem[]
  ): LocationTreeItem[] => {
    const getAllDescendantIds = (loc: LocationTreeItem): string[] => {
      const descendants = [loc.id];
      if (loc.children) {
        loc.children.forEach((child) => {
          descendants.push(...getAllDescendantIds(child));
        });
      }
      return descendants;
    };

    const excludedIds = getAllDescendantIds(locationToMove);
    return allLocs.filter((loc) => !excludedIds.includes(loc.id));
  };

  const validParentOptions = location ? getValidParentOptions(location, allLocations) : [];

  // Build tree structure for display
  const buildLocationDisplayTree = (
    locations: LocationTreeItem[],
    parentId: string | null = null,
    level: number = 0
  ): React.ReactNode[] => {
    const children = locations.filter((loc) => (loc as any).parent_id === parentId);

    return children.map((loc) => (
      <div key={loc.id} className="space-y-1">
        <div className="flex items-center space-x-2" style={{ paddingLeft: `${level * 20}px` }}>
          <RadioGroupItem value={loc.id} id={loc.id} />
          <Label
            htmlFor={loc.id}
            className={cn(
              "flex flex-1 cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/50",
              selectedParentId === loc.id && "bg-muted"
            )}
          >
            <div
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs text-white"
              style={{ backgroundColor: loc.color || "#6b7280" }}
            >
              <Icon name={(loc.icon_name || "MapPin") as any} className="h-3 w-3" />
            </div>
            <span className="font-medium">{loc.name}</span>
            {loc.code && (
              <Badge variant="outline" className="text-xs">
                {loc.code}
              </Badge>
            )}
          </Label>
        </div>
        {buildLocationDisplayTree(locations, loc.id, level + 1)}
      </div>
    ));
  };

  const handleMove = () => {
    if (location) {
      onMove(location.id, selectedParentId);
      onOpenChange(false);
    }
  };

  const isParentChanged = selectedParentId !== (location as any)?.parent_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Przenieś lokalizację</DialogTitle>
          <DialogDescription>
            Wybierz nową lokalizację nadrzędną dla lokalizacji "{location?.name}". Lokalizacja
            zostanie przeniesiona wraz ze wszystkimi podlokalizacjami.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {location && (
            <div className="space-y-4">
              {/* Current location info */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-2 font-medium">Przenoszona lokalizacja:</h4>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-white"
                    style={{ backgroundColor: location.color || "#6b7280" }}
                  >
                    <Icon name={(location.icon_name || "MapPin") as any} className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{location.name}</span>
                  {location.code && (
                    <Badge variant="outline" className="text-xs">
                      {location.code}
                    </Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedParentId
                      ? validParentOptions.find((p) => p.id === selectedParentId)?.name ||
                        "Nieznana lokalizacja"
                      : "Poziom główny"}
                  </span>
                </div>
              </div>

              {/* Parent location selection */}
              <div>
                <h4 className="mb-3 font-medium">Wybierz nową lokalizację nadrzędną:</h4>
                <RadioGroup
                  value={selectedParentId || "root"}
                  onValueChange={(value) => setSelectedParentId(value === "root" ? null : value)}
                >
                  {/* Root level option */}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="root" id="root" />
                    <Label
                      htmlFor="root"
                      className={cn(
                        "flex flex-1 cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted/50",
                        selectedParentId === null && "bg-muted"
                      )}
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
                        <Icon name="Home" className="h-3 w-3" />
                      </div>
                      <span className="font-medium">Poziom główny</span>
                      <Badge variant="secondary" className="text-xs">
                        ROOT
                      </Badge>
                    </Label>
                  </div>

                  {/* Tree structure */}
                  <div className="space-y-1">{buildLocationDisplayTree(validParentOptions)}</div>
                </RadioGroup>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleMove} disabled={!isParentChanged} variant="themed">
            Przenieś lokalizację
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
