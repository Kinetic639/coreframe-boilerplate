"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MEMBERS_MANAGE } from "@/lib/constants/permissions";
import {
  usePositionsQuery,
  useCreatePositionMutation,
  useUpdatePositionMutation,
  useDeletePositionMutation,
} from "@/hooks/queries/organization";
import type { OrgPosition } from "@/server/services/organization.service";
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortPositions, paginatePositions } from "../_utils/data-view";

const POSITIONS_DV_KEY = ["org-positions-dataview"];

interface PositionsClientProps {
  initialData: PaginatedResult<OrgPosition>;
  allPositions: OrgPosition[];
}

type DialogMode = "create" | "edit" | null;

export function PositionsClient({
  initialData,
  allPositions: initialAllPositions,
}: PositionsClientProps) {
  const t = useTranslations("modules.organizationManagement.positions");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const allRef = useRef(initialAllPositions);
  allRef.current = initialAllPositions;

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<OrgPosition>> => {
      const filtered = filterSortPositions(allRef.current, params);
      return paginatePositions(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<OrgPosition | null> =>
      allRef.current.find((p) => p.id === id) ?? null,
    []
  );

  // Keep React Query cache in sync for mutations that use the existing hooks
  usePositionsQuery(initialAllPositions);

  const createMutation = useCreatePositionMutation();
  const updateMutation = useUpdatePositionMutation();
  const deleteMutation = useDeletePositionMutation();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const canManage = can(MEMBERS_MANAGE);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingPosition, setEditingPosition] = useState<OrgPosition | null>(null);
  const [posName, setPosName] = useState("");
  const [posDesc, setPosDesc] = useState("");

  const refreshAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: POSITIONS_DV_KEY });
    router.refresh();
  };

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
            void refreshAfterMutation();
          },
        }
      );
    } else if (dialogMode === "edit" && editingPosition) {
      updateMutation.mutate(
        { positionId: editingPosition.id, name: posName.trim(), description: posDesc || null },
        {
          onSuccess: () => {
            setDialogMode(null);
            void refreshAfterMutation();
          },
        }
      );
    }
  };

  const handleDelete = (pos: OrgPosition) => {
    deleteMutation.mutate({ positionId: pos.id }, { onSuccess: () => void refreshAfterMutation() });
  };

  const columns = useMemo<DataViewColumnDef<OrgPosition>[]>(
    () => [
      {
        key: "name",
        header: t("columns.name"),
        accessor: (row) => (
          <div className="flex items-center gap-2 py-1">
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground">{row.name}</span>
          </div>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "description",
        header: t("columns.description"),
        accessor: (row) =>
          row.description ? (
            <span className="text-sm text-muted-foreground truncate">{row.description}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        defaultVisible: true,
      },
    ],
    [t]
  );

  const renderCompactItem = useCallback(
    (row: OrgPosition) => (
      <div className="flex items-center gap-2 py-0.5">
        <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{row.name}</span>
      </div>
    ),
    []
  );

  const renderDetail = useCallback(
    (pos: OrgPosition) => (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{pos.name}</h2>
            {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.description")}
            </p>
            <span>
              {pos.description ?? (
                <span className="text-muted-foreground">{t("detail.noDescription")}</span>
              )}
            </span>
          </div>
          <div className="col-span-2">
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("detail.id")}
            </p>
            <span className="break-all font-mono text-xs text-muted-foreground">{pos.id}</span>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => openEdit(pos)} disabled={isPending}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(pos)}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("actions.delete")}
            </Button>
          </div>
        )}
      </div>
    ),
    [t, canManage, isPending]
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("createButton")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <DataView<OrgPosition, OrgPosition>
          entity="org-positions"
          columns={columns}
          initialData={initialData}
          queryKey={POSITIONS_DV_KEY}
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
              <Label htmlFor="pos-name">{t("dialog.name")}</Label>
              <Input
                id="pos-name"
                value={posName}
                onChange={(e) => setPosName(e.target.value)}
                placeholder={t("dialog.namePlaceholder")}
                maxLength={100}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-desc">{t("dialog.description")}</Label>
              <Textarea
                id="pos-desc"
                value={posDesc}
                onChange={(e) => setPosDesc(e.target.value)}
                placeholder={t("dialog.descriptionPlaceholder")}
                maxLength={300}
                rows={2}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !posName.trim()}>
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
