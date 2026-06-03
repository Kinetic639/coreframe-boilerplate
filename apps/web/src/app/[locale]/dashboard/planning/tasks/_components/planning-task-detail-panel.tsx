"use client";

import { useState, useCallback } from "react";
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
} from "@/app/actions/planning";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import type { TaskStatus } from "@/lib/validations/planning";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface PlanningTaskDetailPanelProps {
  detail: PlanningTaskDetail;
  canUpdate: boolean;
  canAssign: boolean;
  canDelete: boolean;
  currentUserId: string;
  members: Member[];
  onRefresh?: () => void;
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
  currentUserId,
  members,
  onRefresh,
}: PlanningTaskDetailPanelProps) {
  const [detail, setDetail] = useState<PlanningTaskDetail>(initialDetail);
  const [saving, setSaving] = useState(false);

  // Sync when parent provides a new detail (DataView refetch)
  const latestDetail = initialDetail.updated_at !== detail.updated_at ? initialDetail : detail;
  const currentDetail = latestDetail;

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

        {/* Status actions */}
        {canUpdate && (
          <div className="flex flex-wrap gap-2">
            {status === "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStart}
                disabled={saving}
                className="gap-1.5"
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
                className="gap-1.5"
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
                className="gap-1.5"
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
                className="gap-1.5 text-red-600 hover:text-red-600"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* Description */}
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
            <p className="text-sm whitespace-pre-wrap">{currentDetail.description_plain}</p>
          </div>
        ) : null}

        <Separator />

        {/* Meta fields */}
        <div className="flex flex-col gap-3">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0 text-xs">Assigned to</span>
            {canAssign ? (
              <Select
                value={currentDetail.assigned_to ?? "__unassigned__"}
                onValueChange={handleAssignChange}
                disabled={saving}
              >
                <SelectTrigger className="h-7 text-xs">
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
              <span className="text-sm">
                {currentDetail.assignee_name ?? currentDetail.assignee_email ?? "Unassigned"}
              </span>
            )}
          </div>

          {/* Due date */}
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0 text-xs">Due date</span>
            <span className="text-sm">{formatDate(currentDetail.due_at)}</span>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2">
            <Flag className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0 text-xs">Priority</span>
            <PlanningTaskPriorityBadge priority={currentDetail.priority} />
          </div>

          {/* Created by */}
          <div className="flex items-center gap-2">
            <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0 text-xs">Created by</span>
            <span className="text-sm">
              {currentDetail.creator_name ?? currentDetail.creator_email ?? "Unknown"}
            </span>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0 text-xs">Created</span>
            <span className="text-sm">{formatDateTime(currentDetail.created_at)}</span>
          </div>

          {currentDetail.completed_at && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="text-muted-foreground w-24 shrink-0 text-xs">Completed</span>
              <span className="text-sm">{formatDateTime(currentDetail.completed_at)}</span>
            </div>
          )}

          {currentDetail.cancelled_at && (
            <div className="flex items-center gap-2">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              <span className="text-muted-foreground w-24 shrink-0 text-xs">Cancelled</span>
              <span className="text-sm">{formatDateTime(currentDetail.cancelled_at)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Activity */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Activity
          </p>
          <PlanningTaskActivityList activity={currentDetail.activity} />
        </div>

        {/* Archive */}
        {canDelete && status !== "cancelled" && status !== "completed" && (
          <>
            <Separator />
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
          </>
        )}
      </div>
    </ScrollArea>
  );
}
