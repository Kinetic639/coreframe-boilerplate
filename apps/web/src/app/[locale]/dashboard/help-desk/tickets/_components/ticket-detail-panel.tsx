"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  Tag,
  User,
  CheckCircle,
  Loader2,
  QrCode,
  Link2Off,
  Hand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/validations/helpdesk";
import { canManageTicketBranchAction, getTicketDetailAction } from "@/app/actions/help-desk";
import { getQrAssignmentForTicketAction } from "@/app/actions/qr/assign";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { AssignQrDialog } from "../[ticketId]/_components/assign-qr-dialog";
import {
  useAcceptTicketMutation,
  useSetTicketStatusMutation,
  useTakeTicketMutation,
} from "@/hooks/queries/help-desk";
import type {
  HelpdeskTicketDetail,
  HelpdeskTicketActivity,
} from "@/server/services/helpdesk-tickets.service";
import {
  TicketStatusBadge,
  type StatusBadgeConfig,
} from "@/components/help-desk/ticket-status-badge";
import {
  TicketPriorityBadge,
  type PriorityBadgeConfig,
} from "@/components/help-desk/ticket-priority-badge";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { AttachmentsPanel } from "@/components/features/attachments";
import { CommentsThread } from "@/components/features/comments";
import { helpdeskTicketTypingTopic } from "@repo/rich-text/comments";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import { normalizeRichText } from "@/components/primitives/rich-text/rich-text-utils";

export function TicketDetailPanel({
  detail,
  canManage: canManageAnyBranch,
  currentUserId,
  statusConfigs,
  priorityConfigs,
}: {
  detail: HelpdeskTicketDetail;
  canManage: boolean;
  currentUserId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}) {
  const t = useTranslations("modules.helpDesk");
  const [activity, setActivity] = useState<HelpdeskTicketActivity[]>(detail.activity);

  // Handlers may hold helpdesk.tickets.manage for a single branch, so decide for this
  // ticket's branch (same as the full ticket page); the list-level flag is only a first guess.
  const [canManage, setCanManage] = useState(canManageAnyBranch);
  useEffect(() => {
    let current = true;
    void canManageTicketBranchAction(detail.org_id, detail.branch_id ?? null).then((r) => {
      if (current && r.success) setCanManage(r.data);
    });
    return () => {
      current = false;
    };
  }, [detail.org_id, detail.branch_id]);

  const setStatusMutation = useSetTicketStatusMutation(detail.ticket_number, detail.org_id);
  const takeTicketMutation = useTakeTicketMutation(detail.ticket_number, detail.org_id);
  const isMineToHandle = detail.assignees.some((a) => a.user_id === currentUserId);

  const [acceptedAt, setAcceptedAt] = useState<string | null>(detail.accepted_at);
  const [acceptedByName, setAcceptedByName] = useState<string | null>(detail.accepted_by_name);

  // QR assignment
  type QrInfo = {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  } | null;
  const [qrAssignment, setQrAssignment] = useState<QrInfo>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [showAssignQr, setShowAssignQr] = useState(false);
  const [isRevokingQr, setIsRevokingQr] = useState(false);

  useEffect(() => {
    setQrLoading(true);
    getQrAssignmentForTicketAction(detail.id).then((r) => {
      if (r.success) setQrAssignment(r.data);
      setQrLoading(false);
    });
  }, [detail.id]);

  useEffect(() => {
    setActivity(detail.activity);
    setAcceptedAt(detail.accepted_at);
    setAcceptedByName(detail.accepted_by_name);
  }, [detail.accepted_at, detail.accepted_by_name, detail.activity]);

  const handleRevokeQr = async () => {
    if (!qrAssignment) return;
    setIsRevokingQr(true);
    try {
      const result = await revokeQrAction({ qrCodeId: qrAssignment.qrCodeId });
      if (!result.success) {
        const { toast } = await import("react-toastify");
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      setQrAssignment(null);
      const { toast } = await import("react-toastify");
      toast.success("QR code unlinked from ticket.");
    } finally {
      setIsRevokingQr(false);
    }
  };

  const acceptMutation = useAcceptTicketMutation(detail.ticket_number, detail.org_id);
  const canComment = detail.status !== "closed" && detail.status !== "cancelled";
  const canAccept =
    detail.requires_acceptance &&
    !acceptedAt &&
    (canManage || detail.acceptors.some((a) => a.user_id === currentUserId));

  const refreshActivity = useCallback(async () => {
    const fresh = await getTicketDetailAction(detail.ticket_number, detail.org_id);
    if (fresh.success && fresh.data) {
      setActivity(fresh.data.activity);
    }
  }, [detail.org_id, detail.ticket_number]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <p className="text-muted-foreground font-mono text-xs">{detail.ticket_number}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug">{detail.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={detail.status} config={statusConfigs?.[detail.status]} />
          <TicketPriorityBadge
            priority={detail.priority}
            config={priorityConfigs?.[detail.priority]}
          />
          {detail.ticket_type_name && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              style={{ borderColor: detail.ticket_type_color ?? undefined }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: detail.ticket_type_color ?? "#6366f1" }}
              />
              {detail.ticket_type_name}
            </span>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        {/* Main: description + comments */}
        <div className="min-w-0 flex-1 space-y-4">
          {(detail.description_rich || detail.description_plain) && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                {t("tickets.description")}
              </p>
              <RichTextRenderer
                value={normalizeRichText(detail.description_rich)}
                emptyText={detail.description_plain ?? undefined}
                prose
                className="break-words"
              />
            </div>
          )}

          <Separator />

          <AttachmentsPanel
            targetType="helpdesk.ticket"
            targetId={detail.id}
            canUpload={canComment}
            onUploaded={refreshActivity}
            onDeleted={refreshActivity}
          />

          <Separator />

          <CommentsThread
            key={detail.id}
            targetType="helpdesk.ticket"
            targetId={detail.id}
            canComment={canComment}
            typingTopic={canComment ? helpdeskTicketTypingTopic(detail.id) : null}
            initialData={{
              rows: detail.comments,
              totalCount: detail.comments.length,
              nextCursor: null,
            }}
            labels={{
              title: t("tickets.comments"),
              empty: t("tickets.noComments"),
              placeholder: t("tickets.commentPlaceholder"),
              submit: canManage ? t("tickets.handling.replyToRequester") : t("tickets.addComment"),
            }}
            internal={
              canManage
                ? {
                    noteLabel: t("tickets.handling.internalNote"),
                    badge: t("tickets.handling.internalBadge"),
                  }
                : undefined
            }
            density="compact"
            onCommentAdded={refreshActivity}
          />
        </div>

        {/* Sidebar: handling + details (the panel header opens the full page) */}
        <div className="w-full shrink-0 space-y-3 self-start lg:w-52">
          {/* Handling: take + status (helpdesk.tickets.manage on the ticket's branch) */}
          {canManage && (
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="text-xs font-semibold">{t("tickets.handling.title")}</h4>
              {canComment && !isMineToHandle && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => takeTicketMutation.mutate({ ticket_id: detail.id })}
                  disabled={takeTicketMutation.isPending}
                >
                  {takeTicketMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hand className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("tickets.handling.take")}
                </Button>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground text-[10px] uppercase">
                  {t("tickets.handling.status")}
                </p>
                <Select
                  value={detail.status}
                  onValueChange={(status) =>
                    setStatusMutation.mutate({
                      ticket_id: detail.id,
                      status: status as TicketStatus,
                    })
                  }
                  disabled={setStatusMutation.isPending}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`tickets.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* QR Code card */}
          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
              QR Code
            </h4>
            {qrLoading ? (
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            ) : qrAssignment ? (
              <div className="space-y-2">
                <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                  <p className="font-medium truncate">{qrAssignment.label ?? "Unlabelled"}</p>
                  <p className="text-muted-foreground font-mono truncate">{qrAssignment.token}</p>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive h-7 text-xs"
                    onClick={handleRevokeQr}
                    disabled={isRevokingQr}
                  >
                    {isRevokingQr ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Link2Off className="mr-1.5 h-3 w-3" />
                    )}
                    Unlink
                  </Button>
                )}
              </div>
            ) : canManage ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => setShowAssignQr(true)}
              >
                <QrCode className="mr-1.5 h-3 w-3" />
                Assign QR Code
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">No QR code assigned.</p>
            )}
          </div>

          {/* Acceptance card */}
          {detail.requires_acceptance && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-muted-foreground text-[10px] uppercase font-medium">
                {t("tickets.acceptance.label")}
              </p>
              {acceptedAt ? (
                <div className="space-y-1">
                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {t("tickets.acceptance.accepted")}
                  </span>
                  {acceptedByName && (
                    <p className="truncate text-xs text-muted-foreground">{acceptedByName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(acceptedAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  {t("tickets.acceptance.pending")}
                </span>
              )}
              {detail.acceptors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {t("tickets.acceptance.authorizedAcceptors")}
                  </p>
                  {detail.acceptors.map((a) => (
                    <div key={a.user_id} className="flex items-center gap-2">
                      <UserAvatar
                        className="h-5 w-5"
                        fullName={a.name}
                        email={a.email}
                        src={a.avatar_url}
                        profileHref={a.profile_href}
                      />
                      <span className="truncate text-xs">{a.name ?? a.email}</span>
                    </div>
                  ))}
                </div>
              )}
              {canAccept && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate({ ticket_id: detail.id })}
                >
                  {acceptMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("tickets.acceptance.acceptButton")}
                </Button>
              )}
            </div>
          )}

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start gap-2">
              <User className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase">
                  {t("tickets.columns.createdBy")}
                </p>
                <p className="truncate text-xs">
                  {detail.creator_name ?? detail.creator_email ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] uppercase">
                  {t("tickets.columns.createdAt")}
                </p>
                <p className="text-xs">{new Date(detail.created_at).toLocaleString()}</p>
              </div>
            </div>

            {detail.due_at && (
              <div className="flex items-start gap-2">
                <Clock className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    {t("tickets.fields.dueAt")}
                  </p>
                  <p className="text-xs">{new Date(detail.due_at).toLocaleString()}</p>
                </div>
              </div>
            )}

            {detail.ticket_type_name && (
              <div className="flex items-start gap-2">
                <Tag className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] uppercase">
                    {t("tickets.columns.type")}
                  </p>
                  <p className="truncate text-xs">{detail.ticket_type_name}</p>
                </div>
              </div>
            )}

            {detail.assignees.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1.5 text-[10px] uppercase">
                    {t("tickets.columns.responders")}
                  </p>
                  <div className="space-y-1.5">
                    {detail.assignees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-2">
                        <UserAvatar
                          className="h-5 w-5"
                          fullName={a.name}
                          email={a.email}
                          src={a.avatar_url}
                          profileHref={a.profile_href ?? undefined}
                        />
                        <span className="truncate text-xs">{a.name ?? a.email ?? a.user_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {activity.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="text-xs font-semibold">{t("tickets.activityLabel")}</h4>
              <div className="space-y-2">
                {activity.slice(0, 10).map((a) => (
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

      <AssignQrDialog
        open={showAssignQr}
        onOpenChange={setShowAssignQr}
        ticketId={detail.id}
        ticketNumber={detail.ticket_number}
        onAssigned={(a) => setQrAssignment(a)}
      />
    </div>
  );
}
