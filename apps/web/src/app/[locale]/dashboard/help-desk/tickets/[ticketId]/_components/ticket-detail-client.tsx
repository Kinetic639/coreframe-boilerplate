"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2, CheckCircle, Clock, User, Tag, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TicketStatusBadge } from "@/components/help-desk/ticket-status-badge";
import { TicketPriorityBadge } from "@/components/help-desk/ticket-priority-badge";
import {
  closeTicketAction,
  addTicketCommentAction,
  getTicketDetailAction,
} from "@/app/actions/help-desk";
import type {
  HelpdeskTicketDetail,
  HelpdeskTicketComment,
} from "@/server/services/helpdesk-tickets.service";
import { CommentEditor } from "@/components/primitives/comments/comment-editor";
import { CommentRenderer } from "@/components/primitives/comments/comment-renderer";
import type { CommentAuthor } from "@/components/primitives/comments/comment-types";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@/components/primitives/rich-text/rich-text-utils";

interface TicketDetailClientProps {
  ticket: HelpdeskTicketDetail;
  canManage: boolean;
  currentUserId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function commentToAuthor(comment: HelpdeskTicketComment): CommentAuthor {
  return {
    name: comment.creator_name ?? comment.creator_email ?? "Unknown",
    email: comment.creator_email ?? undefined,
    avatarUrl: comment.creator_avatar_url ?? undefined,
    profileHref: comment.creator_profile_href ?? undefined,
  };
}

export function TicketDetailClient({
  ticket: initialTicket,
  canManage,
  currentUserId,
}: TicketDetailClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [commentValue, setCommentValue] = useState<RichTextValue>(createEmptyRichText);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isCreator = ticket.created_by === currentUserId;
  const canClose =
    (canManage || isCreator) && ticket.status !== "closed" && ticket.status !== "cancelled";

  const handleAddComment = async (value: RichTextValue) => {
    const bodyPlain = extractPlainText(value);
    if (!bodyPlain.trim()) return;
    setIsSubmittingComment(true);
    try {
      const result = await addTicketCommentAction({
        ticket_id: ticket.id,
        body: bodyPlain.trim(),
        body_rich: value,
        is_internal: false,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      setCommentValue(createEmptyRichText());
      toast.success(t("tickets.commentAdded"));
      const fresh = await getTicketDetailAction(ticket.id);
      if (fresh.success && fresh.data) {
        setTicket(fresh.data);
      } else {
        setTicket((prev) => ({
          ...prev,
          comments: [...prev.comments, result.data],
          updated_at: new Date().toISOString(),
        }));
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleClose = async () => {
    if (!canClose) return;
    setIsClosing(true);
    try {
      const result = await closeTicketAction({ ticket_id: ticket.id });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      setTicket((prev) => ({ ...prev, status: "closed", closed_at: new Date().toISOString() }));
      toast.success(t("tickets.ticketClosed"));
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/help-desk/tickets")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("tickets.backToList")}
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div>
            <p className="text-muted-foreground font-mono text-sm">{ticket.ticket_number}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ticket.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
              {ticket.ticket_type_name && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  style={{ borderColor: ticket.ticket_type_color ?? undefined }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ticket.ticket_type_color ?? "#6366f1" }}
                  />
                  {ticket.ticket_type_name}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {(ticket.description_rich || ticket.description_plain) && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                {t("tickets.description")}
              </p>
              <RichTextRenderer
                value={normalizeRichText(ticket.description_rich)}
                emptyText={ticket.description_plain ?? undefined}
                prose
                className="break-words"
              />
            </div>
          )}

          <Separator />

          {/* Comments */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold">
              {t("tickets.comments")} ({ticket.comments.length})
            </h2>

            {ticket.comments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("tickets.noComments")}</p>
            ) : (
              <div className="space-y-4">
                {ticket.comments.map((c) => (
                  <CommentRenderer
                    key={c.id}
                    value={normalizeRichText(c.body_rich) ?? undefined}
                    author={commentToAuthor(c)}
                    createdAt={formatDate(c.created_at)}
                    emptyText={c.body}
                  />
                ))}
              </div>
            )}

            {/* Add comment */}
            {ticket.status !== "closed" && ticket.status !== "cancelled" && (
              <div className="pt-2">
                <CommentEditor
                  value={commentValue}
                  onChange={setCommentValue}
                  onSubmit={handleAddComment}
                  placeholder={t("tickets.commentPlaceholder")}
                  submitLabel={t("tickets.addComment")}
                  submitting={isSubmittingComment}
                  density="compact"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full space-y-4 lg:w-64 lg:shrink-0">
          {/* Close button */}
          {canClose && (
            <Button variant="outline" className="w-full" onClick={handleClose} disabled={isClosing}>
              {isClosing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {t("tickets.closeTicket")}
            </Button>
          )}

          {/* Details */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">{t("tickets.details")}</h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">{t("tickets.columns.createdBy")}</p>
                  <p className="text-sm">{ticket.creator_name ?? ticket.creator_email ?? "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">{t("tickets.columns.createdAt")}</p>
                  <p className="text-sm">{formatDate(ticket.created_at)}</p>
                </div>
              </div>

              {ticket.due_at && (
                <div className="flex items-start gap-2">
                  <Clock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">{t("tickets.fields.dueAt")}</p>
                    <p className="text-sm">{formatDate(ticket.due_at)}</p>
                  </div>
                </div>
              )}

              {ticket.ticket_type_name && (
                <div className="flex items-start gap-2">
                  <Tag className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">{t("tickets.columns.type")}</p>
                    <p className="text-sm">{ticket.ticket_type_name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Assignees */}
            {ticket.assignees.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    {t("tickets.columns.responders")}
                  </p>
                  <div className="space-y-2">
                    {ticket.assignees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-2">
                        <UserAvatar
                          className="h-6 w-6"
                          fullName={a.name}
                          email={a.email}
                          src={a.avatar_url}
                          profileHref={a.profile_href ?? undefined}
                        />
                        <span className="truncate text-sm">{a.name ?? a.email ?? a.user_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Activity */}
          {ticket.activity.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("tickets.activityLabel")}</h3>
              <div className="space-y-2">
                {ticket.activity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 pt-0.5">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {a.actor_name ?? "System"}
                      </span>{" "}
                      {t(`tickets.activity.${a.event_type}`, { defaultValue: a.event_type })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
