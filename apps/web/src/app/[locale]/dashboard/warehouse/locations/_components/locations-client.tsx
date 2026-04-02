"use client";

import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { WAREHOUSE_LOCATIONS_READ, WAREHOUSE_LOCATIONS_MANAGE } from "@/lib/constants/permissions";
import {
  useWarehouseLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} from "@/hooks/queries/warehouse";
import { buildLocationTree } from "@/lib/warehouse/location-tree";
import type { WarehouseLocation, WarehouseLocationTreeNode } from "@/lib/warehouse/location-tree";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";
import { LocationFormDialog } from "@/app/[locale]/dashboard/warehouse/locations/_components/location-form-dialog";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationsClientProps {
  initialLocations: WarehouseLocation[];
}

// ─── Tree node row ─────────────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: WarehouseLocationTreeNode;
  depth: number;
  canManage: boolean;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
}

function TreeNodeRow({ node, depth, canManage, onEdit, onDelete }: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Color dot */}
        {node.color ? (
          <div
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: node.color }}
          />
        ) : (
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/50" />
        )}

        {/* Name + code */}
        <span className="flex-1 text-sm font-medium">{node.name}</span>
        {node.code && <span className="text-xs text-muted-foreground">{node.code}</span>}

        {/* Actions */}
        {canManage && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(node)}
              aria-label={`Edit ${node.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(node)}
              aria-label={`Delete ${node.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            canManage={canManage}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationsClient({ initialLocations }: LocationsClientProps) {
  const { can } = usePermissions();
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);

  const canRead = can(WAREHOUSE_LOCATIONS_READ);
  const canManage = can(WAREHOUSE_LOCATIONS_MANAGE);

  const { data: locations = initialLocations } = useWarehouseLocationsQuery(
    activeBranchId,
    initialLocations
  );

  const createMutation = useCreateLocationMutation(activeBranchId);
  const updateMutation = useUpdateLocationMutation(activeBranchId);
  const deleteMutation = useDeleteLocationMutation(activeBranchId);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocation | null>(null);

  const tree = buildLocationTree(locations);

  // Parents available to select: exclude the location being edited (to prevent self-parenting)
  const availableParents = editingLocation
    ? locations.filter((l) => l.id !== editingLocation.id)
    : locations;

  function handleCreate() {
    setEditingLocation(null);
    setFormOpen(true);
  }

  function handleEdit(location: WarehouseLocation) {
    setEditingLocation(location);
    setFormOpen(true);
  }

  function handleDelete(location: WarehouseLocation) {
    setDeletingLocation(location);
  }

  function handleFormSubmit(data: CreateLocationInput | (UpdateLocationInput & { id: string })) {
    if ("id" in data) {
      updateMutation.mutate(data as UpdateLocationInput & { id: string }, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createMutation.mutate(data as CreateLocationInput, {
        onSuccess: () => setFormOpen(false),
      });
    }
  }

  function handleConfirmDelete() {
    if (!deletingLocation) return;
    deleteMutation.mutate(deletingLocation.id, {
      onSuccess: () => setDeletingLocation(null),
    });
  }

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          You do not have permission to view locations.
        </p>
      </div>
    );
  }

  if (!activeBranchId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No branch selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a branch to view its warehouse locations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage the physical structure of your warehouse.
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        )}
      </div>

      {/* Tree */}
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <MapPin className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No locations yet</p>
          {canManage && (
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first location to organize this warehouse.
            </p>
          )}
          {canManage && (
            <Button onClick={handleCreate} className="mt-4" size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="group divide-y">
            {tree.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={0}
                canManage={canManage}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <LocationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        location={editingLocation}
        availableParents={availableParents}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingLocation}
        onOpenChange={(open) => !open && setDeletingLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingLocation?.name}</strong> will be soft-deleted. Any child locations
              will become root-level locations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
