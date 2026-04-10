"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

function StatusBadge({
  status,
  t,
}: {
  status: WarehouseLayout["status"];
  t: ReturnType<typeof useTranslations>;
}) {
  if (status === "published") {
    return (
      <Badge variant="default" className="gap-1 bg-emerald-600 text-xs">
        <Globe className="h-3 w-3" />
        {t("badges.published")}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <FileText className="h-3 w-3" />
      {t("badges.draft")}
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
  const t = useTranslations("warehouseMapListPage");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [codeError, setCodeError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setCodeError(t("createDialog.validation.codeRequired"));
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      setCodeError(t("createDialog.validation.codeInvalid"));
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
            <DialogTitle>{t("createDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layout-name">{t("createDialog.fields.name")}</Label>
              <Input
                id="layout-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("createDialog.placeholders.name")}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-code">
                {t("createDialog.fields.rootLocationCode")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="layout-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                placeholder={t("createDialog.placeholders.rootLocationCode")}
                className="font-mono"
                maxLength={20}
              />
              {codeError ? (
                <p className="text-xs text-destructive">{codeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("createDialog.help.rootLocationCode")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-desc">{t("createDialog.fields.description")}</Label>
              <Textarea
                id="layout-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("createDialog.placeholders.description")}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || !code.trim() || isPending}>
              {isPending ? t("actions.creating") : t("actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapListClient({ initialLayouts }: MapListClientProps) {
  const t = useTranslations("warehouseMapListPage");
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
        {t("states.noPermission")}
      </div>
    );
  }

  if (!activeBranchId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Map className="h-8 w-8" />
        <p>{t("states.noBranch")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("actions.newLayout")}
          </Button>
        )}
      </div>

      {/* Layout grid */}
      {layouts.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
          <Map className="h-10 w-10 opacity-40" />
          <p className="text-sm">{t("states.emptyTitle")}</p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("actions.createFirstLayout")}
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
                <StatusBadge status={layout.status} t={t} />
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
                  {t("actions.openEditor")}
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
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteLayout.isPending}
            >
              {deleteLayout.isPending ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
