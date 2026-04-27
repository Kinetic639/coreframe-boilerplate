"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, ArrowRight, QrCode, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_CREATE, QR_REVOKE, QR_EXPORT } from "@/lib/constants/permissions";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { createQrBatchAction } from "@/app/actions/qr/create-batch";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterStatus = "all" | "assigned" | "unassigned" | "revoked";

function getQrStatus(qr: QrCodeWithStatus): "assigned" | "unassigned" | "revoked" {
  if (qr.status === "revoked") return "revoked";
  return qr.assignment ? "assigned" : "unassigned";
}

function statusBadge(qr: QrCodeWithStatus, t: (key: string) => string) {
  const s = getQrStatus(qr);
  const map = {
    assigned: "default",
    unassigned: "secondary",
    revoked: "destructive",
  } as const;
  return <Badge variant={map[s]}>{t(`status.${s}`)}</Badge>;
}

interface QrTableRowProps {
  qr: QrCodeWithStatus;
  selected: boolean;
  canRevoke: boolean;
  isRevoking: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onToggleSelect: (id: string) => void;
  onRevoke: (id: string) => void;
}

const QrTableRow = memo(function QrTableRow({
  qr,
  selected,
  canRevoke,
  isRevoking,
  t,
  onToggleSelect,
  onRevoke,
}: QrTableRowProps) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(qr.id)}
          disabled={qr.status === "revoked"}
        />
      </TableCell>
      <TableCell className="max-w-[180px] truncate font-medium">
        {qr.label ?? <span className="text-muted-foreground italic">{t("table.unlabelled")}</span>}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {qr.token.slice(0, 10)}…
      </TableCell>
      <TableCell>{statusBadge(qr, t)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {qr.assignment ? qr.assignment.target_type : t("table.unassignedDash")}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(qr.created_at).toLocaleDateString()}
      </TableCell>
      {canRevoke && (
        <TableCell>
          {qr.status === "active" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRevoke(qr.id)}
              disabled={isRevoking}
              title={t("table.revoke")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </TableCell>
      )}
    </TableRow>
  );
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  initialCodes: QrCodeWithStatus[];
  permissionSnapshot: PermissionSnapshot;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QrManagementClient({ initialCodes, permissionSnapshot }: Props) {
  const t = useTranslations("modules.qr.management");
  const canCreate = checkPermission(permissionSnapshot, QR_CREATE);
  const canRevoke = checkPermission(permissionSnapshot, QR_REVOKE);
  const canExport = checkPermission(permissionSnapshot, QR_EXPORT);

  // Data
  const [codes, setCodes] = useState<QrCodeWithStatus[]>(initialCodes);
  const [isRefreshing, startRefresh] = useTransition();

  // Generate form
  const [generateCount, setGenerateCount] = useState(1);
  const [labelPrefix, setLabelPrefix] = useState("");
  const [isGenerating, startGenerate] = useTransition();

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [activeStage, setActiveStage] = useState<"select" | "design">("select");
  const [labelFormat, setLabelFormat] = useState<"pdf" | "zpl">("pdf");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [isRevoking, startRevoke] = useTransition();

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    if (filter === "all") return codes;
    return codes.filter((qr) => getQrStatus(qr) === filter);
  }, [codes, filter]);

  const allFilteredIds = useMemo(() => filtered.map((qr) => qr.id), [filtered]);
  const filteredIdSet = useMemo(() => new Set(allFilteredIds), [allFilteredIds]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const selectedIds = useMemo(
    () => [...selected].filter((id) => filteredIdSet.has(id)),
    [selected, filteredIdSet]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const counts = useMemo(() => {
    const all = codes.length;
    const assigned = codes.filter((q) => getQrStatus(q) === "assigned").length;
    const unassigned = codes.filter((q) => getQrStatus(q) === "unassigned").length;
    const revoked = codes.filter((q) => getQrStatus(q) === "revoked").length;
    return { all, assigned, unassigned, revoked };
  }, [codes]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRefresh() {
    startRefresh(async () => {
      const result = await listQrCodesAction();
      if (result.success) {
        setCodes(result.data);
        setSelected(new Set());
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  function handleGenerate() {
    startGenerate(async () => {
      const result = await createQrBatchAction({
        count: generateCount,
        labelPrefix: labelPrefix.trim() || undefined,
      });
      if (result.success) {
        toast.success(t("toasts.created", { count: result.data.length }));
        handleRefresh();
        setLabelPrefix("");
        setGenerateCount(1);
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allFilteredIds]));
    }
  }, [allFilteredIds, allSelected]);

  const handleOpenDesign = useCallback(() => {
    setActiveStage("design");
  }, []);

  const handleBackToSelection = useCallback(() => {
    setActiveStage("select");
  }, []);

  function handleRevokeConfirm() {
    if (!revokeTarget) return;
    const id = revokeTarget;
    setRevokeTarget(null);
    startRevoke(async () => {
      const result = await revokeQrAction({ qrCodeId: id });
      if (result.success) {
        toast.success(t("toasts.revoked"));
        setCodes((prev) =>
          prev.map((qr) =>
            qr.id === id ? { ...qr, status: "revoked" as const, assignment: null } : qr
          )
        );
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: "all", label: t("filters.all"), count: counts.all },
    { key: "unassigned", label: t("filters.unassigned"), count: counts.unassigned },
    { key: "assigned", label: t("filters.assigned"), count: counts.assigned },
    { key: "revoked", label: t("filters.revoked"), count: counts.revoked },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Tabs
        value={activeStage}
        onValueChange={(value) => setActiveStage(value as "select" | "design")}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-[360px] grid-cols-2">
            <TabsTrigger value="select">{t("stages.select")}</TabsTrigger>
            <TabsTrigger value="design" disabled={!canExport}>
              {t("stages.design")}
            </TabsTrigger>
          </TabsList>

          <div className="text-sm text-muted-foreground">
            {selectedIds.length > 0 ? (
              <span>
                <span className="font-medium text-foreground">{selectedIds.length}</span>{" "}
                {t("selectedCount", { count: selectedIds.length })}
              </span>
            ) : (
              <span>{t("selectHint")}</span>
            )}
          </div>
        </div>

        <TabsContent value="select" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("generate.prefixLabel")}
                </label>
                <Input
                  value={labelPrefix}
                  onChange={(e) => setLabelPrefix(e.target.value)}
                  placeholder={t("generate.prefixPlaceholder")}
                  className="w-44"
                  disabled={!canCreate || isGenerating}
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
                  disabled={!canCreate || isGenerating}
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!canCreate || isGenerating}
                className="gap-2"
              >
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

            <div className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("selection.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("selection.description")}</p>
                </div>
                <Button
                  onClick={handleOpenDesign}
                  disabled={!canExport || selectedIds.length === 0}
                  className="gap-2"
                >
                  {t("selection.designSelected")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      filter === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          disabled={filtered.length === 0}
                        />
                      </TableHead>
                      <TableHead>{t("table.label")}</TableHead>
                      <TableHead>{t("table.token")}</TableHead>
                      <TableHead>{t("table.statusHeader")}</TableHead>
                      <TableHead>{t("table.assignment")}</TableHead>
                      <TableHead>{t("table.created")}</TableHead>
                      {canRevoke && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canRevoke ? 7 : 6}
                          className="py-12 text-center text-sm text-muted-foreground"
                        >
                          <QrCode className="mx-auto mb-2 h-8 w-8 opacity-30" />
                          {t("table.empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((qr) => (
                        <QrTableRow
                          key={qr.id}
                          qr={qr}
                          selected={selected.has(qr.id)}
                          canRevoke={canRevoke}
                          isRevoking={isRevoking}
                          t={t}
                          onToggleSelect={toggleSelect}
                          onRevoke={setRevokeTarget}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {filtered.length > pageSize ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("pagination.summary", {
                      from: filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1,
                      to: Math.min(currentPage * pageSize, filtered.length),
                      total: filtered.length,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("pagination.page", { current: currentPage, total: totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="design" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          {canExport ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
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
                        <Button variant="outline" size="icon" onClick={handleBackToSelection}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("design.backToSelection")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden pt-4">
                {activeStage === "design" ? (
                  <LabelDesigner
                    selectedIds={selectedIds}
                    canExport={canExport}
                    format={labelFormat}
                  />
                ) : null}
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
