"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, MapPinOff, Archive, QrCode, ChevronRight, Ruler } from "lucide-react";
import { MappingStatusBadge } from "./mapping-status-badge";
import { RemoveFromMapDialog } from "./remove-from-map-dialog";
import { ArchiveLocationDialog } from "./archive-location-dialog";
import { useRemoveVisualNodeMutation } from "@/hooks/queries/warehouse/location-visual-nodes";
import {
  useValidateArchiveLocationQuery,
  useArchiveLocationMutation,
} from "@/hooks/queries/warehouse/locations-v2";
import type { LocationV2, LocationVisualNode } from "@/lib/types/warehouse/locations-v2";

interface LocationObjectPanelProps {
  location: LocationV2;
  visualNode?: LocationVisualNode | null;
  layoutId: string;
  branchId: string;
  onDeselect?: () => void;
}

export function LocationObjectPanel({
  location,
  visualNode,
  layoutId,
  branchId,
  onDeselect,
}: LocationObjectPanelProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const removeNode = useRemoveVisualNodeMutation(layoutId, branchId);
  const archiveMutation = useArchiveLocationMutation(branchId);
  const { data: archiveValidation } = useValidateArchiveLocationQuery(
    archiveOpen ? location.id : null
  );

  function handleRemoveFromMap() {
    if (!visualNode) return;
    removeNode.mutate(visualNode.id, {
      onSuccess: () => {
        setRemoveOpen(false);
        onDeselect?.();
      },
    });
  }

  function handleArchive() {
    archiveMutation.mutate(location.id, {
      onSuccess: () => {
        setArchiveOpen(false);
        onDeselect?.();
      },
    });
  }

  const dimLabel = [
    location.width_mm && `W: ${fmtMm(location.width_mm)}`,
    location.depth_mm && `D: ${fmtMm(location.depth_mm)}`,
    location.height_mm && `H: ${fmtMm(location.height_mm)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const visualDimLabel = visualNode
    ? `${fmtMm(visualNode.width_mm)} × ${fmtMm(visualNode.height_mm)}`
    : null;

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="space-y-1">
            {location.code && (
              <p className="text-xs font-mono text-muted-foreground">{location.code}</p>
            )}
            <h3 className="text-base font-semibold leading-tight">{location.name}</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">
                {location.location_category?.replace("_", " ")}
              </Badge>
              {location.can_store_inventory && (
                <Badge
                  variant="outline"
                  className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50"
                >
                  <Package className="h-3 w-3 mr-1" />
                  Inventory
                </Badge>
              )}
              {/* mapping status shown in status section below */}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm">Location</span>
              <Badge
                variant="outline"
                className={
                  location.status === "archived"
                    ? "border-red-200 text-red-700 bg-red-50"
                    : location.status === "inactive"
                      ? "border-amber-200 text-amber-700 bg-amber-50"
                      : "border-emerald-200 text-emerald-700 bg-emerald-50"
                }
              >
                {location.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Map</span>
              {visualNode ? (
                <MappingStatusBadge status="mapped" />
              ) : (
                <MappingStatusBadge status="unmapped" />
              )}
            </div>
          </div>

          {/* Dimensions */}
          {dimLabel && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dimensions
                </p>
                <div className="flex items-center gap-1.5 text-sm">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{dimLabel}</span>
                </div>
                {visualDimLabel && (
                  <p className="text-xs text-muted-foreground">
                    Visual footprint: {visualDimLabel}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Canvas position */}
          {visualNode && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Position on canvas
                </p>
                <p className="text-sm text-muted-foreground">
                  X: {fmtMm(visualNode.x_mm)} · Y: {fmtMm(visualNode.y_mm)}
                </p>
              </div>
            </>
          )}

          {/* Inventory placeholder */}
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Inventory
            </p>
            <p className="text-xs text-muted-foreground italic">
              Inventory summary coming in Phase 7.
            </p>
          </div>

          {/* Actions */}
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Actions
            </p>

            {/* Open interior — Phase 5 placeholder */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-left"
              disabled
              title="Coming in Phase 5"
            >
              <span>Open interior view</span>
              <ChevronRight className="h-4 w-4 opacity-40" />
            </Button>

            {/* QR placeholder */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled
              title="QR code viewer coming soon"
            >
              <QrCode className="h-4 w-4 opacity-40" />
              <span>View QR code</span>
            </Button>

            {/* Remove from map */}
            {visualNode && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setRemoveOpen(true)}
              >
                <MapPinOff className="h-4 w-4" />
                <span>Remove from map</span>
              </Button>
            )}

            {/* Archive */}
            {location.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="h-4 w-4" />
                <span>Archive location</span>
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>

      <RemoveFromMapDialog
        locationName={location.name}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={handleRemoveFromMap}
        isPending={removeNode.isPending}
      />

      <ArchiveLocationDialog
        locationName={location.name}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onConfirm={handleArchive}
        isPending={archiveMutation.isPending}
        blockers={archiveValidation?.blockers}
        warnings={archiveValidation?.warnings}
      />
    </>
  );
}

function fmtMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2).replace(/\.?0+$/, "")}m`;
  return `${mm}mm`;
}
