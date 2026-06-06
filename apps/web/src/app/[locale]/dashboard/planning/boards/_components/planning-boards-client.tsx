"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  Activity,
  Calendar,
  Edit3,
  Globe2,
  Inbox,
  KanbanSquare,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  SendHorizontal,
  Trash2,
  User,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanBoard, KanbanCard, type KanbanCardMoveParams } from "@/components/primitives/kanban";
import { PageLoader } from "@/components/page-loader";
import { CommentsThread } from "@/components/features/comments";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";
import {
  createKanbanBoardAction,
  createKanbanCardAction,
  createKanbanColumnAction,
  deleteKanbanBoardAction,
  deleteKanbanCardAction,
  deleteKanbanColumnAction,
  getKanbanBoardAction,
  listKanbanInboxCardsAction,
  listKanbanBoardsAction,
  listKanbanCardActivityAction,
  moveKanbanCardToInboxAction,
  moveKanbanCardAction,
  moveKanbanInboxCardToBoardAction,
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
  type KanbanCardActivity,
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
const INBOX_COLUMN_ID = "__kanban_inbox__";

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

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityLabel(
  t: ReturnType<typeof useTranslations>,
  type: string,
  fallback: string | null
) {
  const keys: Record<string, string> = {
    card_created: "activityMessages.cardCreated",
    card_updated: "activityMessages.cardUpdated",
    card_moved: "activityMessages.cardMoved",
    card_moved_to_inbox: "activityMessages.cardMovedToInbox",
    card_moved_from_inbox: "activityMessages.cardMovedFromInbox",
    card_archived: "activityMessages.cardArchived",
    comment_added: "activityMessages.commentAdded",
  };
  const key = keys[type];
  return key ? t(`boards.${key}`) : (fallback ?? type);
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

function removeCardFromBoard(board: KanbanBoardDetail, cardId: string): KanbanBoardDetail {
  const cards = board.cards.filter((card) => card.id !== cardId);
  return { ...board, cards };
}

function addInboxCardToBoard(
  board: KanbanBoardDetail,
  card: KanbanBoardCard,
  toColumnId: string,
  toIndex: number
): KanbanBoardDetail {
  const nextBoard: KanbanBoardDetail = {
    ...board,
    cards: [
      ...board.cards.filter((candidate) => candidate.id !== card.id),
      {
        ...card,
        board_id: board.id,
        column_id: toColumnId,
        is_inbox: false,
      },
    ],
  };
  return applyCardMoveToBoard(nextBoard, card.id, toColumnId, toIndex);
}

function moveBoardCardToInbox(cards: KanbanBoardCard[], card: KanbanBoardCard): KanbanBoardCard[] {
  return [
    { ...card, is_inbox: true, updated_at: new Date().toISOString() },
    ...cards.filter((candidate) => candidate.id !== card.id),
  ].map((candidate, position) => ({ ...candidate, position }));
}

function moveInboxCardWithinInbox(
  cards: KanbanBoardCard[],
  cardId: string,
  toIndex: number
): KanbanBoardCard[] {
  const moving = cards.find((card) => card.id === cardId);
  if (!moving) return cards;
  const next = cards.filter((card) => card.id !== cardId);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moving);
  return next.map((card, position) => ({ ...card, position }));
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
  const [activeBoardId, setActiveBoardId] = useState<string | null>(initialBoard?.id ?? null);
  const [loadingBoardId, setLoadingBoardId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [inboxCards, setInboxCards] = useState<KanbanBoardCard[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const boardLoadRequestIdRef = useRef(0);

  const canCreateMore = canCreate && boards.length < MAX_KANBAN_BOARDS_PER_USER;

  useEffect(() => {
    setFlushContent(true);
    return () => setFlushContent(false);
  }, [setFlushContent]);

  const setBoardParam = useCallback((boardId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (boardId) {
      params.set("board", boardId);
    } else {
      params.delete("board");
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.pushState(null, "", nextUrl);
  }, []);

  const refreshBoards = useCallback(async () => {
    const result = await listKanbanBoardsAction();
    if (result.success) {
      setBoards(result.data);
      return result.data;
    }
    toast.error(actionError(result));
    return null;
  }, []);

  const refreshInbox = useCallback(async () => {
    setLoadingInbox(true);
    const result = await listKanbanInboxCardsAction();
    setLoadingInbox(false);
    if (result.success) {
      setInboxCards(result.data);
      return result.data;
    }
    toast.error(actionError(result));
    return null;
  }, []);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const loadBoard = useCallback(async (boardId: string) => {
    const requestId = boardLoadRequestIdRef.current + 1;
    boardLoadRequestIdRef.current = requestId;
    setActiveBoardId(boardId);
    setLoadingBoardId(boardId);

    const result = await getKanbanBoardAction(boardId);
    if (requestId !== boardLoadRequestIdRef.current) return;

    if (!result.success) {
      setLoadingBoardId(null);
      toast.error(actionError(result));
      return;
    }

    setSelectedBoard(result.data);
    setLoadingBoardId(null);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const boardId = new URLSearchParams(window.location.search).get("board");
      if (!boardId) return;
      void loadBoard(boardId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadBoard]);

  const selectBoard = useCallback(
    (boardId: string) => {
      if (activeBoardId === boardId) return;
      setBoardParam(boardId);
      void loadBoard(boardId);
    },
    [activeBoardId, loadBoard, setBoardParam]
  );

  const handleBoardChange = useCallback(
    (board: KanbanBoardDetail) => {
      if (activeBoardId && board.id !== activeBoardId) return;
      setSelectedBoard(board);
      setBoards((current) =>
        [
          {
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
          },
          ...current.filter((item) => item.id !== board.id),
        ].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      );
    },
    [activeBoardId]
  );

  const handleBoardCreated = useCallback(
    (board: KanbanBoardDetail) => {
      setBoards((current) => [board, ...current.filter((item) => item.id !== board.id)]);
      boardLoadRequestIdRef.current += 1;
      setActiveBoardId(board.id);
      setLoadingBoardId(null);
      setSelectedBoard(board);
      setBoardParam(board.id);
      setCreateOpen(false);
      setSwitcherOpen(false);
      void refreshBoards();
      toast.success(t("boards.boardCreated"));
    },
    [refreshBoards, setBoardParam, t]
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
        boardLoadRequestIdRef.current += 1;
        setActiveBoardId(null);
        setSelectedBoard(null);
        setLoadingBoardId(null);
        setBoardParam(null);
        return;
      }
      setBoardParam(nextBoard.id);
      void loadBoard(nextBoard.id);
      toast.success(t("boards.boardArchived"));
    },
    [loadBoard, setBoardParam, t]
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_3rem] overflow-hidden">
        <main className="min-h-0 overflow-hidden">
          {selectedBoard || loadingBoardId ? (
            <BoardWorkspace
              board={selectedBoard}
              boardLoading={Boolean(loadingBoardId)}
              inboxOpen={inboxOpen}
              inboxCards={inboxCards}
              loadingInbox={loadingInbox}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onBoardChange={handleBoardChange}
              onInboxChange={setInboxCards}
              onRefreshInbox={refreshInbox}
              onBoardDeleted={() => selectedBoard && handleBoardDeleted(selectedBoard.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {t("boards.selectBoard")}
            </div>
          )}
        </main>
        <KanbanRightToolbar
          inboxOpen={inboxOpen}
          onInboxToggle={() => setInboxOpen((value) => !value)}
          onSwitchBoards={() => setSwitcherOpen(true)}
        />
        <BoardSwitcherDialog
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
          boards={boards}
          activeBoardId={activeBoardId}
          canCreate={canCreate}
          canCreateMore={canCreateMore}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          onBoardCreated={handleBoardCreated}
          onSelectBoard={(boardId) => {
            selectBoard(boardId);
            setSwitcherOpen(false);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function KanbanRightToolbar({
  inboxOpen,
  onInboxToggle,
  onSwitchBoards,
}: {
  inboxOpen: boolean;
  onInboxToggle: () => void;
  onSwitchBoards: () => void;
}) {
  const t = useTranslations("modules.planning");

  return (
    <aside className="flex min-h-0 flex-col items-center border-l bg-muted/10 px-1.5 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={inboxOpen ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={onInboxToggle}
            aria-pressed={inboxOpen}
            aria-label={t("boards.inbox.toggle")}
          >
            <Inbox className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{t("boards.inbox.toggle")}</TooltipContent>
      </Tooltip>

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              className="h-8 w-8"
              onClick={onSwitchBoards}
              aria-label={t("boards.switchBoards")}
            >
              <KanbanSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t("boards.switchBoards")}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function BoardSwitcherDialog({
  open,
  onOpenChange,
  boards,
  activeBoardId,
  canCreate,
  canCreateMore,
  createOpen,
  onCreateOpenChange,
  onBoardCreated,
  onSelectBoard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: KanbanBoardSummary[];
  activeBoardId: string | null;
  canCreate: boolean;
  canCreateMore: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onBoardCreated: (board: KanbanBoardDetail) => void;
  onSelectBoard: (boardId: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const [query, setQuery] = useState("");

  const filteredBoards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return boards;
    return boards.filter(
      (board) =>
        board.title.toLowerCase().includes(normalized) ||
        (board.description ?? "").toLowerCase().includes(normalized)
    );
  }, [boards, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("boards.switchBoards")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("boards.boardSearch")}
              className="pl-9"
              autoFocus
            />
          </div>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("boards.recentBoards")}
            </p>
            {filteredBoards.length ? (
              <div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredBoards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => onSelectBoard(board.id)}
                    className={cn(
                      "flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 text-left transition hover:border-muted-foreground/50 hover:bg-muted/40",
                      activeBoardId === board.id && "border-primary ring-1 ring-primary/40"
                    )}
                  >
                    <span className="truncate text-sm font-semibold">{board.title}</span>
                    {board.description ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {board.description}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {board.visibility === "public" ? (
                        <Globe2 className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {t(`boards.visibility.${board.visibility}`)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                {t("boards.empty")}
              </div>
            )}
          </section>

          {canCreate ? (
            <CreateBoardDialog
              open={createOpen}
              onOpenChange={onCreateOpenChange}
              onCreated={onBoardCreated}
              disabled={!canCreateMore}
              helperText={
                canCreateMore
                  ? t("boards.limit", { count: boards.length, max: MAX_KANBAN_BOARDS_PER_USER })
                  : t("boards.limitReached", { max: MAX_KANBAN_BOARDS_PER_USER })
              }
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
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
        <Button size="sm" className="w-full justify-start gap-1.5" disabled={disabled}>
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
  boardLoading,
  inboxOpen,
  inboxCards,
  loadingInbox,
  canUpdate,
  canDelete,
  onBoardChange,
  onInboxChange,
  onRefreshInbox,
  onBoardDeleted,
}: {
  board: KanbanBoardDetail | null;
  boardLoading: boolean;
  inboxOpen: boolean;
  inboxCards: KanbanBoardCard[];
  loadingInbox: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onBoardChange: (board: KanbanBoardDetail) => void;
  onInboxChange: (cards: KanbanBoardCard[]) => void;
  onRefreshInbox: () => Promise<KanbanBoardCard[] | null>;
  onBoardDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations("modules.planning");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [collapsedColumnIds, setCollapsedColumnIds] = useState<string[]>([]);
  const cardMoveRequestIdRef = useRef(0);
  const cardMovePersistenceQueueRef = useRef<Promise<void>>(Promise.resolve());

  const selectedCard = useMemo(
    () =>
      board?.cards.find((card) => card.id === selectedCardId) ??
      inboxCards.find((card) => card.id === selectedCardId) ??
      null,
    [board?.cards, inboxCards, selectedCardId]
  );

  const columns = useMemo(() => {
    const boardColumns =
      board && !boardLoading
        ? board.columns.map((column) => ({
            id: column.id,
            title: column.title,
            description: column.description,
            color: column.color,
          }))
        : [];

    if (!inboxOpen) return boardColumns;

    return [
      {
        id: INBOX_COLUMN_ID,
        title: t("boards.inbox.title"),
        description: t("boards.inbox.description"),
        color: null,
      },
      ...boardColumns,
    ];
  }, [board, boardLoading, inboxOpen, t]);

  const kanbanItems = useMemo(
    () => [
      ...(inboxOpen && !loadingInbox ? inboxCards : []),
      ...(board && !boardLoading ? board.cards : []),
    ],
    [board, boardLoading, inboxCards, inboxOpen, loadingInbox]
  );

  const moveCard = useCallback(
    ({ itemId, fromColumnId, toColumnId, newIndex }: KanbanCardMoveParams) => {
      if (!board || boardLoading) {
        if (fromColumnId === INBOX_COLUMN_ID && toColumnId === INBOX_COLUMN_ID) {
          onInboxChange(moveInboxCardWithinInbox(inboxCards, itemId, newIndex));
        }
        return;
      }

      const requestId = cardMoveRequestIdRef.current + 1;
      cardMoveRequestIdRef.current = requestId;
      const previous = board;
      const previousInbox = inboxCards;
      const boardCard = board.cards.find((card) => card.id === itemId);
      const inboxCard = inboxCards.find((card) => card.id === itemId);

      if (fromColumnId === INBOX_COLUMN_ID && toColumnId === INBOX_COLUMN_ID) {
        onInboxChange(moveInboxCardWithinInbox(inboxCards, itemId, newIndex));
      } else if (toColumnId === INBOX_COLUMN_ID && boardCard) {
        onBoardChange(removeCardFromBoard(board, itemId));
        onInboxChange(moveBoardCardToInbox(inboxCards, boardCard));
      } else if (fromColumnId === INBOX_COLUMN_ID && inboxCard) {
        onInboxChange(inboxCards.filter((card) => card.id !== itemId));
        onBoardChange(addInboxCardToBoard(board, inboxCard, toColumnId, newIndex));
      } else {
        onBoardChange(applyCardMoveToBoard(board, itemId, toColumnId, newIndex));
      }

      const persistMove = async () => {
        try {
          if (fromColumnId === INBOX_COLUMN_ID && toColumnId === INBOX_COLUMN_ID) {
            return;
          }

          const result =
            toColumnId === INBOX_COLUMN_ID
              ? await moveKanbanCardToInboxAction({ board_id: board.id, card_id: itemId })
              : fromColumnId === INBOX_COLUMN_ID
                ? await moveKanbanInboxCardToBoardAction({
                    board_id: board.id,
                    card_id: itemId,
                    column_id: toColumnId,
                    position: newIndex,
                  })
                : await moveKanbanCardAction({
                    board_id: board.id,
                    card_id: itemId,
                    to_column_id: toColumnId,
                    to_position: newIndex,
                  });

          if (result.success) {
            if ("board" in result.data) {
              onBoardChange(result.data.board);
              onInboxChange(result.data.inbox);
            }
            return;
          }

          if (requestId === cardMoveRequestIdRef.current) {
            if (previous) onBoardChange(previous);
            onInboxChange(previousInbox);
          }
          toast.error(actionError(result));
        } catch (error) {
          if (requestId === cardMoveRequestIdRef.current) {
            if (previous) onBoardChange(previous);
            onInboxChange(previousInbox);
          }

          toast.error(error instanceof Error ? error.message : "Operation failed");
        }
      };

      cardMovePersistenceQueueRef.current = cardMovePersistenceQueueRef.current.then(
        persistMove,
        persistMove
      );
    },
    [board, boardLoading, inboxCards, onBoardChange, onInboxChange]
  );

  const reorderColumns = useCallback(
    async (nextColumns: Array<{ id: string }>) => {
      if (!board || boardLoading) return;
      const boardOnlyColumns = nextColumns.filter((column) => column.id !== INBOX_COLUMN_ID);
      const optimisticColumns = boardOnlyColumns
        .map((column, index) => {
          const fullColumn = board.columns.find((candidate) => candidate.id === column.id);
          return fullColumn ? { ...fullColumn, position: index } : null;
        })
        .filter((column): column is KanbanBoardColumn => Boolean(column));
      onBoardChange({ ...board, columns: optimisticColumns });

      const result = await reorderKanbanColumnsAction({
        board_id: board.id,
        column_ids: boardOnlyColumns.map((column) => column.id),
      });
      if (!result.success) {
        toast.error(actionError(result));
        onBoardChange(board);
        return;
      }
      onBoardChange(result.data);
    },
    [board, boardLoading, onBoardChange]
  );

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <KanbanBoard
        columns={columns}
        items={kanbanItems}
        getItemId={(card) => card.id}
        getItemColumnId={(card) => (card.is_inbox ? INBOX_COLUMN_ID : card.column_id)}
        disabled={!canUpdate || boardLoading || !board}
        labels={{
          emptyColumn: t("boards.emptyColumn"),
          dragColumn: t("boards.dragColumn"),
          collapseColumn: t("boards.collapseColumn"),
          expandColumn: t("boards.expandColumn"),
        }}
        scrollAreaClassName="m-3 ml-3 overflow-hidden rounded-lg border bg-muted/10"
        className="flex-1 gap-3 p-3 pb-3"
        columnClassName="min-h-0 rounded-md"
        fixedStartColumnIds={inboxOpen ? [INBOX_COLUMN_ID] : []}
        fixedStartClassName="m-3 mr-0 w-[18rem] overflow-hidden rounded-lg border bg-muted/10 shadow-sm"
        fixedColumnClassName="w-full rounded-none border-0 bg-transparent"
        nonDraggableColumnIds={[INBOX_COLUMN_ID]}
        renderScrollableHeader={
          board && !boardLoading
            ? () => (
                <div className="flex items-start justify-between gap-3 border-b bg-background/40 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-xl font-semibold">{board.title}</h2>
                      <Badge variant="outline" className="shrink-0 gap-1.5 bg-background/60">
                        {board.visibility === "public" ? (
                          <Globe2 className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        {t(`boards.visibility.${board.visibility}`)}
                      </Badge>
                    </div>
                    {board.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {board.description}
                      </p>
                    ) : null}
                  </div>
                  <BoardSettingsDialog
                    board={board}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onChanged={onBoardChange}
                    onDeleted={onBoardDeleted}
                  />
                </div>
              )
            : undefined
        }
        renderScrollableEmpty={
          boardLoading || !board
            ? () => <PageLoader className="h-full min-h-0 flex-1" />
            : undefined
        }
        collapsedColumnIds={collapsedColumnIds}
        onColumnCollapsedChange={(columnId, collapsed) => {
          if (columnId === INBOX_COLUMN_ID) return;
          setCollapsedColumnIds((current) =>
            collapsed
              ? Array.from(new Set([...current, columnId]))
              : current.filter((id) => id !== columnId)
          );
        }}
        onCardMove={moveCard}
        onColumnsChange={reorderColumns}
        renderColumnActions={(column) =>
          column.id === INBOX_COLUMN_ID || !board || boardLoading ? null : canUpdate ||
            canDelete ? (
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
          column.id === INBOX_COLUMN_ID || !board || boardLoading ? null : canUpdate ? (
            <AddCardForm boardId={board.id} columnId={column.id} onCreated={onBoardChange} />
          ) : null
        }
        renderColumnEmpty={(column) =>
          column.id === INBOX_COLUMN_ID && loadingInbox ? <InboxLoadingSkeleton /> : null
        }
        renderAddColumn={
          canUpdate && board && !boardLoading
            ? () => <AddColumnPanel boardId={board.id} onCreated={onBoardChange} />
            : undefined
        }
        renderCard={(card) => (
          <BoardCard
            card={card}
            column={board?.columns.find((candidate) => candidate.id === card.column_id)}
            onOpen={() => !boardLoading && setSelectedCardId(card.id)}
          />
        )}
      />

      {board ? (
        <CardDetailDialog
          board={board}
          card={selectedCard}
          columns={board.columns}
          canUpdate={canUpdate && !selectedCard?.is_inbox}
          canDelete={canDelete && !selectedCard?.is_inbox}
          onOpenChange={(open) => !open && setSelectedCardId(null)}
          onChanged={onBoardChange}
          onDeleted={(nextBoard) => {
            onBoardChange(nextBoard);
            void onRefreshInbox();
            setSelectedCardId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function InboxLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md border border-border bg-card p-3 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-2 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-24" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
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
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [columnId, setColumnId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [label, setLabel] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [activity, setActivity] = useState<KanbanCardActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(card?.title ?? "");
    setDescriptionRich(normalizeRichText(card?.description_rich) ?? createEmptyRichText());
    setColumnId(card?.is_inbox ? "" : (card?.column_id ?? ""));
    setDueAt(toDateInput(card?.due_at ?? null));
    setLabel(card?.label ?? "");
    setLabelColor(card?.label_color ?? LABEL_COLORS[0]);
  }, [card]);

  const loadActivity = useCallback(async (cardId: string) => {
    setLoadingActivity(true);
    try {
      const result = await listKanbanCardActivityAction(cardId);
      if (result.success) setActivity(result.data);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    if (!card) {
      setActivity([]);
      return;
    }
    void loadActivity(card.id);
  }, [card, loadActivity]);

  const save = useCallback(() => {
    if (!card) return;
    const description = extractPlainText(descriptionRich).trim();
    startTransition(async () => {
      const result = await updateKanbanCardAction({
        id: card.id,
        board_id: board.id,
        column_id: columnId,
        title,
        description,
        description_rich: descriptionRich,
        due_at: fromDateInput(dueAt),
        label,
        label_color: label ? labelColor : null,
      });
      if (!result.success) {
        toast.error(actionError(result));
        return;
      }
      onChanged(result.data);
      await loadActivity(card.id);
    });
  }, [
    board.id,
    card,
    columnId,
    descriptionRich,
    dueAt,
    label,
    labelColor,
    loadActivity,
    onChanged,
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
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <div className="border-b px-5 py-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("boards.cardDetails")}</span>
              <span>•</span>
              <span>
                {card?.is_inbox
                  ? t("boards.inbox.title")
                  : columns.find((column) => column.id === card?.column_id)?.title}
              </span>
            </div>
            <DialogTitle asChild>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canUpdate || isPending}
                className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
              />
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              <section className="space-y-2">
                <Label>{t("boards.cardDescription")}</Label>
                {canUpdate ? (
                  <RichTextEditorField
                    value={descriptionRich}
                    onChange={setDescriptionRich}
                    placeholder={t("boards.cardDescriptionPlaceholder")}
                    disabled={isPending}
                    mode="full"
                    maxLength={4000}
                    contentClassName="min-h-[180px] [&_.ProseMirror]:min-h-[160px]"
                  />
                ) : (
                  <RichTextRenderer
                    value={normalizeRichText(card?.description_rich) ?? undefined}
                    emptyText={card?.description ?? t("boards.noDescription")}
                  />
                )}
              </section>

              <Separator />

              {card ? (
                <CommentsThread
                  key={card.id}
                  targetType="planning.kanban_card"
                  targetId={card.id}
                  density="compact"
                  labels={{
                    title: t("boards.comments.title"),
                    empty: t("boards.comments.empty"),
                    placeholder: t("boards.comments.placeholder"),
                    submit: t("boards.comments.submit"),
                  }}
                  onCommentAdded={() => loadActivity(card.id)}
                />
              ) : null}

              <Separator />

              <section>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("boards.activity")}
                </p>
                {loadingActivity ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("boards.loading")}
                  </div>
                ) : (
                  <KanbanCardActivityList activity={activity} />
                )}
              </section>
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto border-t bg-muted/10 p-4 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("boards.column")}</Label>
                <Select value={columnId} onValueChange={setColumnId} disabled={!canUpdate}>
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
                <Input
                  type="date"
                  value={dueAt}
                  disabled={!canUpdate}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("boards.label")}</Label>
                <Input
                  value={label}
                  disabled={!canUpdate}
                  onChange={(event) => setLabel(event.target.value)}
                />
                <div className="flex flex-wrap gap-1">
                  {LABEL_COLORS.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      disabled={!canUpdate}
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

              <Separator />

              <div className="space-y-3 rounded-lg border bg-background p-3">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t("boards.createdBy")}
                    </p>
                    <p className="truncate text-xs">
                      {card?.creator_name ?? card?.creator_email ?? t("boards.unknown")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t("boards.created")}
                    </p>
                    <p className="text-xs">{formatDateTime(card?.created_at ?? null)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {t("boards.updated")}
                    </p>
                    <p className="text-xs">{formatDateTime(card?.updated_at ?? null)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 lg:flex-col">
                {canUpdate ? (
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={save}
                    disabled={!title.trim() || !columnId || isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t("boards.save")}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                    onClick={archive}
                    disabled={isPending || !card}
                  >
                    <Archive className="h-4 w-4" />
                    {t("boards.archiveCard")}
                  </Button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KanbanCardActivityList({ activity }: { activity: KanbanCardActivity[] }) {
  const t = useTranslations("modules.planning");

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{t("boards.noActivity")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {[...activity].reverse().map((item) => (
        <div key={item.id} className="flex gap-2.5">
          <span className="mt-0.5 shrink-0 text-sm">•</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{activityLabel(t, item.activity_type, item.message)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.actor_name ?? item.actor_email ?? t("boards.systemActor")} ·{" "}
              {formatDateTime(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
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
