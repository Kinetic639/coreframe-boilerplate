"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  ChevronDown,
  Clock,
  LayoutGrid,
  List,
  Plus,
  Search,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KanbanBoardSummary } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { boardSwatch } from "./board-colors";

export interface BoardSwitcherProps {
  boards: KanbanBoardSummary[];
  /** Boards this browser opened recently, newest first. */
  recentBoardIds: string[];
  onSelectBoard: (boardId: string) => void;
  /** Hovering a board warms its cache, so opening it is instant. */
  onPrefetchBoard: (boardId: string) => void;
  onToggleStar: (boardId: string, starred: boolean) => void;
  /** The full boards window (archived boards too). */
  onOpenAllBoards: () => void;
  /** Opens the new board form (none: the person can't make more boards). */
  onCreateBoard?: () => void;
}

type View = "grid" | "list";
type Scope = "all" | "starred" | "mine" | "shared";

const VIEW_KEY = "planning-boards-picker-view";
const SCOPES: Scope[] = ["all", "starred", "mine", "shared"];

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function normalize(text: string) {
  return text.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

/**
 * Switching boards, as in Trello: a search, scope chips, recent boards and
 * the person's and shared boards in collapsible groups, shown as tiles or as
 * a list (remembered in this browser), plus "New board".
 */
export function BoardPickerDialog({
  open,
  onOpenChange,
  activeBoardId,
  boards,
  recentBoardIds,
  onSelectBoard,
  onPrefetchBoard,
  onToggleStar,
  onOpenAllBoards,
  onCreateBoard,
}: BoardSwitcherProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBoardId: string | null;
}) {
  const t = useTranslations("modules.planning");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [view, setView] = useState<View>("grid");
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setView(readView());
    setQuery("");
  }, [open]);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // The view is a convenience; without storage it resets next time.
    }
  };

  const inScope = useMemo(
    () =>
      boards.filter((board) =>
        scope === "starred"
          ? board.starred
          : scope === "mine"
            ? board.my_access === "owner"
            : scope === "shared"
              ? board.my_access !== "owner"
              : true
      ),
    [boards, scope]
  );

  const sections = useMemo(() => {
    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (words.length) {
      const found = inScope.filter((board) => {
        const text = normalize(`${board.title} ${board.description ?? ""}`);
        return words.every((word) => text.includes(word));
      });
      return [{ key: "results", title: null, icon: Search, boards: found, foldable: false }];
    }
    const byId = new Map(inScope.map((board) => [board.id, board]));
    const recent = recentBoardIds
      .map((id) => byId.get(id))
      .filter((board): board is KanbanBoardSummary => Boolean(board));
    return [
      {
        key: "recent",
        title: t("boards.all.recent"),
        icon: Clock,
        boards: recent,
        foldable: false,
      },
      ...(scope === "starred"
        ? [
            {
              key: "starred",
              title: t("boards.all.starred"),
              icon: Star,
              boards: inScope,
              foldable: true,
            },
          ]
        : [
            {
              key: "mine",
              title: t("boards.all.mine"),
              icon: null,
              boards: inScope.filter((board) => board.my_access === "owner"),
              foldable: true,
            },
            {
              key: "shared",
              title: t("boards.all.shared"),
              icon: null,
              boards: inScope.filter((board) => board.my_access !== "owner"),
              foldable: true,
            },
          ]),
    ].filter((section) => section.boards.length);
  }, [inScope, query, recentBoardIds, scope, t]);

  const select = (boardId: string) => {
    onOpenChange(false);
    onSelectBoard(boardId);
  };
  const first = sections[0]?.boards[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogTitle className="sr-only">{t("boards.switchBoards")}</DialogTitle>
        <div className="space-y-3 border-b p-4 pr-12">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && first) {
                    event.preventDefault();
                    select(first.id);
                  }
                }}
                placeholder={t("boards.boardSearch")}
                aria-label={t("boards.boardSearch")}
                className="h-9 pl-9"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={
                    view === "grid" ? t("boards.picker.listView") : t("boards.picker.gridView")
                  }
                  onClick={() => changeView(view === "grid" ? "list" : "grid")}
                >
                  {view === "grid" ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <LayoutGrid className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {view === "grid" ? t("boards.picker.listView") : t("boards.picker.gridView")}
              </TooltipContent>
            </Tooltip>
            {onCreateBoard ? (
              <Button
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  onCreateBoard();
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("boards.newBoard")}</span>
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {SCOPES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={scope === item}
                onClick={() => setScope(item)}
                className={cn(
                  "h-7 rounded-md border px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  scope === item
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-muted/40 hover:bg-muted"
                )}
              >
                {t(`boards.picker.scope.${item}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[16rem] flex-1 space-y-5 overflow-y-auto p-4">
          {sections.length ? (
            sections.map((section) => {
              const isFolded = section.foldable && folded[section.key];
              const Icon = section.icon as LucideIcon | null;
              return (
                <section key={section.key} className="space-y-2">
                  {section.title ? (
                    section.foldable ? (
                      <button
                        type="button"
                        aria-expanded={!isFolded}
                        className="flex items-center gap-1.5 rounded px-1 text-sm font-semibold hover:bg-muted"
                        onClick={() =>
                          setFolded((current) => ({ ...current, [section.key]: !isFolded }))
                        }
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isFolded && "-rotate-90")}
                        />
                        {section.title}
                        <span className="text-xs font-normal text-muted-foreground">
                          {section.boards.length}
                        </span>
                      </button>
                    ) : (
                      <h3 className="flex items-center gap-1.5 px-1 text-sm font-semibold">
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                        {section.title}
                      </h3>
                    )
                  ) : null}
                  {isFolded ? null : view === "grid" ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {section.boards.map((board) => (
                        <BoardTile
                          key={board.id}
                          board={board}
                          active={board.id === activeBoardId}
                          onSelect={select}
                          onPrefetch={onPrefetchBoard}
                          onToggleStar={onToggleStar}
                        />
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {section.boards.map((board) => (
                        <BoardRow
                          key={board.id}
                          board={board}
                          active={board.id === activeBoardId}
                          onSelect={select}
                          onPrefetch={onPrefetchBoard}
                          onToggleStar={onToggleStar}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {query.trim() ? t("boards.picker.noResults") : t("boards.empty")}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              onOpenChange(false);
              onOpenAllBoards();
            }}
          >
            <Archive className="h-4 w-4" />
            {t("boards.picker.allAndArchived")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ItemProps {
  board: KanbanBoardSummary;
  active: boolean;
  onSelect: (boardId: string) => void;
  onPrefetch: (boardId: string) => void;
  onToggleStar: (boardId: string, starred: boolean) => void;
}

function StarButton({
  board,
  onToggleStar,
  className,
}: Pick<ItemProps, "board" | "onToggleStar"> & { className?: string }) {
  const t = useTranslations("modules.planning");
  const label = board.starred ? t("boards.star.remove") : t("boards.star.add");
  return (
    <button
      type="button"
      aria-pressed={board.starred}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggleStar(board.id, !board.starred);
      }}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        board.starred ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        className
      )}
    >
      <Star className={cn("h-4 w-4", board.starred && "fill-amber-400 text-amber-400")} />
    </button>
  );
}

function BoardTile({ board, active, onSelect, onPrefetch, onToggleStar }: ItemProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted/40 transition-shadow hover:shadow-md",
        active && "ring-2 ring-primary"
      )}
      onMouseEnter={() => onPrefetch(board.id)}
    >
      <button
        type="button"
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(board.id)}
        onFocus={() => onPrefetch(board.id)}
      >
        <span className="block h-20" style={{ background: boardSwatch(board.color) }} />
        <span className="line-clamp-2 block min-h-[3.25rem] px-2.5 py-2 text-sm font-medium">
          {board.title}
        </span>
      </button>
      <StarButton
        board={board}
        onToggleStar={onToggleStar}
        className="absolute right-1.5 top-1.5 bg-black/30 text-white hover:bg-black/45"
      />
    </div>
  );
}

function BoardRow({ board, active, onSelect, onPrefetch, onToggleStar }: ItemProps) {
  return (
    <li
      className={cn(
        "group relative flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted",
        active &&
          "bg-primary/10 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary"
      )}
      onMouseEnter={() => onPrefetch(board.id)}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1.5 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(board.id)}
        onFocus={() => onPrefetch(board.id)}
      >
        <span
          className="h-8 w-12 shrink-0 rounded"
          style={{ background: boardSwatch(board.color) }}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium">{board.title}</span>
      </button>
      <StarButton board={board} onToggleStar={onToggleStar} />
    </li>
  );
}
