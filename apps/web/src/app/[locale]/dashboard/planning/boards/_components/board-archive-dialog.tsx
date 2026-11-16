"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { KanbanBoardArchive } from "@/lib/types/kanban";
import { boardArchiveQuery } from "./boards-query";
import type { BoardActions } from "./use-board-actions";

type ArchivedColumn = KanbanBoardArchive["columns"][number];

interface BoardArchiveDialogProps {
  orgId: string;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
  canDelete: boolean;
  actions: BoardActions;
}

/** The board's archive: archived columns (restore, delete for good) and archived cards. */
export function BoardArchiveDialog({
  orgId,
  boardId,
  open,
  onOpenChange,
  canRestore,
  canDelete,
  actions,
}: BoardArchiveDialogProps) {
  const t = useTranslations("modules.planning");
  const format = useFormatter();
  const archive = useQuery({ ...boardArchiveQuery(orgId, boardId), enabled: open });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ArchivedColumn | null>(null);

  const run = async (id: string, action: () => Promise<boolean>) => {
    setPendingId(id);
    await action();
    setPendingId(null);
  };

  const archivedAt = (value: string | null) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium" }) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              {t("boards.archive.title")}
            </DialogTitle>
          </DialogHeader>

          {archive.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : archive.isError ? (
            <p className="text-sm text-destructive">{archive.error.message}</p>
          ) : (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("boards.archive.columns")}
                </h3>
                {archive.data.columns.length ? (
                  <ul className="divide-y rounded-md border">
                    {archive.data.columns.map((column) => (
                      <li key={column.id} className="flex items-center gap-3 px-3 py-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: column.color ?? "#64748b" }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{column.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("boards.archive.cardCount", { count: column.card_count })}
                            {column.archived_at ? ` · ${archivedAt(column.archived_at)}` : ""}
                          </p>
                        </div>
                        {canRestore ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === column.id}
                            onClick={() =>
                              void run(column.id, () => actions.restoreColumn(column.id))
                            }
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            {t("boards.archive.restore")}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            disabled={pendingId === column.id}
                            aria-label={t("boards.archive.deleteColumn", { title: column.title })}
                            onClick={() => setDeleting(column)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                    {t("boards.archive.noColumns")}
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("boards.archive.cards")}
                </h3>
                {archive.data.cards.length ? (
                  <ul className="divide-y rounded-md border">
                    {archive.data.cards.map((card) => (
                      <li key={card.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{card.title}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{card.task_number}</span>
                            {card.archived_at ? ` · ${archivedAt(card.archived_at)}` : ""}
                          </p>
                        </div>
                        {canRestore ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === card.id}
                            onClick={() => void run(card.id, () => actions.restoreCard(card.id))}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            {t("boards.archive.restore")}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                    {t("boards.archive.noCards")}
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("boards.archive.deleteColumn", { title: deleting?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("boards.archive.deleteColumnText", { count: deleting?.card_count ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("boards.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleting) return;
                const id = deleting.id;
                void run(id, () => actions.deleteColumn(id));
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("boards.archive.deleteForGood")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
