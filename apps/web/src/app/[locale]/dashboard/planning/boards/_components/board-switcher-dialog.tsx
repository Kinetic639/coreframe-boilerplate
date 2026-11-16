"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { LayoutTemplate, Plus, RotateCcw, Search, Star, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createKanbanBoardAction } from "@/app/actions/kanban";
import {
  MAX_KANBAN_BOARDS_PER_USER,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
} from "@/lib/types/kanban";
import type { KanbanVisibility } from "@/lib/validations/kanban";
import { cn } from "@/utils";
import {
  BoardVisibilityFields,
  BoardVisibilityIcon,
  NewBoardMembersField,
  type PendingBoardMember,
} from "./board-sharing";
import { BoardColorPicker } from "./board-color-picker";
import { boardSwatch } from "./board-colors";
import { archivedBoardListQuery } from "./boards-query";
import type { BoardsAdmin } from "./use-boards-admin";

interface BoardSwitcherDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: KanbanBoardSummary[];
  activeBoardId: string | null;
  canCreate: boolean;
  /** Can restore or delete boards they don't own (planning.boards.delete). */
  canManageAll: boolean;
  canUpdate: boolean;
  /** Boards this browser opened recently, newest first. */
  recentBoardIds: string[];
  admin: BoardsAdmin;
  onSelectBoard: (boardId: string) => void;
  /** Hovering a board warms its cache, so opening it is instant. */
  onPrefetchBoard: (boardId: string) => void;
}

export function BoardSwitcherDialog({
  orgId,
  open,
  onOpenChange,
  boards,
  activeBoardId,
  canCreate,
  canManageAll,
  canUpdate,
  recentBoardIds,
  admin,
  onSelectBoard,
  onPrefetchBoard,
}: BoardSwitcherDialogProps) {
  const t = useTranslations("modules.planning");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);

  // The limit counts the boards this user owns, not the ones shared with them.
  const ownBoardCount = boards.filter((board) => board.my_access === "owner").length;
  const canCreateMore = canCreate && ownBoardCount < MAX_KANBAN_BOARDS_PER_USER;

  const filteredBoards = useMemo(() => filterBoards(boards, query), [boards, query]);

  // Without a search: favourites, recently opened, mine, then shared with me.
  const sections = useMemo(() => {
    if (query.trim()) return [{ key: "results", title: null, boards: filteredBoards }];
    const byId = new Map(boards.map((board) => [board.id, board]));
    const recent = recentBoardIds
      .map((id) => byId.get(id))
      .filter((board): board is KanbanBoardSummary => Boolean(board));
    return [
      {
        key: "starred",
        title: t("boards.all.starred"),
        boards: boards.filter((board) => board.starred),
      },
      { key: "recent", title: t("boards.all.recent"), boards: recent },
      {
        key: "mine",
        title: t("boards.all.mine"),
        boards: boards.filter((board) => board.my_access === "owner"),
      },
      {
        key: "shared",
        title: t("boards.all.shared"),
        boards: boards.filter((board) => board.my_access !== "owner"),
      },
    ].filter((section) => section.boards.length);
  }, [boards, filteredBoards, query, recentBoardIds, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{t("boards.all.title")}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("boards.boardSearch")}
                aria-label={t("boards.boardSearch")}
                className="pl-9"
                autoFocus
              />
            </div>
            <TabsList>
              <TabsTrigger value="open">{t("boards.all.openTab")}</TabsTrigger>
              <TabsTrigger value="archived">{t("boards.archive.archivedBoards")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="open" className="mt-0 space-y-4">
            {sections.length ? (
              <div className="max-h-[56vh] space-y-5 overflow-y-auto pr-1">
                {sections.map((section) => (
                  <section key={section.key} className="space-y-2">
                    {section.title ? (
                      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {section.key === "starred" ? <Star className="h-3.5 w-3.5" /> : null}
                        {section.title}
                      </h3>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {section.boards.map((board) => (
                        <BoardTile
                          key={board.id}
                          board={board}
                          active={activeBoardId === board.id}
                          onSelect={onSelectBoard}
                          onPrefetch={onPrefetchBoard}
                          onToggleStar={(starred) => void admin.toggleStar(board.id, starred)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                {t("boards.empty")}
              </div>
            )}

            {canCreate ? (
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full justify-start gap-1.5"
                  disabled={!canCreateMore}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t("boards.newBoard")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {canCreateMore
                    ? t("boards.limit", { count: ownBoardCount, max: MAX_KANBAN_BOARDS_PER_USER })
                    : t("boards.limitReached", { max: MAX_KANBAN_BOARDS_PER_USER })}
                </p>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="archived" className="mt-0">
            {tab === "archived" ? (
              <ArchivedBoardsList
                orgId={orgId}
                query={query}
                canManageAll={canManageAll}
                canUpdate={canUpdate}
                admin={admin}
                onRestored={onSelectBoard}
              />
            ) : null}
          </TabsContent>
        </Tabs>

        <CreateBoardDialog
          templates={boards.filter((board) => board.is_template)}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(board) => {
            admin.boardChanged(board);
            setCreateOpen(false);
            toast.success(t("boards.boardCreated"));
            onSelectBoard(board.id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** A board on the list: its colour on top, the name, who sees it and the star. */
function BoardTile({
  board,
  active,
  onSelect,
  onPrefetch,
  onToggleStar,
}: {
  board: KanbanBoardSummary;
  active: boolean;
  onSelect: (boardId: string) => void;
  onPrefetch: (boardId: string) => void;
  onToggleStar: (starred: boolean) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-md border bg-card transition-colors hover:border-muted-foreground/50",
        active && "border-primary ring-1 ring-primary/40"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(board.id)}
        onPointerEnter={() => onPrefetch(board.id)}
        onFocus={() => onPrefetch(board.id)}
        className="flex w-full min-w-0 flex-col text-left"
      >
        <span className="h-10 w-full" style={{ background: boardSwatch(board.color) }} />
        <span className="flex min-w-0 flex-col gap-1.5 p-3 pr-9">
          <span className="truncate text-sm font-semibold">{board.title}</span>
          {board.description ? (
            <span className="line-clamp-2 text-xs text-muted-foreground">{board.description}</span>
          ) : null}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BoardVisibilityIcon visibility={board.visibility} />
            {t(`boards.visibility.${board.visibility}`)}
            {board.is_template ? (
              <span className="ml-1 flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                <LayoutTemplate className="h-3 w-3" />
                {t("boardExtras.templates.badge")}
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        className={cn(
          "absolute bottom-2.5 right-2 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:opacity-100",
          board.starred ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        aria-pressed={board.starred}
        aria-label={board.starred ? t("boards.star.remove") : t("boards.star.add")}
        onClick={() => onToggleStar(!board.starred)}
      >
        <Star className={cn("h-4 w-4", board.starred && "fill-amber-400 text-amber-400")} />
      </button>
    </div>
  );
}

function filterBoards(boards: KanbanBoardSummary[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return boards;
  return boards.filter(
    (board) =>
      board.title.toLowerCase().includes(normalized) ||
      (board.description ?? "").toLowerCase().includes(normalized)
  );
}

function ArchivedBoardsList({
  orgId,
  query,
  canManageAll,
  canUpdate,
  admin,
  onRestored,
}: {
  orgId: string;
  query: string;
  canManageAll: boolean;
  canUpdate: boolean;
  admin: BoardsAdmin;
  onRestored: (boardId: string) => void;
}) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const archived = useQuery(archivedBoardListQuery(orgId));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<KanbanBoardSummary | null>(null);
  const boards = useMemo(() => filterBoards(archived.data ?? [], query), [archived.data, query]);

  if (archived.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (archived.isError) {
    return <p className="text-sm text-destructive">{archived.error.message}</p>;
  }
  if (!boards.length) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {t("boards.archive.noBoards")}
      </div>
    );
  }

  return (
    <>
      <ul className="max-h-[46vh] divide-y overflow-y-auto rounded-md border">
        {boards.map((board) => {
          const canManage = canUpdate && (board.my_access === "owner" || canManageAll);
          return (
            <li key={board.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{board.title}</p>
                <p className="text-xs text-muted-foreground">
                  {board.archived_at
                    ? t("boards.archive.archivedOn", {
                        date: format.dateTime(new Date(board.archived_at), {
                          dateStyle: "medium",
                        }),
                      })
                    : null}
                </p>
              </div>
              {canManage ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === board.id}
                    onClick={async () => {
                      setPendingId(board.id);
                      const restored = await admin.restoreBoard(board.id);
                      setPendingId(null);
                      if (restored) onRestored(board.id);
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t("boards.archive.restore")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    disabled={pendingId === board.id}
                    aria-label={t("boards.archive.deleteBoard", { title: board.title })}
                    onClick={() => setDeleting(board)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      <DeleteBoardDialog
        board={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async (boardId) => {
          setPendingId(boardId);
          const deleted = await admin.deleteBoard(boardId);
          setPendingId(null);
          if (deleted) setDeleting(null);
        }}
      />
    </>
  );
}

/** Deleting for good asks for the board's name, like GitHub does for repositories. */
function DeleteBoardDialog({
  board,
  onClose,
  onConfirm,
}: {
  board: KanbanBoardSummary | null;
  onClose: () => void;
  onConfirm: (boardId: string) => Promise<void>;
}) {
  const t = useTranslations("modules.planning");
  const [typed, setTyped] = useState("");
  const [isPending, setIsPending] = useState(false);
  const matches = Boolean(board) && typed.trim() === board?.title.trim();

  return (
    <AlertDialog
      open={Boolean(board)}
      onOpenChange={(value) => {
        if (value) return;
        setTyped("");
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("boards.archive.deleteBoard", { title: board?.title ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("boards.archive.deleteBoardText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="kanban-delete-board-name">
            {t("boards.archive.typeName", { title: board?.title ?? "" })}
          </Label>
          <Input
            id="kanban-delete-board-name"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("boards.cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matches || isPending}
            onClick={async () => {
              if (!board) return;
              setIsPending(true);
              await onConfirm(board.id);
              setIsPending(false);
              setTyped("");
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t("boards.archive.deleteForGood")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const BLANK_BOARD = "__blank__";

export function CreateBoardDialog({
  templates,
  open,
  onOpenChange,
  onCreated,
}: {
  /** Boards marked as templates, to start from. */
  templates: KanbanBoardSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<KanbanVisibility>("private");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [members, setMembers] = useState<PendingBoardMember[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(BLANK_BOARD);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setTemplateId(BLANK_BOARD);
    setColor(null);
    setTitle("");
    setDescription("");
    setVisibility("private");
    setBranchId(null);
    setMembers([]);
  };

  const submit = async () => {
    setIsPending(true);
    const result = await createKanbanBoardAction({
      title,
      description,
      color,
      visibility,
      branch_id: visibility === "branch" ? branchId : null,
      members,
      ...(templateId !== BLANK_BOARD ? { template_id: templateId } : {}),
    });
    setIsPending(false);
    if (!result.success) {
      toast.error("error" in result ? result.error : "Operation failed");
      return;
    }
    if (result.data.members.length < members.length) {
      toast.warning(t("boards.sharing.someNotAdded"));
    }
    reset();
    onCreated(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("boards.createBoard")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {templates.length ? (
            <div className="space-y-2">
              <Label>{t("boardExtras.templates.startFrom")}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger aria-label={t("boardExtras.templates.startFrom")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BLANK_BOARD}>{t("boardExtras.templates.blank")}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateId !== BLANK_BOARD ? (
                <p className="text-xs text-muted-foreground">
                  {t("boardExtras.templates.startFromHelp")}
                </p>
              ) : null}
            </div>
          ) : null}
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
          <BoardColorPicker value={color} onChange={setColor} />
          <BoardVisibilityFields
            visibility={visibility}
            branchId={branchId}
            onVisibilityChange={setVisibility}
            onBranchChange={setBranchId}
          />
          <NewBoardMembersField value={members} onChange={setMembers} disabled={isPending} />
        </div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || (visibility === "branch" && !branchId) || isPending}
            onClick={() => void submit()}
          >
            {isPending ? t("boards.creating") : t("boards.createBoard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
