"use client";

import { forwardRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Filter, Flag, Loader2, Plus, Search, Trash2, User, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  createKanbanBoardLabelAction,
  deleteKanbanBoardLabelAction,
  listKanbanBoardActivityAction,
  updateKanbanBoardLabelAction,
} from "@/app/actions/kanban";
import type { KanbanBoardDetail, KanbanBoardLabel } from "@/lib/types/kanban";
import { KANBAN_TASK_PRIORITIES } from "@/lib/validations/kanban";
import { activityLabel } from "@/components/planning/task-editor/task-labels";
import { LABEL_COLORS, PRIORITY_FLAG_COLORS } from "@/components/planning/task-editor/task-labels";
import { cn } from "@/utils";
import {
  DUE_FILTERS,
  ME,
  NOBODY,
  activeFilterCount,
  hasActiveFilters,
  type BoardFilters,
  type DueFilter,
} from "./board-filters";
import { initials, priorityLabel } from "./board-format";
import { boardKeys, unwrap } from "./boards-query";
import type { BoardViewer } from "./use-board-realtime";

export const BOARD_SEARCH_INPUT_ID = "planning-board-search";

interface FilterPerson {
  user_id: string;
  name: string | null;
  email: string | null;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Search, "only mine" and the filter popover, above the columns. */
export const BoardFilterBar = forwardRef<
  HTMLInputElement,
  {
    filters: BoardFilters;
    labels: KanbanBoardLabel[];
    people: FilterPerson[];
    shown: number;
    total: number;
    onChange: (next: Partial<BoardFilters>) => void;
    onClear: () => void;
  }
>(function BoardFilterBar({ filters, labels, people, shown, total, onChange, onClear }, ref) {
  const t = useTranslations("modules.planning");
  const onlyMine = filters.people.length === 1 && filters.people[0] === ME;
  const count = activeFilterCount(filters);
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          id={BOARD_SEARCH_INPUT_ID}
          value={filters.q}
          onChange={(event) => onChange({ q: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (filters.q) onChange({ q: "" });
              else event.currentTarget.blur();
            }
          }}
          placeholder={t("boardTools.searchPlaceholder")}
          aria-label={t("boardTools.search")}
          className="h-8 bg-background/80 pl-8"
        />
      </div>
      <Button
        variant={onlyMine ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5"
        aria-pressed={onlyMine}
        onClick={() => onChange({ people: onlyMine ? [] : [ME] })}
      >
        <User className="h-3.5 w-3.5" />
        {t("boardTools.onlyMine")}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={count ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            {t("boardTools.filters")}
            {count ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[70vh] w-80 space-y-4 overflow-y-auto">
          <FilterGroup title={t("boardTools.people")}>
            <FilterOption
              selected={filters.people.includes(ME)}
              onClick={() => onChange({ people: toggle(filters.people, ME) })}
            >
              {t("boardTools.me")}
            </FilterOption>
            <FilterOption
              selected={filters.people.includes(NOBODY)}
              onClick={() => onChange({ people: toggle(filters.people, NOBODY) })}
            >
              {t("boards.task.unassigned")}
            </FilterOption>
            {people.map((person) => (
              <FilterOption
                key={person.user_id}
                selected={filters.people.includes(person.user_id)}
                onClick={() => onChange({ people: toggle(filters.people, person.user_id) })}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {initials(person.name, person.email)}
                </span>
                <span className="truncate">{person.name || person.email}</span>
              </FilterOption>
            ))}
          </FilterGroup>
          {labels.length ? (
            <FilterGroup title={t("taskEditor.labels")}>
              {labels.map((label) => (
                <FilterOption
                  key={label.id}
                  selected={filters.labels.includes(label.id)}
                  onClick={() => onChange({ labels: toggle(filters.labels, label.id) })}
                >
                  <span
                    className="h-4 min-w-8 truncate rounded px-1.5 text-[11px] font-semibold leading-4 text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name || " "}
                  </span>
                </FilterOption>
              ))}
            </FilterGroup>
          ) : null}
          <FilterGroup title={t("boards.dueDate")}>
            {DUE_FILTERS.map((due) => (
              <FilterOption
                key={due}
                selected={filters.due === due}
                onClick={() => onChange({ due: filters.due === due ? null : (due as DueFilter) })}
              >
                {t(`boardTools.due.${due}`)}
              </FilterOption>
            ))}
          </FilterGroup>
          <FilterGroup title={t("tasks.priority")}>
            {KANBAN_TASK_PRIORITIES.map((priority) => (
              <FilterOption
                key={priority}
                selected={filters.priority.includes(priority)}
                onClick={() => onChange({ priority: toggle(filters.priority, priority) })}
              >
                <Flag className={cn("h-3.5 w-3.5 fill-current", PRIORITY_FLAG_COLORS[priority])} />
                {priorityLabel(t, priority)}
              </FilterOption>
            ))}
          </FilterGroup>
        </PopoverContent>
      </Popover>
      {active ? (
        <>
          <span className="text-xs text-muted-foreground" role="status">
            {t("boardTools.shown", { shown, total })}
          </span>
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            {t("boardTools.clearFilters")}
          </Button>
        </>
      ) : null}
    </div>
  );
});

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          selected && "border-primary bg-primary text-primary-foreground"
        )}
        aria-hidden="true"
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
      {children}
    </button>
  );
}

/** Who else has the board open right now. */
export function BoardViewers({ viewers }: { viewers: BoardViewer[] }) {
  const t = useTranslations("modules.planning");
  if (!viewers.length) return null;
  const shown = viewers.slice(0, 3);
  const names = viewers.map((viewer) => viewer.name || "?").join(", ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1.5 rounded-full border bg-background/70 py-0.5 pl-1 pr-2"
          aria-label={t("boardTools.viewingNow", { names })}
        >
          <div className="flex -space-x-1.5">
            {shown.map((viewer) => (
              <span
                key={viewer.user_id}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-emerald-600 text-[10px] font-semibold text-white"
              >
                {initials(viewer.name, null)}
              </span>
            ))}
          </div>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {viewers.length > shown.length ? (
            <span className="text-[11px] text-muted-foreground">
              +{viewers.length - shown.length}
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent>{t("boardTools.viewingNow", { names })}</TooltipContent>
    </Tooltip>
  );
}

/** The board's labels: rename, recolour, remove, add. */
export function BoardLabelsDialog({
  orgId,
  board,
  open,
  onOpenChange,
  canEdit,
}: {
  orgId: string;
  board: KanbanBoardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const key = boardKeys.board(orgId, board.id);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);
  const labels = board.labels ?? [];

  const write = (update: (labels: KanbanBoardLabel[]) => KanbanBoardLabel[]) =>
    queryClient.setQueryData<KanbanBoardDetail>(key, (current) => {
      if (!current) return current;
      const nextLabels = update(current.labels ?? []);
      const byId = new Map(nextLabels.map((label) => [label.id, label]));
      return {
        ...current,
        labels: nextLabels,
        // Cards show the new name and colour (and lose a removed label) at once.
        cards: current.cards.map((card) => ({
          ...card,
          labels: (card.labels ?? [])
            .filter((label) => byId.has(label.id))
            .map((label) => byId.get(label.id)!),
        })),
      };
    });
  const fail = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : "Operation failed");
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const create = useMutation({
    mutationFn: () =>
      unwrap(createKanbanBoardLabelAction({ board_id: board.id, name: name.trim(), color })),
    onSuccess: (label) => {
      write((current) => [...current, label]);
      setName("");
    },
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (label: KanbanBoardLabel) =>
      unwrap(
        updateKanbanBoardLabelAction({
          board_id: board.id,
          id: label.id,
          name: label.name,
          color: label.color,
        })
      ),
    onMutate: (label) =>
      write((current) => current.map((item) => (item.id === label.id ? label : item))),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteKanbanBoardLabelAction({ board_id: board.id, id })),
    onMutate: (id) => write((current) => current.filter((item) => item.id !== id)),
    onError: fail,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("boardTools.labelsTitle")}</DialogTitle>
          <DialogDescription>{t("boardTools.labelsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {labels.length ? (
            labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                disabled={!canEdit}
                onSave={(next) => update.mutate(next)}
                onDelete={() => remove.mutate(label.id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("taskEditor.noBoardLabels")}</p>
          )}
        </div>
        {canEdit ? (
          <>
            <Separator />
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!create.isPending) create.mutate();
              }}
            >
              <div className="flex gap-2">
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("taskEditor.labelPlaceholder")}
                  aria-label={t("taskEditor.labelPlaceholder")}
                  className="h-8"
                />
                <Button type="submit" size="sm" className="gap-1.5" disabled={create.isPending}>
                  {create.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("boardTools.addLabel")}
                </Button>
              </div>
              <ColorRow value={color} onChange={setColor} />
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const t = useTranslations("modules.planning");
  return (
    <div className="grid grid-cols-10 gap-1">
      {LABEL_COLORS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={cn(
            "h-6 rounded",
            value === candidate && "ring-2 ring-ring ring-offset-1 ring-offset-background"
          )}
          style={{ backgroundColor: candidate }}
          onClick={() => onChange(candidate)}
          aria-label={t("taskEditor.labelColor", { color: candidate })}
          aria-pressed={value === candidate}
        />
      ))}
    </div>
  );
}

function LabelRow({
  label,
  disabled,
  onSave,
  onDelete,
}: {
  label: KanbanBoardLabel;
  disabled: boolean;
  onSave: (label: KanbanBoardLabel) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("modules.planning");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-md border p-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...label, name: name.trim(), color });
          setEditing(false);
        }}
      >
        <Input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          aria-label={t("taskEditor.labelPlaceholder")}
          className="h-8"
        />
        <ColorRow value={color} onChange={setColor} />
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {t("boards.save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            {t("taskEditor.close")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setName(label.name);
          setColor(label.color);
          setEditing(true);
        }}
        className="h-8 flex-1 truncate rounded-md px-2 text-left text-sm font-semibold text-white disabled:cursor-default"
        style={{ backgroundColor: label.color }}
      >
        {label.name || " "}
      </button>
      {!disabled ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDelete}
          aria-label={t("boardTools.deleteLabel", { name: label.name })}
          title={t("boardTools.deleteLabel", { name: label.name })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/** Everything that happened on the board's cards, newest first. */
export function BoardActivitySheet({
  orgId,
  boardId,
  open,
  onOpenChange,
  onOpenCard,
}: {
  orgId: string;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCard: (taskNumber: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const activity = useQuery({
    queryKey: [...boardKeys.board(orgId, boardId), "activity"],
    queryFn: () => unwrap(listKanbanBoardActivityAction(boardId)),
    enabled: open,
    staleTime: 0,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("boardTools.activityTitle")}</SheetTitle>
          <SheetDescription>{t("boardTools.activityDescription")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {activity.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("boards.loading")}
            </div>
          ) : activity.isError ? (
            <p className="text-sm text-destructive">{activity.error.message}</p>
          ) : !activity.data.length ? (
            <p className="text-sm text-muted-foreground">{t("boards.noActivity")}</p>
          ) : (
            <ol className="space-y-1">
              {activity.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full gap-2.5 rounded-md p-2 text-left hover:bg-muted"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCard(item.task_number);
                    }}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {initials(item.actor_name, item.actor_email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-medium">
                          {item.actor_name ?? item.actor_email ?? t("boards.systemActor")}
                        </span>{" "}
                        {activityLabel(t, item.activity_type, item.message).toLowerCase()}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{item.task_number}</span> · {item.task_title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {format.relativeTime(new Date(item.created_at))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const BOARD_SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/", "F"], label: "search" },
  { keys: ["Q"], label: "onlyMine" },
  { keys: ["Esc"], label: "clear" },
  { keys: ["Enter"], label: "open" },
  { keys: ["E"], label: "menu" },
  { keys: ["Space"], label: "take" },
  { keys: ["C"], label: "archive" },
  { keys: ["?"], label: "help" },
];

export function BoardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("boardTools.shortcutsTitle")}</DialogTitle>
          <DialogDescription>{t("boardTools.shortcutsDescription")}</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {BOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-4">
              <dt>{t(`boardTools.shortcuts.${shortcut.label}`)}</dt>
              <dd className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
