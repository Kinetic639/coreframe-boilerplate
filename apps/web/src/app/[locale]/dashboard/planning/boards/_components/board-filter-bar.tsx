"use client";

import { useTranslations } from "next-intl";
import { Inbox, User } from "lucide-react";
import { FilterBar, type FilterField } from "@/components/data-table/filter-bar";
import "@/components/data-table/ambra-list.css";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KanbanBoardLabel } from "@/lib/types/kanban";
import { KANBAN_TASK_PRIORITIES } from "@/lib/validations/kanban";
import { cn } from "@/utils";
import { DUE_FILTERS, ME, NOBODY, boardFilterParams } from "./board-filters";
import { priorityLabel } from "./board-format";

interface FilterPerson {
  user_id: string;
  name: string | null;
  email: string | null;
}

/** The board's address keys a saved view leaves out (the open card). */
const VIEW_IGNORED = ["karta"];

/**
 * The board's filter row, the same as every list's: the filter menu with
 * chips, the search (`/`), the saved views ("Widoki", kept per board), and
 * on the right "Only mine" with how many cards show.
 */
export function BoardFilterBar({
  boardId,
  inbox,
  labels,
  people,
  onlyMine,
  onToggleOnlyMine,
  filtering,
  shown,
  total,
}: {
  boardId: string;
  /** The shared inbox column: shown or not, and how many cards it holds. */
  inbox: { open: boolean; count: number; onToggle: () => void };
  labels: KanbanBoardLabel[];
  people: FilterPerson[];
  onlyMine: boolean;
  onToggleOnlyMine: () => void;
  filtering: boolean;
  shown: number;
  total: number;
}) {
  const t = useTranslations("modules.planning");

  const fields: FilterField[] = [
    {
      kind: "list",
      id: "osoby",
      label: t("boardTools.people"),
      options: [
        { value: ME, label: t("boardTools.me") },
        { value: NOBODY, label: t("boards.task.unassigned") },
        ...people.map((person) => ({
          value: person.user_id,
          label: person.name || person.email || person.user_id,
        })),
      ],
    },
    ...(labels.length
      ? [
          {
            kind: "list" as const,
            id: "etykiety",
            label: t("taskEditor.labels"),
            options: labels.map((label) => ({
              value: label.id,
              label: label.name || t("boardTools.unnamedLabel"),
            })),
          },
        ]
      : []),
    {
      kind: "list",
      id: "termin",
      label: t("boards.dueDate"),
      single: true,
      options: DUE_FILTERS.map((due) => ({ value: due, label: t(`boardTools.due.${due}`) })),
    },
    {
      kind: "list",
      id: "priorytet",
      label: t("tasks.priority"),
      options: KANBAN_TASK_PRIORITIES.map((priority) => ({
        value: priority,
        label: priorityLabel(t, priority),
      })),
    },
  ];

  return (
    <div className="dt-tokens board-filter-row flex flex-wrap items-center gap-x-2 border-t px-3 [&>div:nth-child(2)]:min-w-0 [&>div:nth-child(2)]:flex-1 [&>div:nth-child(2)]:border-b-0 [&>div:nth-child(2)]:px-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={inbox.open ? "secondary" : "ghost"}
            size="icon"
            className={cn("relative h-7 w-7 shrink-0", inbox.open && "text-primary")}
            aria-pressed={inbox.open}
            aria-label={t("boards.inbox.toggle")}
            onClick={inbox.onToggle}
          >
            <Inbox className="h-4 w-4" />
            {inbox.count ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-full bg-muted-foreground px-1 text-center text-[0.6rem] font-semibold leading-3.5 text-background tabular-nums"
              >
                {inbox.count}
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t("boards.inbox.toggle")}
          <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px]">I</kbd>
        </TooltipContent>
      </Tooltip>
      <FilterBar
        parsers={boardFilterParams}
        fields={fields}
        resetOnChange={[]}
        shallow
        search={{ label: t("boardTools.search"), placeholder: t("boardTools.searchPlaceholder") }}
        views={{ listKey: `/dashboard/planning/boards/${boardId}`, ignore: VIEW_IGNORED }}
      />
      <div className="flex shrink-0 items-center gap-2 py-1.5">
        {filtering ? (
          <span className="text-xs tabular-nums text-muted-foreground" role="status">
            {t("boardTools.shown", { shown, total })}
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={onlyMine ? "secondary" : "ghost"}
              size="icon"
              className={cn("h-7 w-7", onlyMine && "text-primary")}
              aria-pressed={onlyMine}
              aria-label={t("boardTools.onlyMine")}
              onClick={onToggleOnlyMine}
            >
              <User className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("boardTools.onlyMine")}
            <kbd className="ml-1.5 rounded border px-1 font-mono text-[10px]">Q</kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
