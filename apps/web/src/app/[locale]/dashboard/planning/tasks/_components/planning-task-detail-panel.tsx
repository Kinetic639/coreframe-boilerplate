"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  User,
  Calendar,
  Flag,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Play,
  Trash2,
  QrCode,
  Link2Off,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import { PlanningTaskStatusBadge } from "@/components/planning/planning-task-status-badge";
import { PlanningTaskPriorityBadge } from "@/components/planning/planning-task-priority-badge";
import { PlanningTaskActivityList } from "@/components/planning/planning-task-activity-list";
import {
  startTaskAction,
  completeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
  assignTaskAction,
  deleteTaskAction,
  assignQrToPlanningTaskAction,
  getQrAssignmentForTaskAction,
} from "@/app/actions/planning";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { listQrCodesAction } from "@/app/actions/qr/list";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import type { TaskStatus } from "@/lib/validations/planning";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

type QrInfo = {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
} | null;

interface PlanningTaskDetailPanelProps {
  detail: PlanningTaskDetail;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  members: Member[];
  onRefresh?: () => void;
  initialQrAssignment?: QrInfo;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlanningTaskDetailPanel({
  detail: initialDetail,
  canUpdate,
  canAssign,
  canDelete,
  members,
  onRefresh,
  initialQrAssignment = null,
}: PlanningTaskDetailPanelProps) {
  const [detail, setDetail] = useState<PlanningTaskDetail>(initialDetail);
  const [saving, setSaving] = useState(false);
  const [qrAssignment, setQrAssignment] = useState<QrInfo>(initialQrAssignment);
  const [showAssignQr, setShowAssignQr] = useState(false);
  const [isRevokingQr, setIsRevokingQr] = useState(false);
  const [qrCodes, setQrCodes] = useState<
    Array<{
      id: string;
      label: string | null;
      status: string;
      assignment: { target_type: string; target_id: string } | null;
    }>
  >([]);

  useEffect(() => {
    setDetail(initialDetail);
  }, [initialDetail.id, initialDetail.updated_at]);

  const currentDetail = detail;

  async function runAction(
    fn: () => Promise<{ success: boolean; data?: PlanningTaskDetail; error?: string }>
  ) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await fn();
      if (!result.success) {
        toast.error((result as any).error ?? "Operation failed");
        return;
      }
      if (result.data) setDetail(result.data);
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  const handleStart = useCallback(
    () => runAction(() => startTaskAction(currentDetail.id)),
    [currentDetail.id, saving]
  );
  const handleComplete = useCallback(
    () => runAction(() => completeTaskAction(currentDetail.id)),
    [currentDetail.id, saving]
  );
  const handleReopen = useCallback(
    () => runAction(() => reopenTaskAction(currentDetail.id)),
    [currentDetail.id, saving]
  );
  const handleCancel = useCallback(
    () => runAction(() => cancelTaskAction(currentDetail.id)),
    [currentDetail.id, saving]
  );
  const handleDelete = useCallback(
    () =>
      runAction(async () => {
        const r = await deleteTaskAction(currentDetail.id);
        if (r.success) toast.success("Task archived");
        return r as any;
      }),
    [currentDetail.id, saving]
  );

  const handleRevokeQr = useCallback(async () => {
    if (!qrAssignment) return;
    setIsRevokingQr(true);
    try {
      const result = await revokeQrAction({ qrCodeId: qrAssignment.qrCodeId });
      if (result.success) {
        setQrAssignment(null);
        onRefresh?.();
        toast.success("QR code unlinked from task.");
      } else {
        toast.error("Failed to unlink QR code.");
      }
    } finally {
      setIsRevokingQr(false);
    }
  }, [onRefresh, qrAssignment]);

  const handleOpenAssignQr = useCallback(async () => {
    const result = await listQrCodesAction();
    if (result.success) {
      setQrCodes(
        (result.data as any[]).map((c: any) => ({
          id: c.id,
          label: c.label ?? null,
          status: c.status,
          assignment: c.assignment ?? null,
        }))
      );
    }
    setShowAssignQr(true);
  }, []);

  const handleQrAssigned = useCallback(
    async (qrCodeId: string) => {
      const result = await assignQrToPlanningTaskAction({ qrCodeId, taskId: currentDetail.id });
      if (result.success) {
        const freshResult = await getQrAssignmentForTaskAction(currentDetail.id);
        if (freshResult.success && freshResult.data) setQrAssignment(freshResult.data);
        onRefresh?.();
        setShowAssignQr(false);
        toast.success("QR code assigned to task.");
      } else {
        toast.error("Failed to assign QR code.");
      }
    },
    [currentDetail.id, onRefresh]
  );

  const handleAssignChange = useCallback(
    async (userId: string) => {
      const newAssignee = userId === "__unassigned__" ? null : userId;
      await runAction(() => assignTaskAction({ id: currentDetail.id, assigned_to: newAssignee }));
    },
    [currentDetail.id, saving]
  );

  const status = currentDetail.status as TaskStatus;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground font-mono text-xs">
              {currentDetail.task_number}
            </span>
            {saving && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />}
          </div>
          <h2 className="mt-1 text-base font-semibold leading-snug">{currentDetail.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PlanningTaskStatusBadge status={currentDetail.status} />
            <PlanningTaskPriorityBadge priority={currentDetail.priority} />
          </div>
        </div>

        <Separator />

        <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-4">
            {currentDetail.description_rich ? (
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                  Description
                </p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <RichTextRenderer value={currentDetail.description_rich as any} />
                </div>
              </div>
            ) : currentDetail.description_plain ? (
              <div>
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase tracking-wide">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm">{currentDetail.description_plain}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No description.</p>
            )}

            <Separator />

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Activity
              </p>
              <PlanningTaskActivityList activity={currentDetail.activity} />
            </div>
          </div>

          <div className="w-full shrink-0 space-y-3 self-start lg:w-56">
            {canUpdate && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-muted-foreground text-[10px] font-medium uppercase">Actions</p>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  {status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleStart}
                      disabled={saving}
                      className="justify-start gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </Button>
                  )}
                  {(status === "open" || status === "in_progress") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleComplete}
                      disabled={saving}
                      className="justify-start gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Complete
                    </Button>
                  )}
                  {(status === "completed" || status === "cancelled") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReopen}
                      disabled={saving}
                      className="justify-start gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen
                    </Button>
                  )}
                  {status !== "cancelled" && status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={saving}
                      className="justify-start gap-1.5 text-red-600 hover:text-red-600"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <User className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[10px] uppercase">Assigned to</p>
                  {canAssign ? (
                    <Select
                      value={currentDetail.assigned_to ?? "__unassigned__"}
                      onValueChange={handleAssignChange}
                      disabled={saving}
                    >
                      <SelectTrigger className="mt-1 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name ?? m.email ?? m.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="truncate text-xs">
                      {currentDetail.assignee_name ?? currentDetail.assignee_email ?? "Unassigned"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Flag className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">Priority</p>
                  <PlanningTaskPriorityBadge priority={currentDetail.priority} />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">Due date</p>
                  <p className="text-xs">{formatDate(currentDetail.due_at)}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-2">
                <User className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">Created by</p>
                  <p className="truncate text-xs">
                    {currentDetail.creator_name ?? currentDetail.creator_email ?? "Unknown"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">Created</p>
                  <p className="text-xs">{formatDateTime(currentDetail.created_at)}</p>
                </div>
              </div>

              {currentDetail.completed_at && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] uppercase">Completed</p>
                    <p className="text-xs">{formatDateTime(currentDetail.completed_at)}</p>
                  </div>
                </div>
              )}

              {currentDetail.cancelled_at && (
                <div className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] uppercase">Cancelled</p>
                    <p className="text-xs">{formatDateTime(currentDetail.cancelled_at)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                <QrCode className="text-muted-foreground h-3.5 w-3.5" />
                QR Code
              </h3>
              {qrAssignment ? (
                <div className="space-y-2">
                  <div className="bg-muted/50 rounded-md px-2.5 py-1.5 text-xs">
                    <p className="truncate font-medium">{qrAssignment.label ?? "Unlabelled"}</p>
                    <p className="text-muted-foreground truncate font-mono">{qrAssignment.token}</p>
                  </div>
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 w-full text-xs"
                      onClick={handleRevokeQr}
                      disabled={isRevokingQr}
                    >
                      {isRevokingQr ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Link2Off className="mr-1.5 h-3 w-3" />
                      )}
                      Unlink
                    </Button>
                  )}
                </div>
              ) : canUpdate ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={handleOpenAssignQr}
                >
                  <Plus className="mr-1.5 h-3 w-3" />
                  Assign QR Code
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">No QR code assigned.</p>
              )}
            </div>

            {showAssignQr && (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Select a QR code</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowAssignQr(false)}>
                    Cancel
                  </Button>
                </div>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {qrCodes
                    .filter((c) => c.status === "active" && !c.assignment)
                    .map((c) => (
                      <button
                        key={c.id}
                        className="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                        onClick={() => handleQrAssigned(c.id)}
                      >
                        <QrCode className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.label ?? c.id.slice(0, 8)}</span>
                      </button>
                    ))}
                  {qrCodes.filter((c) => c.status === "active" && !c.assignment).length === 0 && (
                    <p className="text-muted-foreground px-2 py-1 text-xs">
                      No available QR codes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {canDelete && status !== "cancelled" && status !== "completed" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive w-full gap-1.5 text-xs"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Archive task
              </Button>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
