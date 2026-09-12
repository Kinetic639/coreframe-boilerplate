"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { createTaskAction, assignQrToPlanningTaskAction } from "@/app/actions/planning";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/validations/planning";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import type { PlanningPriorityBadgeConfig } from "@/components/planning/planning-task-priority-badge";
import { QrCodeStagingField, type StagedQrCode } from "@/components/features/qr";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_ASSIGN, QR_CREATE } from "@/lib/constants/permissions";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface BranchOption {
  id: string;
  name: string;
}

interface PlanningTaskCreateFormProps {
  members: Member[];
  branches: BranchOption[];
  activeBranchId: string | null;
  currentUserId: string;
  canAssign: boolean;
  onCreated: (task: PlanningTaskDetail) => void;
  onCancel: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  priorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
  initialDueAt?: string;
  initialQrCodeId?: string;
  initialToken?: string;
  initialLabel?: string | null;
}

export function PlanningTaskCreateForm({
  members,
  branches,
  activeBranchId,
  currentUserId,
  canAssign,
  onCreated,
  onCancel,
  onSubmittingChange,
  priorityConfigs,
  initialDueAt,
  initialQrCodeId,
  initialToken,
  initialLabel,
}: PlanningTaskCreateFormProps) {
  const t = useTranslations("modules.planning.tasks");
  const { can } = usePermissions();
  const [title, setTitle] = useState("");
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState<string>("__unassigned__");
  const [taskScope, setTaskScope] = useState<string>(activeBranchId ?? "__organization__");
  const [dueAt, setDueAt] = useState<string>(initialDueAt ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stagedQr, setStagedQr] = useState<StagedQrCode | null>(
    initialQrCodeId && initialToken
      ? { qrCodeId: initialQrCodeId, token: initialToken, label: initialLabel ?? null }
      : null
  );

  useEffect(() => {
    setDueAt(initialDueAt ?? "");
  }, [initialDueAt]);

  function reset() {
    setTitle("");
    setDescriptionRich(createEmptyRichText);
    setPriority("normal");
    setAssignedTo("__unassigned__");
    setTaskScope(activeBranchId ?? "__organization__");
    setDueAt(initialDueAt ?? "");
    setTitleError(null);
  }

  async function handleSubmit(assignToMe = false) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(t("titleRequired"));
      return;
    }
    setTitleError(null);
    setSubmitting(true);
    onSubmittingChange?.(true);

    const descriptionPlain = extractPlainText(descriptionRich as any);
    const hasDescription = descriptionPlain.trim().length > 0;

    try {
      const result = await createTaskAction({
        title: trimmedTitle,
        description_plain: hasDescription ? descriptionPlain : undefined,
        description_rich: hasDescription ? JSON.stringify(descriptionRich) : undefined,
        priority,
        branch_id: taskScope === "__organization__" ? null : taskScope,
        assigned_to: assignToMe
          ? currentUserId
          : assignedTo === "__unassigned__"
            ? null
            : assignedTo || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });

      if (!result.success) {
        toast.error(t("failedCreate"));
        return;
      }

      toast.success(t("taskCreated"));

      if (stagedQr) {
        try {
          const qrResult = await assignQrToPlanningTaskAction({
            qrCodeId: stagedQr.qrCodeId,
            taskId: result.data.id,
          });
          if (!qrResult.success) {
            toast.error(t("qrAssignFailed"));
          }
        } catch {
          toast.error(t("qrAssignFailed"));
        }
      }

      reset();
      onCreated(result.data);
    } catch {
      toast.error(t("failedCreateRetry"));
    } finally {
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 py-2">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-title">
            {t("title")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError && e.target.value.trim()) setTitleError(null);
            }}
            placeholder={t("titlePlaceholder")}
            disabled={submitting}
            autoFocus
          />
          {titleError && <p className="text-destructive text-xs">{titleError}</p>}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label>{t("description")}</Label>
          <div className="border-input rounded-md border">
            <RichTextEditorField
              value={descriptionRich}
              onChange={setDescriptionRich}
              placeholder={t("descriptionPlaceholder")}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Priority + Assignee row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("priority")}</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityConfigs?.[p]?.label ?? t(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("assignTo")}</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={submitting}>
              <SelectTrigger>
                <SelectValue placeholder={t("unassigned")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">{t("unassigned")}</SelectItem>
                {members
                  .filter((m) => canAssign || m.user_id === currentUserId)
                  .map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name ?? m.email ?? m.user_id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("scope")}</Label>
          <Select value={taskScope} onValueChange={setTaskScope} disabled={submitting}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__organization__">{t("organizationScope")}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("scopeHelp")}</p>
        </div>

        {/* Due date */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">{t("dueDate")}</Label>
          <div className="w-48">
            <Input
              id="task-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        {/* QR Code */}
        {can(QR_ASSIGN) && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("qrCode")}</Label>
            <QrCodeStagingField
              value={stagedQr}
              onChange={setStagedQr}
              canGenerate={can(QR_CREATE)}
              disabled={submitting}
            />
          </div>
        )}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={submitting}
          className="gap-1.5"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          {t("createAndAssignToMe")}
        </Button>
        <Button onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {t("createTask")}
        </Button>
      </DialogFooter>
    </>
  );
}
