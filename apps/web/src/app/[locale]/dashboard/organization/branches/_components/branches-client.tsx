"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Building2, Plus, Pencil, Trash2, Map } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { BRANCHES_CREATE, BRANCHES_UPDATE, BRANCHES_DELETE } from "@/lib/constants/permissions";
import {
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
} from "@/hooks/queries/organization";
import type { OrgBranch } from "@/server/services/organization.service";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { listBranchesAction } from "@/app/actions/organization/branches";
import { filterSortBranches, paginateBranches } from "../_utils/branches-data-view";

const BRANCHES_DV_QUERY_KEY = ["org-branches-dataview"];

interface BranchesClientProps {
  initialData: PaginatedResult<OrgBranch>;
  allBranches: OrgBranch[];
}

type DialogMode = "create" | "edit" | null;

export function BranchesClient({
  initialData,
  allBranches: initialAllBranches,
}: BranchesClientProps) {
  const t = useTranslations("modules.organizationManagement.branches");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const allBranchesRef = useRef(initialAllBranches);
  allBranchesRef.current = initialAllBranches;

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<OrgBranch>> => {
      const filtered = filterSortBranches(allBranchesRef.current, params);
      return paginateBranches(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<OrgBranch | null> =>
      allBranchesRef.current.find((b) => b.id === id) ?? null,
    []
  );

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

  const refreshAfterMutation = async () => {
    const result = await listBranchesAction();
    if (result.success) {
      allBranchesRef.current = (result as { success: true; data: OrgBranch[] }).data;
    }
    await queryClient.invalidateQueries({ queryKey: BRANCHES_DV_QUERY_KEY });
    router.refresh();
  };

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
            void refreshAfterMutation();
          },
        }
      );
    } else if (dialogMode === "edit" && editingBranch) {
      updateMutation.mutate(
        { branchId: editingBranch.id, name: branchName.trim(), slug: branchSlug || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            void refreshAfterMutation();
          },
        }
      );
    }
  };

  const handleDelete = (branch: OrgBranch) => {
    deleteMutation.mutate(
      { branchId: branch.id },
      { onSuccess: () => void refreshAfterMutation() }
    );
  };

  const columns: DataViewColumnDef<OrgBranch>[] = [
    {
      key: "name",
      header: t("columns.name"),
      accessor: (row) => (
        <div className="flex items-center gap-2 py-1">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground">{row.name}</span>
        </div>
      ),
      sortable: true,
      defaultVisible: true,
    },
    {
      key: "slug",
      header: t("columns.slug"),
      accessor: (row) =>
        row.slug ? (
          <Badge variant="outline" className="font-mono text-xs">
            {row.slug}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortable: true,
      defaultVisible: true,
      compactLabel: true,
    },
    {
      key: "public_warehouse_maps_enabled",
      header: t("columns.publicMaps"),
      accessor: (row) =>
        row.public_warehouse_maps_enabled ? (
          <Badge variant="default" className="text-xs">
            <Map className="mr-1 h-3 w-3" />
            {t("columns.publicMaps")}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      defaultVisible: true,
    },
    {
      key: "created_at",
      header: t("columns.created"),
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
        </span>
      ),
      sortable: true,
      defaultVisible: true,
    },
  ];

  const filters: DataViewFilterDef[] = [
    {
      type: "text",
      key: "slug",
      label: t("filters.slug"),
    },
    {
      type: "boolean",
      key: "publicMapsEnabled",
      label: t("filters.publicMaps"),
    },
    {
      type: "date-range",
      key: "createdRange",
      label: t("filters.created"),
      fromKey: "createdFrom",
      toKey: "createdTo",
    },
  ];

  const renderCompactItem = (row: OrgBranch) => (
    <div className="flex items-center gap-2 py-0.5">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm font-medium">{row.name}</span>
      {row.slug && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.slug}</span>
      )}
    </div>
  );

  const renderDetail = (branch: OrgBranch) => (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{branch.name}</h2>
          {branch.slug && <p className="font-mono text-sm text-muted-foreground">{branch.slug}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.slug")}
          </p>
          {branch.slug ? (
            <Badge variant="outline" className="font-mono text-xs">
              {branch.slug}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.publicMaps")}
          </p>
          {branch.public_warehouse_maps_enabled ? (
            <Badge variant="default" className="text-xs">
              <Map className="mr-1 h-3 w-3" />
              {t("detail.publicMaps")}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.created")}
          </p>
          <span>{branch.created_at ? new Date(branch.created_at).toLocaleString() : "—"}</span>
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.id")}
          </p>
          <span className="break-all font-mono text-xs text-muted-foreground">{branch.id}</span>
        </div>
      </div>

      {(canUpdate || canDelete) && (
        <div className="flex gap-2 border-t pt-3">
          {canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEdit(branch)}
              disabled={isPending}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.edit")}
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(branch)}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.delete")}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("createButton")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <DataView<OrgBranch, OrgBranch>
          entity="org-branches"
          columns={columns}
          filters={filters}
          initialData={initialData}
          queryKey={BRANCHES_DV_QUERY_KEY}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.id}
          renderCompactItem={renderCompactItem}
          renderDetail={renderDetail}
          className="h-full"
        />
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? t("dialog.titleCreate") : t("dialog.titleEdit")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="branch-name">{t("dialog.name")}</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={t("dialog.namePlaceholder")}
                maxLength={200}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-slug">{t("dialog.slug")}</Label>
              <Input
                id="branch-slug"
                value={branchSlug}
                onChange={(e) =>
                  setBranchSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder={t("dialog.slugPlaceholder")}
                maxLength={100}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("dialog.slugHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !branchName.trim()}>
              {isPending
                ? t("dialog.saving")
                : dialogMode === "create"
                  ? t("dialog.create")
                  : t("dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
