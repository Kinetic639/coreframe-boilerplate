"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2, MessageSquare, Paperclip } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  KanbanBoard,
  KanbanCard,
  type KanbanColumnDefinition,
} from "@/components/primitives/kanban";
import {
  getFeedbackAction,
  listFeedbackAction,
  updateFeedbackAction,
} from "@/app/actions/platform-feedback";
import {
  FEEDBACK_STATUSES,
  type FeedbackDetail,
  type FeedbackListRow,
  type FeedbackStatus,
} from "@/lib/platform-feedback/types";
import { FeedbackKindBadge, FeedbackPriorityBadge } from "./feedback-badges";
import { FeedbackDetailPanel } from "./feedback-detail-panel";

export const feedbackBoardKey = ["platform-feedback", "board"] as const;

/** All reports as cards in status columns; dragging a card changes its status. */
export function FeedbackBoard() {
  const t = useTranslations("platformFeedback");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: feedbackBoardKey,
    queryFn: async () => {
      const result = await listFeedbackAction({ scope: "all", page: 1, pageSize: 500 });
      if (!result.success) throw new Error((result as { error: string }).error);
      return (result as { data: { rows: FeedbackListRow[] } }).data.rows;
    },
  });

  const { data: openDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["platform-feedback", "detail", openId],
    enabled: !!openId,
    queryFn: async () => {
      const result = await getFeedbackAction(openId!);
      if (!result.success) throw new Error((result as { error: string }).error);
      return (result as { data: FeedbackDetail | null }).data;
    },
  });

  const columns = useMemo<KanbanColumnDefinition[]>(
    () => FEEDBACK_STATUSES.map((status) => ({ id: status, title: t(`status.${status}`) })),
    [t]
  );
  const items = useMemo(() => rows ?? [], [rows]);

  const moveCard = async ({
    itemId,
    toColumnId,
    fromColumnId,
  }: {
    itemId: string;
    toColumnId: string;
    fromColumnId: string;
  }) => {
    if (toColumnId === fromColumnId) return;
    queryClient.setQueryData<FeedbackListRow[]>(feedbackBoardKey, (current) =>
      current?.map((row) =>
        row.id === itemId ? { ...row, status: toColumnId as FeedbackStatus } : row
      )
    );
    const result = await updateFeedbackAction({ feedbackId: itemId, status: toColumnId });
    if (!result.success) toast.error(t("detail.updateFailed"));
    await queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <KanbanBoard<FeedbackListRow>
        columns={columns}
        items={items}
        getItemId={(row) => row.id}
        getItemColumnId={(row) => row.status}
        columnsDraggable={false}
        onCardMove={moveCard}
        labels={{ emptyColumn: t("board.empty") }}
        className="h-full"
        renderCard={(row) => (
          <KanbanCard id={row.id}>
            <div
              role="button"
              tabIndex={0}
              className="w-full space-y-1.5 text-left outline-none"
              onClick={() => setOpenId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setOpenId(row.id);
              }}
              data-testid="feedback-card"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-[11px]">{row.code}</span>
                <FeedbackKindBadge kind={row.kind} />
                <FeedbackPriorityBadge priority={row.priority} />
              </div>
              <p className="line-clamp-2 text-sm font-medium">{row.title}</p>
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">
                  {row.reporter_name || row.reporter_email || "—"}
                  {row.organization_name ? ` · ${row.organization_name}` : ""}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {row.message_count > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3" />
                      {row.message_count}
                    </span>
                  )}
                  {row.attachment_count > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="h-3 w-3" />
                      {row.attachment_count}
                    </span>
                  )}
                  {format.relativeTime(new Date(row.last_activity_at))}
                </span>
              </div>
            </div>
          </KanbanCard>
        )}
      />

      <Sheet open={!!openId} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>{openDetail?.title ?? t("detail.loading")}</SheetTitle>
          </SheetHeader>
          {detailLoading || !openDetail ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : (
            <FeedbackDetailPanel
              key={openDetail.id}
              initial={openDetail}
              isAdmin
              onChanged={() => void queryClient.invalidateQueries({ queryKey: feedbackBoardKey })}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
