"use client";

import { memo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { User } from "lucide-react";
import { KanbanCard } from "@/components/primitives/kanban";
import type { KanbanBoardCard } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { STATUS_DOT_COLORS, statusLabel } from "./board-format";

interface BoardCardProps {
  card: KanbanBoardCard;
  columnColor?: string | null;
  onOpen: (card: KanbanBoardCard) => void;
}

/** A task on the board. Memoized: a move re-renders only the cards that changed. */
export const BoardCard = memo(function BoardCard({ card, columnColor, onOpen }: BoardCardProps) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  return (
    <KanbanCard id={card.id}>
      <button
        type="button"
        className="flex w-full min-w-0 cursor-grab flex-col gap-2 text-left active:cursor-grabbing"
        onClick={() => onOpen(card)}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-3 text-sm font-medium">{card.title}</h3>
          {columnColor ? (
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: columnColor }}
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
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT_COLORS[card.status])}
            aria-hidden="true"
          />
          <span>{statusLabel(t, card.status)}</span>
          <span className="ml-auto font-mono">{card.task_number}</span>
        </div>
        <div className="flex items-end justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {card.assignee_name ?? card.assignee_email ?? t("boards.task.unassigned")}
            </span>
          </span>
          {card.due_at ? (
            <span className="shrink-0">
              {t("boards.dueShort")}:{" "}
              {format.dateTime(new Date(card.due_at), { dateStyle: "medium" })}
            </span>
          ) : null}
        </div>
      </button>
    </KanbanCard>
  );
});
