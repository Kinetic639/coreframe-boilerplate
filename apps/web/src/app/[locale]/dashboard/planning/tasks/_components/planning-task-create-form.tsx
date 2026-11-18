"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Camera,
  FileText,
  Inbox,
  KanbanSquare,
  ListTodo,
  Loader2,
  Paperclip,
  QrCode,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { ENTITY_MENTIONS } from "@/components/v2/mentions/mention-suggestion-list";
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
import {
  attachmentUploadProblem,
  keepFilesInMemory,
  uploadAttachmentDirect,
} from "@/hooks/queries/attachments/direct-upload";
import {
  useCopyTargetBoards,
  useCopyTargetColumns,
} from "@/components/planning/task-editor/copy-card-dialog";
import { columnName } from "@/components/planning/task-editor/task-labels";
import { MemberAvatar, MemberProfilesProvider } from "@/components/planning/member-avatar";
import { formatFileSize } from "@/components/primitives/attachments";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@/lib/validations/attachments";
import { cn } from "@/utils";
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
  /**
   * "page": a page of its own on a phone (after scanning an empty QR code):
   * one column, quick choices and the create button stuck to the bottom.
   */
  variant?: "dialog" | "page";
  /** Starts with "Me" chosen as the assignee. */
  defaultAssignToMe?: boolean;
}

const UNASSIGNED = "__unassigned__";

/** Where a new task goes: only the task list, the author's board inbox, or a board column. */
type Placement = "list" | "inbox" | "board";

/** Outlined buttons in the theme's colours, as in the task editor. */
const OUTLINE_BUTTON =
  "h-10 gap-1.5 border-input bg-transparent font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground";

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A row of choices that reads like one control (assignee, priority, due date). */
function Choice({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors disabled:opacity-50",
        selected
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
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
  variant = "dialog",
  defaultAssignToMe = false,
}: PlanningTaskCreateFormProps) {
  const t = useTranslations("modules.planning.tasks");
  const tFiles = useTranslations("components.attachments");
  const { can } = usePermissions();
  const orgId = useAppStoreV2((state) => state.activeOrgId);
  const initialAssignee = defaultAssignToMe ? currentUserId : UNASSIGNED;
  const [title, setTitle] = useState("");
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState<string>(initialAssignee);
  const [taskScope, setTaskScope] = useState<string>(activeBranchId ?? "__organization__");
  const [dueAt, setDueAt] = useState<string>(initialDueAt ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>("list");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const tPlanning = useTranslations("modules.planning");
  const boards = useCopyTargetBoards(orgId ?? "", placement === "board" && Boolean(orgId));
  const columns = useCopyTargetColumns(orgId ?? "", boardId, placement === "board");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const qrFromScan = Boolean(initialQrCodeId && initialToken);
  const [stagedQr, setStagedQr] = useState<StagedQrCode | null>(
    initialQrCodeId && initialToken
      ? { qrCodeId: initialQrCodeId, token: initialToken, label: initialLabel ?? null }
      : null
  );
  const isPage = variant === "page";
  const others = members.filter(
    (member) => member.user_id !== currentUserId && (canAssign || member.user_id === currentUserId)
  );
  const assignedOther = assignedTo !== UNASSIGNED && assignedTo !== currentUserId;

  useEffect(() => {
    setDueAt(initialDueAt ?? "");
  }, [initialDueAt]);

  // A board starts on its first column.
  useEffect(() => {
    const list = columns.data ?? [];
    if (!list.length) return;
    setColumnId((current) =>
      current && list.some((column) => column.id === current) ? current : list[0].id
    );
  }, [columns.data]);

  function reset() {
    setTitle("");
    setDescriptionRich(createEmptyRichText);
    setPriority("normal");
    setAssignedTo(initialAssignee);
    setTaskScope(activeBranchId ?? "__organization__");
    setDueAt(initialDueAt ?? "");
    setTitleError(null);
    setFiles([]);
    setFileError(null);
    setPlacement("list");
    setBoardId(null);
    setColumnId(null);
    setPlacementError(null);
  }

  // Kept in memory right away: on iPhones a picked file can stop being
  // readable by the time the task is created and the upload starts.
  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const picked = await keepFilesInMemory(list);
    const problem = picked.map(attachmentUploadProblem).find(Boolean);
    setFileError(problem ? tFiles(`problem.${problem}`) : null);
    setFiles((current) => [...current, ...picked.filter((file) => !attachmentUploadProblem(file))]);
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(t("titleRequired"));
      return;
    }
    setTitleError(null);
    if (placement === "board" && !columnId) {
      setPlacementError(t("placement.chooseColumn"));
      return;
    }
    setPlacementError(null);
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
        assigned_to: assignedTo === UNASSIGNED ? null : assignedTo || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        column_id: placement === "board" ? columnId : null,
        is_inbox: placement === "inbox",
      });

      if (!result.success) {
        toast.error(t("failedCreate"));
        return;
      }

      toast.success(t("taskCreated"));

      const followUps: Promise<unknown>[] = [];
      if (stagedQr) {
        followUps.push(
          assignQrToPlanningTaskAction({ qrCodeId: stagedQr.qrCodeId, taskId: result.data.id })
            .then((qrResult) => {
              if (!qrResult.success) toast.error(t("qrAssignFailed"));
            })
            .catch(() => toast.error(t("qrAssignFailed")))
        );
      }
      await Promise.all(followUps);

      // Files go up in the background: the form closes as soon as the task exists.
      if (files.length > 0 && orgId) {
        const pending = files;
        const taskId = result.data.id;
        const notice = toast.info(t("uploadingFiles", { count: pending.length }), {
          autoClose: false,
        });
        void Promise.allSettled(
          pending.map((file) =>
            uploadAttachmentDirect({ orgId, targetType: "planning.task", targetId: taskId, file })
          )
        ).then((results) => {
          toast.dismiss(notice);
          const failed = results.filter((item) => item.status === "rejected").length;
          if (failed > 0) toast.error(t("attachmentsUploadFailed"));
          else toast.success(t("filesUploaded", { count: pending.length }));
        });
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

  const dueChoices = [
    { value: localDate(0), label: t("dueToday") },
    { value: localDate(1), label: t("dueTomorrow") },
    { value: localDate(7), label: t("dueNextWeek") },
  ];

  const fields = (
    <div className={cn("flex flex-col gap-5", isPage ? "pb-4" : "py-4")}>
      {qrFromScan && stagedQr ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
          <QrCode className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            {t("qrWillBeAssigned", { code: stagedQr.label ?? stagedQr.token })}
          </span>
        </div>
      ) : null}

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
          onBlur={() => {
            if (!title.trim() && title.length > 0) setTitleError(t("titleRequired"));
          }}
          placeholder={t("titlePlaceholder")}
          disabled={submitting}
          className={cn(isPage && "h-11 text-base")}
          autoFocus={!isPage}
        />
        {titleError && <p className="text-destructive text-xs">{titleError}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("description")}</Label>
        <div className="border-input rounded-md border">
          <RichTextEditorField
            value={descriptionRich}
            onChange={setDescriptionRich}
            placeholder={t("descriptionPlaceholder")}
            disabled={submitting}
            mention={ENTITY_MENTIONS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("placement.label")}</Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup">
          {(
            [
              ["list", ListTodo],
              ["inbox", Inbox],
              ["board", KanbanSquare],
            ] as const
          ).map(([option, Icon]) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={placement === option}
              disabled={submitting}
              onClick={() => {
                setPlacement(option);
                setPlacementError(null);
              }}
              className={cn(
                "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors sm:text-sm",
                placement === option && "bg-background text-foreground shadow-sm"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t(`placement.${option}`)}</span>
            </button>
          ))}
        </div>
        {placement === "board" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={boardId ?? ""}
              onValueChange={(value) => {
                setBoardId(value);
                setColumnId(null);
                setPlacementError(null);
              }}
              disabled={submitting || boards.isLoading}
            >
              <SelectTrigger className="h-10" aria-label={t("placement.board")}>
                <SelectValue
                  placeholder={
                    boards.isLoading
                      ? t("placement.loading")
                      : boards.data?.length === 0
                        ? t("placement.noBoards")
                        : t("placement.chooseBoard")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(boards.data ?? []).map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={columnId ?? ""}
              onValueChange={(value) => {
                setColumnId(value);
                setPlacementError(null);
              }}
              disabled={submitting || !boardId || columns.isLoading}
            >
              <SelectTrigger className="h-10" aria-label={t("placement.column")}>
                <SelectValue
                  placeholder={
                    boardId && columns.isLoading
                      ? t("placement.loading")
                      : t("placement.chooseColumn")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(columns.data ?? []).map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: column.color ?? "#64748b" }}
                      />
                      <span className="truncate">{columnName(tPlanning, column)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t(`placement.${placement}Help`)}</p>
        )}
        {placementError ? <p className="text-xs text-destructive">{placementError}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("assignTo")}</Label>
        <div className="flex flex-wrap gap-2">
          <Choice
            selected={assignedTo === currentUserId}
            onClick={() => setAssignedTo(currentUserId)}
            disabled={submitting}
          >
            <MemberAvatar userId={currentUserId} className="h-5 w-5" disabledPopover />
            {t("assignMe")}
          </Choice>
          <Choice
            selected={assignedTo === UNASSIGNED}
            onClick={() => setAssignedTo(UNASSIGNED)}
            disabled={submitting}
          >
            {t("assignNobody")}
          </Choice>
        </div>
        {canAssign && others.length > 0 ? (
          <Select
            value={assignedOther ? assignedTo : ""}
            onValueChange={setAssignedTo}
            disabled={submitting}
          >
            <SelectTrigger className={cn("h-10", assignedOther && "border-primary bg-primary/10")}>
              <SelectValue placeholder={t("assignOther")} />
            </SelectTrigger>
            <SelectContent>
              {others.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <MemberAvatar
                      userId={m.user_id}
                      name={m.name}
                      email={m.email}
                      className="h-5 w-5"
                      disabledPopover
                    />
                    <span className="truncate">{m.name ?? m.email ?? m.user_id}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="task-due">{t("dueDate")}</Label>
        <div className="flex flex-wrap gap-2">
          {dueChoices.map((choice) => (
            <Choice
              key={choice.value}
              selected={dueAt === choice.value}
              onClick={() => setDueAt(dueAt === choice.value ? "" : choice.value)}
              disabled={submitting}
            >
              {choice.label}
            </Choice>
          ))}
        </div>
        <Input
          id="task-due"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          disabled={submitting}
          className="h-10 w-full sm:w-56"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("priority")}</Label>
        <div
          role="radiogroup"
          aria-label={t("priority")}
          className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
        >
          {TASK_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              disabled={submitting}
              onClick={() => setPriority(p)}
              className={cn(
                "h-9 min-w-0 truncate rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors sm:text-sm",
                priority === p && "bg-background text-foreground shadow-sm"
              )}
            >
              {priorityConfigs?.[p]?.label ?? t(p)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("scope")}</Label>
        <Select value={taskScope} onValueChange={setTaskScope} disabled={submitting}>
          <SelectTrigger className="h-10">
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

      <div className="flex flex-col gap-2">
        <Label>{t("attachmentsField")}</Label>
        {files.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2.5 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={t("removeFile", { name: file.name })}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_BUTTON}
            onClick={() => cameraInput.current?.click()}
            disabled={submitting}
          >
            <Camera className="h-4 w-4" />
            {t("addPhoto")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_BUTTON}
            onClick={() => fileInput.current?.click()}
            disabled={submitting}
          >
            <Paperclip className="h-4 w-4" />
            {t("addFiles")}
          </Button>
        </div>
        {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {can(QR_ASSIGN) && !qrFromScan && (
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
  );

  const submitLabel = (
    <>
      {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
      {t("createTask")}
    </>
  );

  const memberIds = members.map((member) => member.user_id);

  const actionButtons = (
    <>
      <Button
        variant="outline"
        className={cn(OUTLINE_BUTTON, "h-11 shrink-0 sm:h-10")}
        onClick={onCancel}
        disabled={submitting}
      >
        {t("cancel")}
      </Button>
      <Button
        className="h-11 flex-1 sm:h-10 sm:flex-none"
        onClick={() => void handleSubmit()}
        disabled={submitting}
      >
        {submitLabel}
      </Button>
    </>
  );

  if (isPage) {
    // On a phone the buttons are pinned to the bottom of the screen (above the
    // home indicator); the fields leave room for them.
    return (
      <MemberProfilesProvider userIds={memberIds}>
        <div className="pb-24 sm:pb-0">{fields}</div>
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:justify-end sm:border-0 sm:px-0 sm:pb-0">
          {actionButtons}
        </div>
      </MemberProfilesProvider>
    );
  }

  // In the dialog the fields scroll and the buttons stay at the bottom.
  return (
    <MemberProfilesProvider userIds={memberIds}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">{fields}</div>
      <div className="flex shrink-0 gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-3">
        {actionButtons}
      </div>
    </MemberProfilesProvider>
  );
}
