"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  ArrowUpToLine,
  Check,
  Copy,
  Edit3,
  LayoutTemplate,
  MoreHorizontal,
  Palette,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCopyTargetBoards } from "@/components/planning/task-editor/copy-card-dialog";
import type { KanbanBoardCard, KanbanBoardColumn, KanbanTaskStatus } from "@/lib/types/kanban";
import { KANBAN_TASK_STATUSES } from "@/lib/validations/kanban";
import { cn } from "@/utils";
import { COLUMN_COLORS, columnName, statusLabel } from "./board-format";
import type { BoardActions } from "./use-board-actions";

/** The list's count against its limit ("3/4"), red past it. */
export function WipBadge({ count, limit }: { count: number; limit: number | null }) {
  const t = useTranslations("modules.planning.boardExtras");
  if (!limit) return null;
  const over = count > limit;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
        over ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
      )}
      title={t(over ? "wip.overTitle" : "wip.title", { count, limit })}
    >
      {count}/{limit}
    </span>
  );
}

/** A limit typed in a field: whole numbers from 1 to 999, anything else is none. */
function parseWipLimit(value: string): number | null {
  const limit = Number.parseInt(value, 10);
  return Number.isFinite(limit) && limit >= 1 ? Math.min(limit, 999) : null;
}

/** Saves one field of a column; the update takes the whole column. */
function saveColumn(
  actions: BoardActions,
  column: KanbanBoardColumn,
  patch: Partial<Pick<KanbanBoardColumn, "title" | "color">>
) {
  return actions.updateColumn({
    id: column.id,
    board_id: column.board_id,
    title: column.title,
    description: column.description,
    color: column.color,
    status_category: column.status_category,
    ...patch,
  });
}

/** The column's name: a click turns it into a field. Enter or leaving saves, Esc cancels. */
export function ColumnTitle({
  column,
  canEdit,
  actions,
}: {
  column: KanbanBoardColumn;
  canEdit: boolean;
  actions: BoardActions;
}) {
  const t = useTranslations("modules.planning");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(column.title);
  const doneRef = useRef(false);
  const name = columnName(t, column);

  // A status column is named after its status: only a plain one is renamed here.
  if (!canEdit || column.status_category) {
    return (
      <h2 className="truncate text-sm font-semibold" title={name}>
        {name}
      </h2>
    );
  }

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    const title = value.trim();
    if (save && title && title !== column.title) void saveColumn(actions, column, { title });
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        maxLength={120}
        aria-label={t("boards.columnTitle")}
        className="h-7 px-1.5 text-sm font-semibold"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="min-w-0 truncate rounded px-1 -mx-1 text-left text-sm font-semibold hover:bg-muted/70"
      title={t("boards.list.renameHint")}
      onClick={() => {
        doneRef.current = false;
        setValue(column.title);
        setEditing(true);
      }}
    >
      {column.title}
    </button>
  );
}

export function ColumnMenu({
  orgId,
  boardId,
  column,
  columns,
  cardCount,
  cardTemplates,
  canUpdate,
  canDelete,
  actions,
  onAddCardTop,
}: {
  orgId: string;
  boardId: string;
  column: KanbanBoardColumn;
  /** The board's open columns, for the statuses already taken. */
  columns: KanbanBoardColumn[];
  cardCount: number;
  /** The board's template cards, for "New card from template". */
  cardTemplates: KanbanBoardCard[];
  canUpdate: boolean;
  canDelete: boolean;
  actions: BoardActions;
  onAddCardTop: () => void;
}) {
  const t = useTranslations("modules.planning");
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [wipLimit, setWipLimit] = useState(column.wip_limit ? String(column.wip_limit) : "");
  const [title, setTitle] = useState(column.title);
  const [description, setDescription] = useState(column.description ?? "");
  const [color, setColor] = useState(column.color ?? COLUMN_COLORS[0]);
  const [statusCategory, setStatusCategory] = useState(column.status_category);
  const [kind, setKind] = useState<ColumnKind>(column.status_category ? "status" : "plain");
  const [isPending, setIsPending] = useState(false);
  const takenStatuses = takenStatusesOf(columns, column.id);

  const openEdit = () => {
    setKind(column.status_category ? "status" : "plain");
    setTitle(columnName(t, column));
    setDescription(column.description ?? "");
    setColor(column.color ?? COLUMN_COLORS[0]);
    setStatusCategory(column.status_category);
    setWipLimit(column.wip_limit ? String(column.wip_limit) : "");
    setEditOpen(true);
  };

  const save = async () => {
    setIsPending(true);
    const saved = await actions.updateColumn({
      id: column.id,
      board_id: boardId,
      ...columnIdentity(t, kind, title, statusCategory),
      description,
      color,
      wip_limit: parseWipLimit(wipLimit),
    });
    setIsPending(false);
    if (saved) setEditOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("boards.columnMenu")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate">{columnName(t, column)}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canUpdate ? (
            <>
              <DropdownMenuItem onSelect={onAddCardTop}>
                <ArrowUpToLine className="mr-2 h-4 w-4" />
                {t("boards.list.addCardTop")}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="mr-2 h-4 w-4" />
                  {t("boards.color")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="p-2">
                  <div className="grid grid-cols-5 gap-1.5">
                    {COLUMN_COLORS.map((candidate) => (
                      <button
                        key={candidate}
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: candidate }}
                        aria-label={candidate}
                        onClick={() => void saveColumn(actions, column, { color: candidate })}
                      >
                        {column.color === candidate ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                  {column.color ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 w-full text-xs"
                      onClick={() => void saveColumn(actions, column, { color: null })}
                    >
                      <X className="mr-1.5 h-3 w-3" />
                      {t("boards.list.noColor")}
                    </Button>
                  ) : null}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  {t("boardExtras.templates.fromTemplate")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 w-60 overflow-y-auto">
                  {cardTemplates.length ? (
                    cardTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => void actions.createFromTemplate(template, column.id)}
                      >
                        <span className="truncate">{template.title}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t("boardExtras.templates.noCardTemplates")}
                    </p>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => setCopyOpen(true)}>
                <Copy className="mr-2 h-4 w-4" />
                {t("boardExtras.column.menu")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openEdit}>
                <Edit3 className="mr-2 h-4 w-4" />
                {t("boards.editColumn")}
              </DropdownMenuItem>
            </>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              {cardCount ? (
                <DropdownMenuItem onSelect={() => void actions.archiveColumnCards(column.id)}>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  {t("boards.list.archiveAllCards", { count: cardCount })}
                </DropdownMenuItem>
              ) : null}
              {/* Archiving can be undone from the toast or the board archive. */}
              <DropdownMenuItem onSelect={() => void actions.archiveColumn(column.id)}>
                <Archive className="mr-2 h-4 w-4" />
                {t("boards.archiveColumn")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("boards.editColumn")}</DialogTitle>
          </DialogHeader>
          <ColumnFields
            kind={kind}
            onKindChange={setKind}
            takenStatuses={takenStatuses}
            title={title}
            description={description}
            color={color}
            statusCategory={statusCategory}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onColorChange={setColor}
            onStatusCategoryChange={setStatusCategory}
            wipLimit={wipLimit}
            onWipLimitChange={setWipLimit}
          />
          <DialogFooter>
            <Button
              disabled={!columnReady(kind, title, statusCategory) || isPending}
              onClick={() => void save()}
            >
              {t("boards.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {copyOpen ? (
        <CopyColumnDialog
          orgId={orgId}
          boardId={boardId}
          column={column}
          actions={actions}
          onClose={() => setCopyOpen(false)}
        />
      ) : null}
    </>
  );
}

/** "Copy list": a name and the board it goes to (next to the original on this one). */
function CopyColumnDialog({
  orgId,
  boardId,
  column,
  actions,
  onClose,
}: {
  orgId: string;
  boardId: string;
  column: KanbanBoardColumn;
  actions: BoardActions;
  onClose: () => void;
}) {
  const t = useTranslations("modules.planning.boardExtras");
  const tPlanning = useTranslations("modules.planning");
  const [title, setTitle] = useState(
    t("copyName", { title: columnName(tPlanning, column) }).slice(0, 120)
  );
  const [targetId, setTargetId] = useState(boardId);
  const [isPending, setIsPending] = useState(false);
  const boards = useCopyTargetBoards(orgId, true);

  const submit = async () => {
    setIsPending(true);
    const copied = await actions.copyColumn(column.id, { title: title.trim(), boardId: targetId });
    setIsPending(false);
    if (copied) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("column.title")}</DialogTitle>
        </DialogHeader>
        <form
          id="copy-column-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="copy-column-title">{t("name")}</Label>
            <Input
              id="copy-column-title"
              autoFocus
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("column.board")}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger aria-label={t("column.board")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={boardId}>{t("column.thisBoard")}</SelectItem>
                {(boards.data ?? [])
                  .filter((board) => board.id !== boardId)
                  .map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{t("column.help")}</p>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="copy-column-form" disabled={!title.trim() || isPending}>
            {isPending ? t("copying") : t("column.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The closed "+ Add a card" at the bottom of a column. */
export function AddCardButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("modules.planning");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-full justify-start gap-1.5 px-2 text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <Plus className="h-4 w-4" />
      {t("boards.list.addCard")}
    </Button>
  );
}

/**
 * Adding cards, Trello style: Enter adds and keeps the field open for the next
 * one, Esc closes it, and pasting several lines adds one card per line.
 */
export function AddCardComposer({
  columnId,
  atTop = false,
  actions,
  onClose,
}: {
  columnId: string;
  atTop?: boolean;
  actions: BoardActions;
  onClose: () => void;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  /** Adds the titles in order; at the top they go in reverse so they read top-down. */
  const addAll = async (titles: string[]) => {
    // A ref, not state: two quick Enters must not create two cards.
    if (!titles.length || pendingRef.current) return false;
    pendingRef.current = true;
    setIsPending(true);
    let ok = true;
    for (const value of atTop ? [...titles].reverse() : titles) {
      ok = await actions.createCard(columnId, value, { atTop });
      if (!ok) break;
    }
    pendingRef.current = false;
    setIsPending(false);
    return ok;
  };

  const submit = async () => {
    const value = title.trim();
    if (await addAll(value ? [value] : [])) {
      setTitle("");
      inputRef.current?.focus();
    }
  };

  return (
    <form
      ref={formRef}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Textarea
        ref={inputRef}
        autoFocus
        rows={2}
        value={title}
        disabled={isPending && !title}
        onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))}
        onPaste={(event) => {
          const lines = event.clipboardData
            .getData("text")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (lines.length < 2) return;
          event.preventDefault();
          void addAll(lines.map((line) => line.slice(0, 300))).then((ok) => {
            if (ok) setTitle("");
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        onBlur={(event) => {
          // Leaving an empty field closes it; a typed title stays until Esc.
          if (!title.trim() && !formRef.current?.contains(event.relatedTarget as Node)) onClose();
        }}
        placeholder={t("boards.cardPlaceholder")}
        aria-label={t("boards.cardPlaceholder")}
        className="min-h-0 resize-none bg-card text-sm shadow-xs"
      />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" className="h-8" disabled={!title.trim() || isPending}>
          {t("boards.list.addCardSubmit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("boards.cancel")}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {t("boards.list.pasteHint")}
        </span>
      </div>
    </form>
  );
}

export function AddColumnPanel({
  boardId,
  columns,
  actions,
}: {
  boardId: string;
  /** The board's open columns, for the statuses already taken. */
  columns: KanbanBoardColumn[];
  actions: BoardActions;
}) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);
  const [statusCategory, setStatusCategory] = useState<KanbanTaskStatus | null>(null);
  const [kind, setKind] = useState<ColumnKind>("status");
  const [wipLimit, setWipLimit] = useState("");
  const [isPending, setIsPending] = useState(false);
  const takenStatuses = takenStatusesOf(columns);
  const firstFree = KANBAN_TASK_STATUSES.find((status) => !takenStatuses.includes(status)) ?? null;

  // Opening starts on the first free status; with every status taken, on a plain column.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setColor(COLUMN_COLORS[0]);
    setKind(firstFree ? "status" : "plain");
    setStatusCategory(firstFree);
    setWipLimit("");
    // Only when the panel opens, not while the board changes under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setIsPending(true);
    const created = await actions.createColumn({
      board_id: boardId,
      ...columnIdentity(t, kind, title, statusCategory),
      description,
      color,
      wip_limit: parseWipLimit(wipLimit),
    });
    setIsPending(false);
    if (created) setOpen(false);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-11 w-[min(88vw,21rem)] shrink-0 justify-start gap-2 rounded-md border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("boards.addColumn")}
      </Button>
    );
  }

  return (
    <section className="mt-3 flex min-h-[12rem] w-[min(88vw,21rem)] shrink-0 flex-col gap-3 rounded-md border border-dashed border-border bg-muted/10 p-3">
      <p className="text-sm font-semibold">{t("boards.addColumn")}</p>
      <ColumnFields
        kind={kind}
        onKindChange={setKind}
        takenStatuses={takenStatuses}
        title={title}
        description={description}
        color={color}
        statusCategory={statusCategory}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onColorChange={setColor}
        onStatusCategoryChange={setStatusCategory}
        wipLimit={wipLimit}
        onWipLimitChange={setWipLimit}
      />
      <div className="flex gap-2">
        <Button
          disabled={!columnReady(kind, title, statusCategory) || isPending}
          onClick={() => void submit()}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("boards.addColumn")}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
          {t("boards.cancel")}
        </Button>
      </div>
    </section>
  );
}

/** A status column (named after its status) or a plain one with a name of its own. */
type ColumnKind = "status" | "plain";

/** The statuses that already have an open column on the board (other than `exceptId`). */
function takenStatusesOf(columns: KanbanBoardColumn[], exceptId?: string): KanbanTaskStatus[] {
  return columns
    .filter((column) => column.id !== exceptId && !column.archived_at && column.status_category)
    .map((column) => column.status_category as KanbanTaskStatus);
}

function columnReady(kind: ColumnKind, title: string, status: KanbanTaskStatus | null) {
  return kind === "status" ? Boolean(status) : Boolean(title.trim());
}

/** The name and status saved for a column: a status column takes its status's name. */
function columnIdentity(
  t: ReturnType<typeof useTranslations>,
  kind: ColumnKind,
  title: string,
  status: KanbanTaskStatus | null
) {
  return kind === "status" && status
    ? { title: statusLabel(t, status), status_category: status }
    : { title: title.trim(), status_category: null };
}

function ColumnFields({
  kind,
  onKindChange,
  takenStatuses,
  title,
  description,
  color,
  statusCategory,
  onTitleChange,
  onDescriptionChange,
  onColorChange,
  onStatusCategoryChange,
  wipLimit,
  onWipLimitChange,
}: {
  kind: ColumnKind;
  onKindChange: (value: ColumnKind) => void;
  takenStatuses: KanbanTaskStatus[];
  title: string;
  description: string;
  color: string;
  statusCategory: KanbanTaskStatus | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onStatusCategoryChange: (value: KanbanTaskStatus | null) => void;
  wipLimit: string;
  onWipLimitChange: (value: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const freeStatuses = KANBAN_TASK_STATUSES.filter((status) => !takenStatuses.includes(status));
  const allTaken = freeStatuses.length === 0 && !statusCategory;

  const chooseKind = (next: ColumnKind) => {
    if (next === kind) return;
    onKindChange(next);
    if (next === "status") {
      onStatusCategoryChange(
        statusCategory && !takenStatuses.includes(statusCategory)
          ? statusCategory
          : (freeStatuses[0] ?? null)
      );
    } else {
      // A status column turned plain keeps its current name as a start.
      if (!title.trim() && statusCategory) onTitleChange(statusLabel(t, statusCategory));
      onStatusCategoryChange(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("boards.columnKind.label")}</Label>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-input p-1">
          {(["status", "plain"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={option === "status" && allTaken}
              aria-pressed={kind === option}
              onClick={() => chooseKind(option)}
              className={cn(
                "rounded px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                kind === option
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {t(`boards.columnKind.${option}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {kind === "status"
            ? t("boards.columnKind.statusHelp")
            : allTaken
              ? t("boards.columnKind.allTaken")
              : t("boards.columnKind.plainHelp")}
        </p>
      </div>
      {kind === "status" ? (
        <div className="space-y-2">
          <Label>{t("boards.columnStatus.label")}</Label>
          <Select
            value={statusCategory ?? undefined}
            onValueChange={(value) => onStatusCategoryChange(value as KanbanTaskStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_TASK_STATUSES.map((item) => {
                const taken = takenStatuses.includes(item);
                return (
                  <SelectItem key={item} value={item} disabled={taken}>
                    {statusLabel(t, item)}
                    {taken ? ` · ${t("boards.columnStatus.taken")}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t("boards.columnTitle")}</Label>
          <Input
            value={title}
            maxLength={120}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t("boards.columnPlaceholder")}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("boards.columnDescription")}</Label>
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={t("boards.columnDescriptionPlaceholder")}
          className="min-h-20"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="column-wip-limit">{t("boardExtras.wip.label")}</Label>
        <Input
          id="column-wip-limit"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={wipLimit}
          onChange={(event) => onWipLimitChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
          className="w-28"
        />
        <p className="text-xs text-muted-foreground">{t("boardExtras.wip.help")}</p>
      </div>
      <div className="space-y-2">
        <Label>{t("boards.color")}</Label>
        <div className="flex gap-1">
          {COLUMN_COLORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={cn(
                "h-6 w-6 rounded-full border border-border",
                color === candidate && "ring-2 ring-ring ring-offset-2 ring-offset-background"
              )}
              style={{ backgroundColor: candidate }}
              onClick={() => onColorChange(candidate)}
              aria-label={candidate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
