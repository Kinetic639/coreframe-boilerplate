"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Columns3, Globe2, Lock, Plus, SendHorizontal } from "lucide-react";
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
  getKanbanBoardAction,
  moveKanbanCardAction,
  reorderKanbanColumnsAction,
} from "@/app/actions/kanban";
import type {
  KanbanBoardCard,
  KanbanBoardDetail,
  KanbanBoardSummary,
  KanbanBoardColumn,
} from "@/server/services/kanban-boards.service";
import type { KanbanVisibility } from "@/lib/validations/kanban";
import { cn } from "@/utils";

interface PlanningBoardsClientProps {
  initialBoards: KanbanBoardSummary[];
  initialBoard: KanbanBoardDetail | null;
  canCreate: boolean;
  canUpdate: boolean;
}

const columnColors = ["#64748b", "#0d9488", "#f59e0b", "#6366f1", "#22c55e", "#ef4444"];

function actionError(result: unknown) {
  return "error" in (result as Record<string, unknown>)
    ? String((result as { error: string }).error)
    : "Operation failed";
}

export function PlanningBoardsClient({
  initialBoards,
  initialBoard,
  canCreate,
  canUpdate,
}: PlanningBoardsClientProps) {
  const t = useTranslations("modules.planning");
  const [boards, setBoards] = useState(initialBoards);
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoardDetail | null>(initialBoard);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  const refreshSelectedBoard = useCallback(async (boardId: string) => {
    const result = await getKanbanBoardAction(boardId);
    if (result.success) setSelectedBoard(result.data);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
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
          />
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)]">
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
              isPending={isPending}
              onBoardChange={setSelectedBoard}
              onRefresh={() => refreshSelectedBoard(selectedBoard.id)}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (board: KanbanBoardDetail) => void;
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
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("boards.newBoard")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("boards.createBoard")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
  isPending,
  onBoardChange,
  onRefresh,
}: {
  board: KanbanBoardDetail;
  canUpdate: boolean;
  isPending: boolean;
  onBoardChange: (board: KanbanBoardDetail) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("modules.planning");

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
    async ({ itemId, toColumnId, newIndex }: KanbanCardMoveParams) => {
      const previous = board;
      const movingCard = board.cards.find((card) => card.id === itemId);
      if (!movingCard) return;

      const optimisticCards = board.cards
        .filter((card) => card.id !== itemId)
        .concat({ ...movingCard, column_id: toColumnId, position: newIndex });

      onBoardChange({ ...board, cards: optimisticCards });
      const result = await moveKanbanCardAction({
        board_id: board.id,
        card_id: itemId,
        to_column_id: toColumnId,
        to_position: newIndex,
      });

      if (!result.success) {
        onBoardChange(previous);
        toast.error(actionError(result));
        return;
      }
      onBoardChange(result.data);
      onRefresh();
    },
    [board, onBoardChange, onRefresh]
  );

  const reorderColumns = useCallback(
    async (nextColumns: Array<{ id: string }>) => {
      const result = await reorderKanbanColumnsAction({
        board_id: board.id,
        column_ids: nextColumns.map((column) => column.id),
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onBoardChange(result.data);
    },
    [board.id, onBoardChange]
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
        {isPending ? (
          <span className="text-xs text-muted-foreground">{t("boards.loading")}</span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 p-4">
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
          onCardMove={moveCard}
          onColumnsChange={reorderColumns}
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
            <BoardCard card={card} column={board.columns.find((c) => c.id === card.column_id)} />
          )}
        />
      </div>
    </div>
  );
}

function BoardCard({ card, column }: { card: KanbanBoardCard; column?: KanbanBoardColumn }) {
  return (
    <KanbanCard id={card.id}>
      <div className="flex min-w-0 flex-col gap-2">
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
        {card.description ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">{card.description}</p>
        ) : null}
        <div className="text-xs text-muted-foreground">
          {card.creator_name ?? card.creator_email}
        </div>
      </div>
    </KanbanCard>
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
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(columnColors[0]);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    startTransition(async () => {
      const result = await createKanbanColumnAction({ board_id: boardId, title, color });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      setTitle("");
      onCreated(result.data);
    });
  }, [boardId, color, onCreated, title]);

  return (
    <section className="flex min-h-[12rem] w-[min(88vw,21rem)] shrink-0 flex-col gap-3 rounded-md border border-dashed border-border bg-muted/10 p-3">
      <p className="text-sm font-semibold">{t("boards.addColumn")}</p>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("boards.columnPlaceholder")}
      />
      <div className="flex gap-1">
        {columnColors.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={cn(
              "h-6 w-6 rounded-full border border-border",
              color === candidate && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
            style={{ backgroundColor: candidate }}
            onClick={() => setColor(candidate)}
            aria-label={candidate}
          />
        ))}
      </div>
      <Button disabled={!title.trim() || isPending} onClick={submit}>
        <Plus className="mr-1.5 h-4 w-4" />
        {t("boards.addColumn")}
      </Button>
    </section>
  );
}
