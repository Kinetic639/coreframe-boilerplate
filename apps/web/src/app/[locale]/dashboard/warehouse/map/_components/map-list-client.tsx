"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Plus, Pencil, Trash2, Globe, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { WAREHOUSE_LAYOUTS_READ, WAREHOUSE_LAYOUTS_MANAGE } from "@/lib/constants/permissions";
import {
  useWarehouseLayoutsQuery,
  useCreateLayoutMutation,
  useDeleteLayoutMutation,
} from "@/hooks/queries/warehouse";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapListClientProps {
  initialLayouts: WarehouseLayout[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WarehouseLayout["status"] }) {
  if (status === "published") {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600 text-xs">
        <Globe className="h-3 w-3" />
        Published
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <FileText className="h-3 w-3" />
      Draft
    </Badge>
  );
}

// ─── Create dialog ─────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string, code: string, description: string) => void;
  isPending: boolean;
}

function CreateLayoutDialog({ open, onOpenChange, onSubmit, isPending }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [codeError, setCodeError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setCodeError("Code is required");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      setCodeError("Letters, numbers, hyphens and underscores only");
      return;
    }
    setCodeError("");
    onSubmit(name.trim(), trimmedCode.toUpperCase(), description.trim());
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setName("");
      setCode("");
      setDescription("");
      setCodeError("");
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Layout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layout-name">Name</Label>
              <Input
                id="layout-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Floor"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-code">
                Root Location Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="layout-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                placeholder="e.g. WH-MAIN"
                className="font-mono"
                maxLength={20}
              />
              {codeError ? (
                <p className="text-xs text-destructive">{codeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Unique identifier for the root location (letters, numbers, hyphens, underscores)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-desc">Description (optional)</Label>
              <Textarea
                id="layout-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this layout"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !code.trim() || isPending}>
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapListClient({ initialLayouts }: MapListClientProps) {
  const router = useRouter();
  const activeBranchId = useAppStoreV2((s) => s.activeBranchId);
  const { can } = usePermissions();

  const canRead = can(WAREHOUSE_LAYOUTS_READ);
  const canManage = can(WAREHOUSE_LAYOUTS_MANAGE);

  const { data: layouts = initialLayouts } = useWarehouseLayoutsQuery(activeBranchId ?? undefined);

  const createLayout = useCreateLayoutMutation(activeBranchId ?? undefined);
  const deleteLayout = useDeleteLayoutMutation(activeBranchId ?? undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseLayout | null>(null);

  function handleCreate(name: string, code: string, description: string) {
    createLayout.mutate(
      { name, root_location_code: code, description: description || null },
      {
        onSuccess: (layout) => {
          setShowCreate(false);
          router.push(`/dashboard/warehouse/map/${layout.id}`);
        },
      }
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteLayout.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  if (!canRead) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        You don&apos;t have permission to view warehouse layouts.
      </div>
    );
  }

  if (!activeBranchId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Map className="h-8 w-8" />
        <p>Select a branch to view warehouse layouts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warehouse Maps</h1>
          <p className="text-sm text-muted-foreground">
            Visual layout editor for your warehouse floor plans.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Layout
          </Button>
        )}
      </div>

      {/* Layout grid */}
      {layouts.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <Map className="h-10 w-10 opacity-40" />
          <p className="text-sm">No layouts yet.</p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first layout
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout) => (
            <div
              key={layout.id}
              className="group relative flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{layout.name}</p>
                  {layout.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {layout.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={layout.status} />
              </div>

              {/* Canvas dimensions */}
              <p className="mt-2 text-xs text-muted-foreground">
                {layout.canvas_width_m}m × {layout.canvas_height_m}m
              </p>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => router.push(`/dashboard/warehouse/map/${layout.id}`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Open Editor
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(layout)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {canManage && (
        <CreateLayoutDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSubmit={handleCreate}
          isPending={createLayout.isPending}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete layout?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteLayout.isPending}
            >
              {deleteLayout.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
