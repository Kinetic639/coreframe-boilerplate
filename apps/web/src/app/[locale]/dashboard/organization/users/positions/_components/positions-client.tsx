"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Briefcase, Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MEMBERS_MANAGE } from "@/lib/constants/permissions";
import {
  usePositionsQuery,
  useCreatePositionMutation,
  useUpdatePositionMutation,
  useDeletePositionMutation,
} from "@/hooks/queries/organization";
import type { OrgPosition } from "@/server/services/organization.service";

interface PositionsClientProps {
  initialPositions: OrgPosition[];
}

type DialogMode = "create" | "edit" | null;

export function PositionsClient({ initialPositions }: PositionsClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: positions } = usePositionsQuery(initialPositions);
  const createMutation = useCreatePositionMutation();
  const updateMutation = useUpdatePositionMutation();
  const deleteMutation = useDeletePositionMutation();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingPosition, setEditingPosition] = useState<OrgPosition | null>(null);
  const [posName, setPosName] = useState("");
  const [posDesc, setPosDesc] = useState("");

  const canManage = can(MEMBERS_MANAGE);

  const openCreate = () => {
    setEditingPosition(null);
    setPosName("");
    setPosDesc("");
    setDialogMode("create");
  };

  const openEdit = (pos: OrgPosition) => {
    setEditingPosition(pos);
    setPosName(pos.name);
    setPosDesc(pos.description ?? "");
    setDialogMode("edit");
  };

  const handleSubmit = () => {
    if (!posName.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        { name: posName.trim(), description: posDesc || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    } else if (dialogMode === "edit" && editingPosition) {
      updateMutation.mutate(
        { positionId: editingPosition.id, name: posName.trim(), description: posDesc || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    }
  };

  const handleDelete = (pos: OrgPosition) => {
    deleteMutation.mutate({ positionId: pos.id }, { onSuccess: () => router.refresh() });
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Position
          </Button>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No positions found.</div>
      ) : (
        <div className="space-y-2">
          {positions.map((pos) => (
            <div
              key={pos.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{pos.name}</p>
                  {pos.description && (
                    <p className="text-xs text-muted-foreground">{pos.description}</p>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(pos)}
                    disabled={isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(pos)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Create Position" : "Edit Position"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pos-name">Name</Label>
              <Input
                id="pos-name"
                value={posName}
                onChange={(e) => setPosName(e.target.value)}
                placeholder="Position title"
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-desc">Description</Label>
              <Textarea
                id="pos-desc"
                value={posDesc}
                onChange={(e) => setPosDesc(e.target.value)}
                placeholder="Optional description"
                maxLength={300}
                rows={2}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !posName.trim()}>
              {isPending ? "Saving…" : dialogMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
