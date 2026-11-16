"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Edit3, MoreHorizontal, Plus, SendHorizontal } from "lucide-react";
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
import type { KanbanBoardColumn, KanbanTaskStatus } from "@/lib/types/kanban";
import { KANBAN_TASK_STATUSES } from "@/lib/validations/kanban";
import { cn } from "@/utils";
import { COLUMN_COLORS, statusLabel } from "./board-format";
import type { BoardActions } from "./use-board-actions";

export function ColumnMenu({
  boardId,
  column,
  canUpdate,
  canDelete,
  actions,
}: {
  boardId: string;
  column: KanbanBoardColumn;
  canUpdate: boolean;
  canDelete: boolean;
  actions: BoardActions;
}) {
  const t = useTranslations("modules.planning");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [description, setDescription] = useState(column.description ?? "");
  const [color, setColor] = useState(column.color ?? COLUMN_COLORS[0]);
  const [statusCategory, setStatusCategory] = useState(column.status_category);
  const [isPending, setIsPending] = useState(false);

  const openEdit = () => {
    setTitle(column.title);
    setDescription(column.description ?? "");
    setColor(column.color ?? COLUMN_COLORS[0]);
    setStatusCategory(column.status_category);
    setEditOpen(true);
  };

  const save = async () => {
    setIsPending(true);
    const saved = await actions.updateColumn({
      id: column.id,
      board_id: boardId,
      title,
      description,
      color,
      status_category: statusCategory,
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
        <DropdownMenuContent align="end">
          {canUpdate ? (
            <DropdownMenuItem onClick={openEdit}>
              <Edit3 className="mr-2 h-4 w-4" />
              {t("boards.editColumn")}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            // Archiving can be undone from the toast or the board archive.
            <DropdownMenuItem onClick={() => void actions.archiveColumn(column.id)}>
              <Archive className="mr-2 h-4 w-4" />
              {t("boards.archiveColumn")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("boards.editColumn")}</DialogTitle>
          </DialogHeader>
          <ColumnFields
            title={title}
            description={description}
            color={color}
            statusCategory={statusCategory}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onColorChange={setColor}
            onStatusCategoryChange={setStatusCategory}
          />
          <DialogFooter>
            <Button disabled={!title.trim() || isPending} onClick={() => void save()}>
              {t("boards.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Quick add at the bottom of a column: Enter adds and keeps the field open for the next one. */
export function AddCardForm({ columnId, actions }: { columnId: string; actions: BoardActions }) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const value = title.trim();
    // A ref, not state: two quick Enters must not create two cards.
    if (!value || pendingRef.current) return;
    pendingRef.current = true;
    setIsPending(true);
    const created = await actions.createCard(columnId, value);
    pendingRef.current = false;
    setIsPending(false);
    if (created) {
      setTitle("");
      inputRef.current?.focus();
    }
  };

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("boards.cardPlaceholder")}
        aria-label={t("boards.cardPlaceholder")}
        className="h-8"
      />
      <Button
        type="submit"
        size="icon"
        className="h-8 w-8"
        disabled={!title.trim() || isPending}
        aria-label={t("boards.addCard")}
      >
        <SendHorizontal className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function AddColumnPanel({ boardId, actions }: { boardId: string; actions: BoardActions }) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);
  const [statusCategory, setStatusCategory] = useState<KanbanTaskStatus | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (open) return;
    setTitle("");
    setDescription("");
    setColor(COLUMN_COLORS[0]);
    setStatusCategory(null);
  }, [open]);

  const submit = async () => {
    setIsPending(true);
    const created = await actions.createColumn({
      board_id: boardId,
      title,
      description,
      color,
      status_category: statusCategory,
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
        title={title}
        description={description}
        color={color}
        statusCategory={statusCategory}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onColorChange={setColor}
        onStatusCategoryChange={setStatusCategory}
      />
      <div className="flex gap-2">
        <Button disabled={!title.trim() || isPending} onClick={() => void submit()}>
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

const NO_STATUS = "__none__";

function ColumnFields({
  title,
  description,
  color,
  statusCategory,
  onTitleChange,
  onDescriptionChange,
  onColorChange,
  onStatusCategoryChange,
}: {
  title: string;
  description: string;
  color: string;
  statusCategory: KanbanTaskStatus | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onStatusCategoryChange: (value: KanbanTaskStatus | null) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("boards.columnTitle")}</Label>
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={t("boards.columnPlaceholder")}
        />
      </div>
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
        <Label>{t("boards.columnStatus.label")}</Label>
        <Select
          value={statusCategory ?? NO_STATUS}
          onValueChange={(value) =>
            onStatusCategoryChange(value === NO_STATUS ? null : (value as KanbanTaskStatus))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_STATUS}>{t("boards.columnStatus.none")}</SelectItem>
            {KANBAN_TASK_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {statusLabel(t, item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("boards.columnStatus.help")}</p>
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
