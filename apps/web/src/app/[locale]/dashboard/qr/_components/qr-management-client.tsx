"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "react-toastify";
import { ArrowRight, QrCode, Plus, Trash2, RefreshCw } from "lucide-react";
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
import { LabelDesigner } from "@/app/[locale]/dashboard/qr/_components/label-designer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterStatus = "all" | "assigned" | "unassigned" | "revoked";

function getQrStatus(qr: QrCodeWithStatus): "assigned" | "unassigned" | "revoked" {
  if (qr.status === "revoked") return "revoked";
  return qr.assignment ? "assigned" : "unassigned";
}

function statusBadge(qr: QrCodeWithStatus) {
  const s = getQrStatus(qr);
  const map = {
    assigned: "default",
    unassigned: "secondary",
    revoked: "destructive",
  } as const;
  return <Badge variant={map[s]}>{s}</Badge>;
}

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
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const selectedIds = [...selected].filter((id) => allFilteredIds.includes(id));

  const counts = useMemo(() => {
    const all = codes.length;
    const assigned = codes.filter((q) => getQrStatus(q) === "assigned").length;
    const unassigned = codes.filter((q) => getQrStatus(q) === "unassigned").length;
    const revoked = codes.filter((q) => getQrStatus(q) === "revoked").length;
    return { all, assigned, unassigned, revoked };
  }, [codes]);

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
        toast.success(
          `Created ${result.data.length} QR code${result.data.length === 1 ? "" : "s"}.`
        );
        handleRefresh();
        setLabelPrefix("");
        setGenerateCount(1);
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...allFilteredIds]));
    }
  }

  function handleRevokeConfirm() {
    if (!revokeTarget) return;
    const id = revokeTarget;
    setRevokeTarget(null);
    startRevoke(async () => {
      const result = await revokeQrAction({ qrCodeId: id });
      if (result.success) {
        toast.success("QR code revoked.");
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
    { key: "all", label: "All", count: counts.all },
    { key: "unassigned", label: "Unassigned", count: counts.unassigned },
    { key: "assigned", label: "Assigned", count: counts.assigned },
    { key: "revoked", label: "Revoked", count: counts.revoked },
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
            <TabsTrigger value="select">1. Select codes</TabsTrigger>
            <TabsTrigger value="design" disabled={!canExport}>
              2. Design & print
            </TabsTrigger>
          </TabsList>

          <div className="text-sm text-muted-foreground">
            {selectedIds.length > 0 ? (
              <span>
                <span className="font-medium text-foreground">{selectedIds.length}</span> labels
                selected
              </span>
            ) : (
              <span>Select the labels you want to print first.</span>
            )}
          </div>
        </div>

        <TabsContent value="select" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Label prefix (optional)
                </label>
                <Input
                  value={labelPrefix}
                  onChange={(e) => setLabelPrefix(e.target.value)}
                  placeholder="e.g. Batch-A"
                  className="w-44"
                  disabled={!canCreate || isGenerating}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Count (1–50)</label>
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
                {isGenerating ? "Generating…" : "Generate"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh list"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Choose the labels to print</p>
                  <p className="text-sm text-muted-foreground">
                    Start with a filtered list, then move into the label designer.
                  </p>
                </div>
                <Button
                  onClick={() => setActiveStage("design")}
                  disabled={!canExport || selectedIds.length === 0}
                  className="gap-2"
                >
                  Design selected labels
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
                      <TableHead>Label</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Created</TableHead>
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
                          No QR codes found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((qr) => (
                        <TableRow
                          key={qr.id}
                          data-state={selected.has(qr.id) ? "selected" : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selected.has(qr.id)}
                              onCheckedChange={() => toggleSelect(qr.id)}
                              disabled={qr.status === "revoked"}
                            />
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate font-medium">
                            {qr.label ?? (
                              <span className="text-muted-foreground italic">unlabelled</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {qr.token.slice(0, 10)}…
                          </TableCell>
                          <TableCell>{statusBadge(qr)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {qr.assignment ? qr.assignment.target_type : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(qr.created_at).toLocaleDateString()}
                          </TableCell>
                          {canRevoke && (
                            <TableCell>
                              {qr.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setRevokeTarget(qr.id)}
                                  disabled={isRevoking}
                                  title="Revoke QR code"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="design" className="!mt-0 min-h-0 flex-1 overflow-hidden">
          {canExport ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-sm font-medium">Design and print labels</p>
                  <p className="text-sm text-muted-foreground">
                    Adjust the label layout, check the preview, then open the PDF preview to print.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selected`
                      : "No labels selected"}
                  </span>
                  <Button variant="outline" onClick={() => setActiveStage("select")}>
                    Back to selection
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden pt-4">
                <LabelDesigner selectedIds={selectedIds} canExport={canExport} />
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deactivates the QR code. Any printed labels with this token will no
              longer resolve. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
