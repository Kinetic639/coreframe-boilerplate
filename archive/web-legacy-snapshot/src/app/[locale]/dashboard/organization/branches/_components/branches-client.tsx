"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { BRANCHES_CREATE, BRANCHES_UPDATE, BRANCHES_DELETE } from "@/lib/constants/permissions";
import {
  useBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
} from "@/hooks/queries/organization";
import type { OrgBranch } from "@/server/services/organization.service";

interface BranchesClientProps {
  initialBranches: OrgBranch[];
}

type DialogMode = "create" | "edit" | null;

export function BranchesClient({ initialBranches }: BranchesClientProps) {
  const router = useRouter();
  const { can } = usePermissions();

  const { data: branches } = useBranchesQuery(initialBranches);
  const createMutation = useCreateBranchMutation();
  const updateMutation = useUpdateBranchMutation();
  const deleteMutation = useDeleteBranchMutation();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingBranch, setEditingBranch] = useState<OrgBranch | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("");

  const canCreate = can(BRANCHES_CREATE);
  const canUpdate = can(BRANCHES_UPDATE);
  const canDelete = can(BRANCHES_DELETE);

  const openCreate = () => {
    setEditingBranch(null);
    setBranchName("");
    setBranchSlug("");
    setDialogMode("create");
  };

  const openEdit = (branch: OrgBranch) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
    setBranchSlug(branch.slug ?? "");
    setDialogMode("edit");
  };

  const handleSubmit = () => {
    if (!branchName.trim()) return;
    if (dialogMode === "create") {
      createMutation.mutate(
        { name: branchName.trim(), slug: branchSlug || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    } else if (dialogMode === "edit" && editingBranch) {
      updateMutation.mutate(
        { branchId: editingBranch.id, name: branchName.trim(), slug: branchSlug || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            router.refresh();
          },
        }
      );
    }
  };

  const handleDelete = (branch: OrgBranch) => {
    deleteMutation.mutate({ branchId: branch.id }, { onSuccess: () => router.refresh() });
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Branch
          </Button>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No branches found.</div>
      ) : (
        <div className="space-y-2">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{branch.name}</p>
                  {branch.slug && (
                    <Badge variant="outline" className="text-xs mt-0.5">
                      {branch.slug}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(branch)}
                    disabled={isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(branch)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create Branch" : "Edit Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch name"
                maxLength={200}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-slug">Slug</Label>
              <Input
                id="branch-slug"
                value={branchSlug}
                onChange={(e) =>
                  setBranchSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="branch-slug (optional)"
                maxLength={100}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !branchName.trim()}>
              {isPending ? "Saving…" : dialogMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
