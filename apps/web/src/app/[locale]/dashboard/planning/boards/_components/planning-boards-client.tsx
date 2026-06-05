"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  Columns3,
  Edit3,
  Globe2,
  Lock,
  MoreHorizontal,
  Plus,
  Save,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { KanbanBoard, KanbanCard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import {
  createKanbanBoardAction,
  createKanbanCardAction,
  createKanbanColumnAction,
  deleteKanbanBoardAction,
  deleteKanbanCardAction,
  deleteKanbanColumnAction,
  getKanbanBoardAction,
  moveKanbanCardAction,
  reorderKanbanColumnsAction,
  updateKanbanBoardAction,
  updateKanbanCardAction,
  updateKanbanColumnAction,
} from "@/app/actions/kanban";
import {
  MAX_KANBAN_BOARDS_PER_USER,
  type KanbanBoardCard,
  type KanbanBoardColumn,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
} from "@/lib/types/kanban";
import { useUiStoreV2 } from "@/lib/stores/v2/ui-store";
import type { KanbanVisibility } from "@/lib/validations/kanban";
import { cn } from "@/utils";

interface PlanningBoardsClientProps {
  initialBoards: KanbanBoardSummary[];
  initialBoard: KanbanBoardDetail | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const COLUMN_COLORS = ["#64748b", "#0d9488", "#f59e0b", "#6366f1", "#22c55e", "#ef4444"];
const LABEL_COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#e11d48", "#ea580c", "#16a34a"];

function actionError(result: unknown) {
  return "error" in (result as Record<string, unknown>)
    ? String((result as { error: string }).error)
    : "Operation failed";
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function applyCardMoveToBoard(
  board: KanbanBoardDetail,
  cardId: string,
  toColumnId: string,
  toIndex: number
): KanbanBoardDetail {
  const movingCard = board.cards.find((card) => card.id === cardId);
  if (!movingCard) return board;

  const nextCardsByColumn = new Map<string, KanbanBoardCard[]>();
  for (const column of board.columns) nextCardsByColumn.set(column.id, []);

  for (const card of board.cards) {
    if (card.id === cardId) continue;
    const list = nextCardsByColumn.get(card.column_id);
    if (list) list.push(card);
  }

  for (const list of nextCardsByColumn.values()) {
    list.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  const destination = nextCardsByColumn.get(toColumnId);
  if (!destination) return board;

  const boundedIndex = Math.max(0, Math.min(toIndex, destination.length));
  destination.splice(boundedIndex, 0, { ...movingCard, column_id: toColumnId });

  const cards = board.columns.flatMap((column) =>
    (nextCardsByColumn.get(column.id) ?? []).map((card, position) => ({
      ...card,
      position,
    }))
  );

  return { ...board, cards };
}

export function PlanningBoardsClient({
  initialBoards,
  initialBoard,
  canCreate,
  canUpdate,
  canDelete,
}: PlanningBoardsClientProps) {
  const t = useTranslations("modules.planning");
  const setFlushContent = useUiStoreV2((state) => state.setFlushContent);
  const [boards, setBoards] = useState(initialBoards);
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoardDetail | null>(initialBoard);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canCreateMore = canCreate && boards.length < MAX_KANBAN_BOARDS_PER_USER;

  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const selectBoard = useCallback((boardId: string) => {
    startTransition(async () => {
      const result = await getKanbanBoardAction(boardId);
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setSelectedBoard(result.data);
    });
  }, []);

  const handleBoardChange = useCallback((board: KanbanBoardDetail) => {
    setSelectedBoard(board);
    setBoards((current) =>
      current.map((item) =>
        item.id === board.id
          ? {
              id: board.id,
              organization_id: board.organization_id,
              title: board.title,
              description: board.description,
              visibility: board.visibility,
              created_by: board.created_by,
              creator_name: board.creator_name,
              creator_email: board.creator_email,
              created_at: board.created_at,
              updated_at: board.updated_at,
            }
          : item
      )
    );
  }, []);

  const handleBoardCreated = useCallback(
    (board: KanbanBoardDetail) => {
      setBoards((current) => [board, ...current.filter((item) => item.id !== board.id)]);
      setSelectedBoard(board);
      setCreateOpen(false);
      toast.success(t("boards.boardCreated"));
    },
    [t]
  );

  const handleBoardDeleted = useCallback(
    async (boardId: string) => {
      const result = await deleteKanbanBoardAction({ id: boardId });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setBoards(result.data);
      const nextBoard = result.data[0] ?? null;
      if (!nextBoard) {
        setSelectedBoard(null);
        return;
      }
      const detail = await getKanbanBoardAction(nextBoard.id);
      setSelectedBoard(detail.success ? detail.data : null);
      toast.success(t("boards.boardArchived"));
    },
    [t]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Columns3 className="h-5 w-5 text-teal-600" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{t("pages.boards.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("pages.boards.subtitle")}</p>
          </div>
        </div>
        {canCreate ? (
          <CreateBoardDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleBoardCreated}
            disabled={!canCreateMore}
            helperText={
              canCreateMore
                ? t("boards.limit", { count: boards.length, max: MAX_KANBAN_BOARDS_PER_USER })
                : t("boards.limitReached", { max: MAX_KANBAN_BOARDS_PER_USER })
            }
          />
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden">
        <aside className="min-h-0 border-r bg-muted/10">
          <div className="border-b p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("boards.myBoards")}
            </p>
          </div>
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto p-2">
            {boards.length ? (
              boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => selectBoard(board.id)}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 rounded-md px-3 py-2 text-left transition hover:bg-muted",
                    selectedBoard?.id === board.id && "bg-muted"
                  )}
                >
                  <span className="truncate text-sm font-medium">{board.title}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {board.visibility === "public" ? (
                      <Globe2 className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    <span>{t(`boards.visibility.${board.visibility}`)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-8 text-sm text-muted-foreground">{t("boards.empty")}</div>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-hidden">
          {selectedBoard ? (
            <BoardWorkspace
              board={selectedBoard}
              canUpdate={canUpdate}
              canDelete={canDelete}
              isPending={isPending}
              onBoardChange={handleBoardChange}
              onBoardDeleted={() => handleBoardDeleted(selectedBoard.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {t("boards.selectBoard")}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function CreateBoardDialog({
  open,
  onOpenChange,
  onCreated,
  disabled,
  helperText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (board: KanbanBoardDetail) => void;
  disabled: boolean;
  helperText: string;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<KanbanVisibility>("private");
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    startTransition(async () => {
      const result = await createKanbanBoardAction({ title, description, visibility });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setTitle("");
      setDescription("");
      setVisibility("private");
      onCreated(result.data);
    });
  }, [description, onCreated, title, visibility]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={disabled}>
          <Plus className="h-4 w-4" />
          {t("boards.newBoard")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("boards.createBoard")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{helperText}</p>
          <div className="space-y-2">
            <Label htmlFor="kanban-board-title">{t("boards.title")}</Label>
            <Input
              id="kanban-board-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("boards.titlePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kanban-board-description">{t("boards.description")}</Label>
            <Textarea
              id="kanban-board-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("boards.descriptionPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("boards.visibility.label")}</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as KanbanVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{t("boards.visibility.private")}</SelectItem>
                <SelectItem value="public">{t("boards.visibility.public")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!title.trim() || isPending} onClick={submit}>
            {isPending ? t("boards.creating") : t("boards.createBoard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoardWorkspace({
  board,
  canUpdate,
  canDelete,
  isPending,
  onBoardChange,
  onBoardDeleted,
}: {
  board: KanbanBoardDetail;
  canUpdate: boolean;
  canDelete: boolean;
  isPending: boolean;
  onBoardChange: (board: KanbanBoardDetail) => void;
  onBoardDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations("modules.planning");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const cardMoveRequestIdRef = useRef(0);
  const cardMovePersistenceQueueRef = useRef<Promise<void>>(Promise.resolve());

  const selectedCard = useMemo(
    () => board.cards.find((card) => card.id === selectedCardId) ?? null,
    [board.cards, selectedCardId]
  );

  const columns = useMemo(
    () =>
      board.columns.map((column) => ({
        id: column.id,
        title: column.title,
        description: column.description,
        color: column.color,
      })),
    [board.columns]
  );

  const moveCard = useCallback(
    ({ itemId, toColumnId, newIndex }: KanbanCardMoveParams) => {
      const requestId = cardMoveRequestIdRef.current + 1;
      cardMoveRequestIdRef.current = requestId;
      const previous = board;
      const optimisticBoard = applyCardMoveToBoard(board, itemId, toColumnId, newIndex);

      onBoardChange(optimisticBoard);

      const persistMove = async () => {
        try {
          const result = await moveKanbanCardAction({
            board_id: board.id,
            card_id: itemId,
            to_column_id: toColumnId,
            to_position: newIndex,
          });

          if (result.success) return;

          if (requestId === cardMoveRequestIdRef.current) {
            onBoardChange(previous);
          }
          toast.error(actionError(result));
        } catch (error) {
          if (requestId === cardMoveRequestIdRef.current) {
            onBoardChange(previous);
          }

          toast.error(error instanceof Error ? error.message : "Operation failed");
        }
      };

      cardMovePersistenceQueueRef.current = cardMovePersistenceQueueRef.current.then(
        persistMove,
        persistMove
      );
    },
    [board, onBoardChange]
  );

  const reorderColumns = useCallback(
    async (nextColumns: Array<{ id: string }>) => {
      const optimisticColumns = nextColumns
        .map((column, index) => {
          const fullColumn = board.columns.find((candidate) => candidate.id === column.id);
          return fullColumn ? { ...fullColumn, position: index } : null;
        })
        .filter((column): column is KanbanBoardColumn => Boolean(column));
      onBoardChange({ ...board, columns: optimisticColumns });

      const result = await reorderKanbanColumnsAction({
        board_id: board.id,
        column_ids: nextColumns.map((column) => column.id),
      });
      if (!result.success) {
        toast.error(actionError(result));
        onBoardChange(board);
        return;
      }
      onBoardChange(result.data);
    },
    [board, onBoardChange]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{board.title}</h2>
            <Badge variant="outline" className="shrink-0 gap-1.5">
              {board.visibility === "public" ? (
                <Globe2 className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {t(`boards.visibility.${board.visibility}`)}
            </Badge>
          </div>
          {board.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{board.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isPending ? (
            <span className="text-xs text-muted-foreground">{t("boards.loading")}</span>
          ) : null}
          <BoardSettingsDialog
            board={board}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onChanged={onBoardChange}
            onDeleted={onBoardDeleted}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <KanbanBoard
          columns={columns}
          items={board.cards}
          getItemId={(card) => card.id}
          getItemColumnId={(card) => card.column_id}
          disabled={!canUpdate}
          labels={{
            emptyColumn: t("boards.emptyColumn"),
            dragColumn: t("boards.dragColumn"),
          }}
          className="gap-3 p-0 pb-0"
          columnClassName="min-h-0 rounded-none border-y-0"
          onCardMove={moveCard}
          onColumnsChange={reorderColumns}
          renderColumnActions={(column) =>
            canUpdate || canDelete ? (
              <ColumnMenu
                boardId={board.id}
                column={board.columns.find((candidate) => candidate.id === column.id)!}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onChanged={onBoardChange}
              />
            ) : null
          }
          renderColumnFooter={(column) =>
            canUpdate ? (
              <AddCardForm boardId={board.id} columnId={column.id} onCreated={onBoardChange} />
            ) : null
          }
          renderAddColumn={
            canUpdate
              ? () => <AddColumnPanel boardId={board.id} onCreated={onBoardChange} />
              : undefined
          }
          renderCard={(card) => (
            <BoardCard
              card={card}
              column={board.columns.find((candidate) => candidate.id === card.column_id)}
              onOpen={() => setSelectedCardId(card.id)}
            />
          )}
        />
      </div>

      <CardDetailDialog
        board={board}
        card={selectedCard}
        columns={board.columns}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
        onChanged={onBoardChange}
        onDeleted={(nextBoard) => {
          onBoardChange(nextBoard);
          setSelectedCardId(null);
        }}
      />
    </div>
  );
}

function BoardSettingsDialog({
  board,
  canUpdate,
  canDelete,
  onChanged,
  onDeleted,
}: {
  board: KanbanBoardDetail;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: (board: KanbanBoardDetail) => void;
  onDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? "");
  const [visibility, setVisibility] = useState<KanbanVisibility>(board.visibility);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setTitle(board.title);
    setDescription(board.description ?? "");
    setVisibility(board.visibility);
  }, [board, open]);

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await updateKanbanBoardAction({
        id: board.id,
        title,
        description,
        visibility,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onChanged(result.data);
      setOpen(false);
      toast.success(t("boards.boardUpdated"));
    });
  }, [board.id, description, onChanged, t, title, visibility]);

  const archive = useCallback(() => {
    startTransition(async () => {
      await onDeleted();
      setOpen(false);
    });
  }, [onDeleted]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MoreHorizontal className="h-4 w-4" />
          {t("boards.boardMenu")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("boards.boardSettings")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("boards.title")}</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("boards.description")}</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("boards.visibility.label")}</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as KanbanVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{t("boards.visibility.private")}</SelectItem>
                <SelectItem value="public">{t("boards.visibility.public")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {canDelete ? (
            <Button variant="destructive" onClick={archive} disabled={isPending}>
              <Archive className="mr-1.5 h-4 w-4" />
              {t("boards.archiveBoard")}
            </Button>
          ) : (
            <span />
          )}
          {canUpdate ? (
            <Button disabled={!title.trim() || isPending} onClick={save}>
              <Save className="mr-1.5 h-4 w-4" />
              {t("boards.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnMenu({
  boardId,
  column,
  canUpdate,
  canDelete,
  onChanged,
}: {
  boardId: string;
  column: KanbanBoardColumn;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [description, setDescription] = useState(column.description ?? "");
  const [color, setColor] = useState(column.color ?? COLUMN_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!editOpen) return;
    setTitle(column.title);
    setDescription(column.description ?? "");
    setColor(column.color ?? COLUMN_COLORS[0]);
  }, [column, editOpen]);

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await updateKanbanColumnAction({
        id: column.id,
        board_id: boardId,
        title,
        description,
        color,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onChanged(result.data);
      setEditOpen(false);
    });
  }, [boardId, color, column.id, description, onChanged, title]);

  const archive = useCallback(() => {
    startTransition(async () => {
      const result = await deleteKanbanColumnAction({ board_id: boardId, id: column.id });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onChanged(result.data);
    });
  }, [boardId, column.id, onChanged]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit3 className="mr-2 h-4 w-4" />
              {t("boards.editColumn")}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <DropdownMenuItem className="text-destructive" onClick={archive} disabled={isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
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
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onColorChange={setColor}
          />
          <DialogFooter>
            <Button disabled={!title.trim() || isPending} onClick={save}>
              {t("boards.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoardCard({
  card,
  column,
  onOpen,
}: {
  card: KanbanBoardCard;
  column?: KanbanBoardColumn;
  onOpen: () => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <KanbanCard id={card.id}>
      <button
        type="button"
        className="flex w-full min-w-0 cursor-grab flex-col gap-2 text-left active:cursor-grabbing"
        onClick={onOpen}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-3 text-sm font-medium">{card.title}</h3>
          {column?.color ? (
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: column.color }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        {card.label ? (
          <span
            className="w-fit rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: card.label_color ?? "#64748b" }}
          >
            {card.label}
          </span>
        ) : null}
        {card.description ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">{card.description}</p>
        ) : null}
        <div className="flex items-end justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{card.creator_name ?? card.creator_email}</span>
          {card.due_at ? (
            <span className="shrink-0">
              {t("boards.dueShort")}: {formatDate(card.due_at)}
            </span>
          ) : null}
        </div>
      </button>
    </KanbanCard>
  );
}

function CardDetailDialog({
  board,
  card,
  columns,
  canUpdate,
  canDelete,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  board: KanbanBoardDetail;
  card: KanbanBoardCard | null;
  columns: KanbanBoardColumn[];
  canUpdate: boolean;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (board: KanbanBoardDetail) => void;
  onDeleted: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [label, setLabel] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(card?.title ?? "");
    setDescription(card?.description ?? "");
    setColumnId(card?.column_id ?? "");
    setDueAt(toDateInput(card?.due_at ?? null));
    setLabel(card?.label ?? "");
    setLabelColor(card?.label_color ?? LABEL_COLORS[0]);
  }, [card]);

  const save = useCallback(() => {
    if (!card) return;
    startTransition(async () => {
      const result = await updateKanbanCardAction({
        id: card.id,
        board_id: board.id,
        column_id: columnId,
        title,
        description,
        due_at: fromDateInput(dueAt),
        label,
        label_color: label ? labelColor : null,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onChanged(result.data);
      onOpenChange(false);
    });
  }, [
    board.id,
    card,
    columnId,
    description,
    dueAt,
    label,
    labelColor,
    onChanged,
    onOpenChange,
    title,
  ]);

  const archive = useCallback(() => {
    if (!card) return;
    startTransition(async () => {
      const result = await deleteKanbanCardAction(board.id, card.id);
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onDeleted(result.data);
    });
  }, [board.id, card, onDeleted]);

  return (
    <Dialog open={Boolean(card)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("boards.cardDetails")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("boards.cardTitle")}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("boards.cardDescription")}</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-40"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("boards.column")}</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("boards.dueDate")}</Label>
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("boards.label")}</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} />
              <div className="flex flex-wrap gap-1">
                {LABEL_COLORS.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-full border border-border",
                      labelColor === candidate &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: candidate }}
                    onClick={() => setLabelColor(candidate)}
                    aria-label={candidate}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {canDelete ? (
            <Button variant="destructive" onClick={archive} disabled={isPending || !card}>
              <Archive className="mr-1.5 h-4 w-4" />
              {t("boards.archiveCard")}
            </Button>
          ) : (
            <span />
          )}
          {canUpdate ? (
            <Button disabled={!title.trim() || !columnId || isPending} onClick={save}>
              <Save className="mr-1.5 h-4 w-4" />
              {t("boards.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddCardForm({
  boardId,
  columnId,
  onCreated,
}: {
  boardId: string;
  columnId: string;
  onCreated: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    startTransition(async () => {
      const result = await createKanbanCardAction({
        board_id: boardId,
        column_id: columnId,
        title,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setTitle("");
      onCreated(result.data);
    });
  }, [boardId, columnId, onCreated, title]);

  return (
    <div className="flex gap-2">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("boards.cardPlaceholder")}
        className="h-8"
        onKeyDown={(event) => {
          if (event.key === "Enter" && title.trim()) submit();
        }}
      />
      <Button
        size="icon"
        className="h-8 w-8"
        disabled={!title.trim() || isPending}
        onClick={submit}
      >
        <SendHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AddColumnPanel({
  boardId,
  onCreated,
}: {
  boardId: string;
  onCreated: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    startTransition(async () => {
      const result = await createKanbanColumnAction({
        board_id: boardId,
        title,
        description,
        color,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setTitle("");
      setDescription("");
      setOpen(false);
      onCreated(result.data);
    });
  }, [boardId, color, description, onCreated, title]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-[min(88vw,21rem)] shrink-0 justify-start gap-2 rounded-md border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("boards.addColumn")}
      </Button>
    );
  }

  return (
    <section className="flex min-h-[12rem] w-[min(88vw,21rem)] shrink-0 flex-col gap-3 rounded-md border border-dashed border-border bg-muted/10 p-3">
      <p className="text-sm font-semibold">{t("boards.addColumn")}</p>
      <ColumnFields
        title={title}
        description={description}
        color={color}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onColorChange={setColor}
      />
      <div className="flex gap-2">
        <Button disabled={!title.trim() || isPending} onClick={submit}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("boards.addColumn")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setTitle("");
            setDescription("");
            setColor(COLUMN_COLORS[0]);
            setOpen(false);
          }}
        >
          {t("boards.cancel")}
        </Button>
      </div>
    </section>
  );
}

function ColumnFields({
  title,
  description,
  color,
  onTitleChange,
  onDescriptionChange,
  onColorChange,
}: {
  title: string;
  description: string;
  color: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
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
