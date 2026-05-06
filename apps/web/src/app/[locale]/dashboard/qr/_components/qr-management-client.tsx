"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, QrCode, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_CREATE, QR_REVOKE, QR_EXPORT } from "@/lib/constants/permissions";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { createQrBatchAction } from "@/app/actions/qr/create-batch";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { DataView } from "@/components/data-view/data-view";
import { useDataViewSelection } from "@/components/data-view/use-data-view";
import type {
  DataViewColumnDef,
  DataViewFilterDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import { filterSortQrCodes, paginateQrCodes, getQrStatus } from "../_utils/data-view";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

const QR_DV_KEY = ["qr-codes-dataview"];

// ---------------------------------------------------------------------------
// Detail panel — rendered inside DataViewProvider so it can read selection
// ---------------------------------------------------------------------------

interface QrDetailPanelProps {
  qr: QrCodeWithStatus;
  canRevoke: boolean;
  canExport: boolean;
  isRevoking: boolean;
  onRevoke: (id: string) => void;
  onDesign: (ids: string[]) => void;
  t: ReturnType<typeof useTranslations>;
}

function QrDetailPanel({
  qr,
  canRevoke,
  canExport,
  isRevoking,
  onRevoke,
  onDesign,
  t,
}: QrDetailPanelProps) {
  const { selectedRowIds, selectedRowCount } = useDataViewSelection();

  const displayStatus = getQrStatus(qr);
  const statusVariant = {
    assigned: "default",
    unassigned: "secondary",
    revoked: "destructive",
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
          <QrCode className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            {qr.label ?? (
              <span className="italic text-muted-foreground">{t("detail.unlabelled")}</span>
            )}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">{qr.token}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.status")}
          </p>
          <Badge variant={statusVariant[displayStatus]} className="text-xs capitalize">
            {t(`status.${displayStatus}` as Parameters<typeof t>[0])}
          </Badge>
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.created")}
          </p>
          <span>{new Date(qr.created_at).toLocaleDateString()}</span>
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.assignment")}
          </p>
          <span className="text-sm">
            {qr.assignment ? (
              qr.assignment.target_type
            ) : (
              <span className="text-muted-foreground">{t("detail.unassigned")}</span>
            )}
          </span>
        </div>
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("detail.id")}
          </p>
          <span className="break-all font-mono text-xs text-muted-foreground">{qr.id}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t pt-3">
        {canExport && selectedRowCount > 0 && (
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => onDesign(Object.keys(selectedRowIds))}
          >
            {t("detail.designButton", { count: selectedRowCount })}
          </Button>
        )}
        {canRevoke && qr.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => onRevoke(qr.id)}
            disabled={isRevoking}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t("detail.revokeButton")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  initialData: PaginatedResult<QrCodeWithStatus>;
  allCodes: QrCodeWithStatus[];
  permissionSnapshot: PermissionSnapshot;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QrManagementClient({
  initialData,
  allCodes: initialAllCodes,
  permissionSnapshot,
}: Props) {
  const t = useTranslations("modules.qr.management");

  const canCreate = checkPermission(permissionSnapshot, QR_CREATE);
  const canRevoke = checkPermission(permissionSnapshot, QR_REVOKE);
  const canExport = checkPermission(permissionSnapshot, QR_EXPORT);

  const allRef = useRef(initialAllCodes);
  allRef.current = initialAllCodes;

  // Client-side fetcher — zero latency, no server round-trip on filter/sort/page changes
  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<QrCodeWithStatus>> => {
      const filtered = filterSortQrCodes(allRef.current, params);
      return paginateQrCodes(filtered, params.page, params.pageSize);
    },
    []
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<QrCodeWithStatus | null> =>
      allRef.current.find((qr) => qr.id === id) ?? null,
    []
  );

  // Generate form
  const [generateCount, setGenerateCount] = useState(1);
  const [labelPrefix, setLabelPrefix] = useState("");
  const [isGenerating, startGenerate] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();

  // Two stages: select (DataView) ↔ design (LabelDesigner)
  const [activeStage, setActiveStage] = useState<"select" | "design">("select");
  const [designIds, setDesignIds] = useState<string[]>([]);
  const [labelFormat, setLabelFormat] = useState<"pdf" | "zpl">("pdf");

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [isRevoking, startRevoke] = useTransition();

  // ── Refresh from server ───────────────────────────────────────────────────────
  function handleRefresh() {
    startRefresh(async () => {
      const result = await listQrCodesAction();
      if (result.success) {
        allRef.current = result.data;
        // React Query cache for DataView will re-read from allRef on next render/invalidation
        // Force a re-render by triggering a page re-render with router.refresh() is optional here
        // since the DataView will use allRef.current on next listFetcher call
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  function handleGenerate() {
    startGenerate(async () => {
      const result = await createQrBatchAction({
        count: generateCount,
        labelPrefix: labelPrefix.trim() || undefined,
      });
      if (result.success) {
        toast.success(t("toasts.created", { count: result.data.length }));
        // Reload from server and update ref
        const fresh = await listQrCodesAction();
        if (fresh.success) allRef.current = fresh.data;
        setLabelPrefix("");
        setGenerateCount(1);
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  // ── Design ───────────────────────────────────────────────────────────────────
  const handleOpenDesign = useCallback((ids: string[]) => {
    setDesignIds(ids);
    setActiveStage("design");
  }, []);

  // ── Revoke ───────────────────────────────────────────────────────────────────
  function handleRevokeConfirm() {
    if (!revokeTarget) return;
    const id = revokeTarget;
    setRevokeTarget(null);
    startRevoke(async () => {
      const result = await revokeQrAction({ qrCodeId: id });
      if (result.success) {
        toast.success(t("toasts.revoked"));
        // Optimistic local update
        allRef.current = allRef.current.map((qr) =>
          qr.id === id ? { ...qr, status: "revoked" as const, assignment: null } : qr
        );
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  // ── DataView definitions ──────────────────────────────────────────────────────
  const columns = useMemo<DataViewColumnDef<QrCodeWithStatus>[]>(
    () => [
      {
        key: "label",
        header: t("table.label"),
        accessor: (row) =>
          row.label ? (
            <span className="truncate font-medium text-foreground">{row.label}</span>
          ) : (
            <span className="italic text-muted-foreground text-sm">{t("table.unlabelled")}</span>
          ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "token",
        header: t("table.token"),
        accessor: (row) => (
          <span className="font-mono text-xs text-muted-foreground">{row.token.slice(0, 10)}…</span>
        ),
        defaultVisible: true,
        compactLabel: true,
      },
      {
        key: "displayStatus",
        header: t("table.statusHeader"),
        accessor: (row) => {
          const s = getQrStatus(row);
          const variant = {
            assigned: "default",
            unassigned: "secondary",
            revoked: "destructive",
          } as const;
          return (
            <Badge variant={variant[s]} className="text-xs">
              {t(`status.${s}` as Parameters<typeof t>[0])}
            </Badge>
          );
        },
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "assignment",
        header: t("table.assignment"),
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.assignment ? row.assignment.target_type : t("table.unassignedDash")}
          </span>
        ),
        defaultVisible: true,
      },
      {
        key: "created_at",
        header: t("table.created"),
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.created_at).toLocaleDateString()}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
    ],
    [t]
  );

  const filters = useMemo<DataViewFilterDef[]>(
    () => [
      {
        type: "select",
        key: "status",
        label: t("table.statusHeader"),
        options: [
          { label: t("filters.assigned"), value: "assigned" },
          { label: t("filters.unassigned"), value: "unassigned" },
          { label: t("filters.revoked"), value: "revoked" },
        ],
      },
    ],
    [t]
  );

  const renderCompactItem = useCallback(
    (row: QrCodeWithStatus) => {
      const s = getQrStatus(row);
      const variant = {
        assigned: "default",
        unassigned: "secondary",
        revoked: "destructive",
      } as const;
      return (
        <div className="flex items-center gap-2 py-0.5">
          <QrCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {row.label ?? (
              <span className="italic text-muted-foreground">{t("table.unlabelled")}</span>
            )}
          </span>
          <Badge variant={variant[s]} className="shrink-0 text-xs">
            {t(`status.${s}` as Parameters<typeof t>[0])}
          </Badge>
        </div>
      );
    },
    [t]
  );

  // renderDetail returns QrDetailPanel — a named component that can use useDataViewSelection()
  const renderDetail = useCallback(
    (qr: QrCodeWithStatus) => (
      <QrDetailPanel
        qr={qr}
        canRevoke={canRevoke}
        canExport={canExport}
        isRevoking={isRevoking}
        onRevoke={setRevokeTarget}
        onDesign={handleOpenDesign}
        t={t}
      />
    ),
    [canRevoke, canExport, isRevoking, handleOpenDesign, t]
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <Tabs
        value={activeStage}
        onValueChange={(v) => setActiveStage(v as "select" | "design")}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center gap-3">
          <TabsList className="grid w-[320px] grid-cols-2">
            <TabsTrigger value="select">{t("stages.select")}</TabsTrigger>
            <TabsTrigger value="design" disabled={!canExport || designIds.length === 0}>
              {t("stages.design")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Select tab ────────────────────────────────────────────────────── */}
        <TabsContent value="select" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full flex-col gap-4 overflow-hidden">
            {/* Generate form */}
            {canCreate && (
              <div className="flex shrink-0 flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("generate.prefixLabel")}
                  </label>
                  <Input
                    value={labelPrefix}
                    onChange={(e) => setLabelPrefix(e.target.value)}
                    placeholder={t("generate.prefixPlaceholder")}
                    className="w-44"
                    disabled={isGenerating}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("generate.countLabel")}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={generateCount}
                    onChange={(e) =>
                      setGenerateCount(Math.min(50, Math.max(1, Number(e.target.value))))
                    }
                    className="w-24"
                    disabled={isGenerating}
                  />
                </div>
                <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isGenerating ? t("generate.generating") : t("generate.submit")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title={t("refresh")}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            )}

            {/* DataView */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <DataView<QrCodeWithStatus, QrCodeWithStatus>
                entity="qr-codes"
                columns={columns}
                filters={filters}
                initialData={initialData}
                queryKey={QR_DV_KEY}
                listFetcher={listFetcher}
                detailFetcher={detailFetcher}
                getRowId={(row) => row.id}
                renderCompactItem={renderCompactItem}
                renderDetail={renderDetail}
                className="h-full"
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Design tab ────────────────────────────────────────────────────── */}
        <TabsContent value="design" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          {canExport && designIds.length > 0 ? (
            <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card p-4">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-sm font-medium">{t("design.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("design.description")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-[140px] grid-cols-2 rounded-lg border bg-muted p-1">
                    <Button
                      type="button"
                      variant={labelFormat === "pdf" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLabelFormat("pdf")}
                    >
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant={labelFormat === "zpl" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLabelFormat("zpl")}
                    >
                      ZPL
                    </Button>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setActiveStage("select")}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("design.backToSelection")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden pt-4">
                <LabelDesigner selectedIds={designIds} canExport={canExport} format={labelFormat} />
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("revokeDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("revokeDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("revokeDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
