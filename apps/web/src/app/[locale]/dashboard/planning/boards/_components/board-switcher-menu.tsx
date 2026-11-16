"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, LayoutGrid, Plus, Star } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { KanbanBoardDetail, KanbanBoardSummary } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { boardSwatch } from "./board-colors";

export interface BoardSwitcherProps {
  boards: KanbanBoardSummary[];
  /** Boards this browser opened recently, newest first. */
  recentBoardIds: string[];
  onSelectBoard: (boardId: string) => void;
  /** Hovering a board warms its cache, so opening it is instant. */
  onPrefetchBoard: (boardId: string) => void;
  onOpenAllBoards: () => void;
  /** Opens the new board form (none: the person can't make boards). */
  onCreateBoard?: () => void;
}

/**
 * The board's name as a menu: a search over the boards (favourites, recent,
 * mine, shared, each board once), "All boards" and "New board".
 */
export function BoardSwitcherMenu({
  board,
  boards,
  recentBoardIds,
  onSelectBoard,
  onPrefetchBoard,
  onOpenAllBoards,
  onCreateBoard,
}: BoardSwitcherProps & { board: KanbanBoardDetail }) {
  const t = useTranslations("modules.planning");
  const [open, setOpen] = useState(false);

  const sections = useMemo(() => {
    const seen = new Set<string>();
    const take = (list: KanbanBoardSummary[]) =>
      list.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    const byId = new Map(boards.map((item) => [item.id, item]));
    return [
      {
        key: "starred",
        title: t("boards.all.starred"),
        boards: take(boards.filter((b) => b.starred)),
      },
      {
        key: "recent",
        title: t("boards.all.recent"),
        boards: take(
          recentBoardIds
            .map((id) => byId.get(id))
            .filter((item): item is KanbanBoardSummary => Boolean(item))
        ),
      },
      {
        key: "mine",
        title: t("boards.all.mine"),
        boards: take(boards.filter((b) => b.my_access === "owner")),
      },
      {
        key: "shared",
        title: t("boards.all.shared"),
        boards: take(boards.filter((b) => b.my_access !== "owner")),
      },
    ].filter((section) => section.boards.length);
  }, [boards, recentBoardIds, t]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/70"
          aria-label={t("boards.switchBoards")}
        >
          <span
            className="h-4 w-4 shrink-0 rounded"
            style={{ background: boardSwatch(board.color) }}
            aria-hidden="true"
          />
          <h2 className="truncate text-lg font-semibold">{board.title}</h2>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder={t("boards.boardSearch")} />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{t("boards.empty")}</CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.key} heading={section.title}>
                {section.boards.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    keywords={[item.title, item.description ?? ""]}
                    onSelect={() => choose(() => onSelectBoard(item.id))}
                    onMouseEnter={() => onPrefetchBoard(item.id)}
                    className="gap-2"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded"
                      style={{ background: boardSwatch(item.color) }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.starred && section.key !== "starred" ? (
                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                    ) : null}
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        item.id === board.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__all__"
                forceMount
                onSelect={() => choose(onOpenAllBoards)}
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                {t("boards.all.title")}
              </CommandItem>
              {onCreateBoard ? (
                <CommandItem
                  value="__new__"
                  forceMount
                  onSelect={() => choose(onCreateBoard)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("boards.newBoard")}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
