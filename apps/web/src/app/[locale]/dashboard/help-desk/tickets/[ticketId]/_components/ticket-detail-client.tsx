"use client";

import { useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  User,
  Tag,
  Calendar,
  QrCode,
  Link2Off,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TicketStatusBadge,
  type StatusBadgeConfig,
} from "@/components/help-desk/ticket-status-badge";
import {
  TicketPriorityBadge,
  type PriorityBadgeConfig,
} from "@/components/help-desk/ticket-priority-badge";
import type { HelpdeskTicketDetail } from "@/server/services/helpdesk-tickets.service";
import { CommentsThread } from "@/components/features/comments";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import { normalizeRichText } from "@/components/primitives/rich-text/rich-text-utils";
import {
  useTicketDetailQuery,
  useCloseTicketMutation,
  useAcceptTicketMutation,
} from "@/hooks/queries/help-desk";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { AssignQrDialog } from "./assign-qr-dialog";

type QrAssignmentInfo = {
  assignmentId: string;
  qrCodeId: string;
  token: string;
  label: string | null;
  status: string;
} | null;

interface TicketDetailClientProps {
  ticket: HelpdeskTicketDetail;
  canManage: boolean;
  currentUserId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  initialQrAssignment: QrAssignmentInfo;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function TicketDetailClient({
  ticket: initialTicket,
  canManage,
  currentUserId,
  statusConfigs,
  priorityConfigs,
  initialQrAssignment,
}: TicketDetailClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();

  // React Query: SSR data as initialData — no loading flash, auto-refreshes after mutations
  const { data: ticket = initialTicket } = useTicketDetailQuery(
    initialTicket.ticket_number,
    initialTicket.org_id,
    initialTicket
  );
  const closeTicketMutation = useCloseTicketMutation(initialTicket.ticket_number);
  const acceptTicketMutation = useAcceptTicketMutation(initialTicket.ticket_number);

  const canAccept =
    ticket.requires_acceptance &&
    !ticket.accepted_at &&
    (canManage || ticket.acceptors.some((a) => a.user_id === currentUserId));
  // QR assignment state
  const [qrAssignment, setQrAssignment] = useState<QrAssignmentInfo>(initialQrAssignment);
  const [showAssignQr, setShowAssignQr] = useState(false);
  const [isRevokingQr, setIsRevokingQr] = useState(false);

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

  const isCreator = ticket.created_by === currentUserId;
  const canClose =
    (canManage || isCreator) && ticket.status !== "closed" && ticket.status !== "cancelled";

  const handleClose = useCallback(() => {
    if (!canClose) return;
    closeTicketMutation.mutate({ ticket_id: ticket.id });
  }, [closeTicketMutation, ticket.id, canClose]);

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
              <TicketStatusBadge status={ticket.status} config={statusConfigs?.[ticket.status]} />
              <TicketPriorityBadge
                priority={ticket.priority}
                config={priorityConfigs?.[ticket.priority]}
              />
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
          <CommentsThread
            targetType="helpdesk.ticket"
            targetId={ticket.id}
            canComment={ticket.status !== "closed" && ticket.status !== "cancelled"}
            initialData={{
              rows: ticket.comments,
              totalCount: ticket.comments.length,
              nextCursor: null,
            }}
            labels={{
              title: t("tickets.comments"),
              empty: t("tickets.noComments"),
              placeholder: t("tickets.commentPlaceholder"),
              submit: t("tickets.addComment"),
            }}
            density="compact"
          />
        </div>

        {/* Sidebar */}
        <div className="w-full space-y-4 lg:w-64 lg:shrink-0">
          {/* QR Code */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              QR Code
            </h3>
            {qrAssignment ? (
              <div className="space-y-2">
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <p className="font-medium truncate">{qrAssignment.label ?? "Unlabelled"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {qrAssignment.token}
                  </p>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={handleRevokeQr}
                    disabled={isRevokingQr}
                  >
                    {isRevokingQr ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2Off className="mr-2 h-3.5 w-3.5" />
                    )}
                    Unlink QR Code
                  </Button>
                )}
              </div>
            ) : (
              canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAssignQr(true)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Assign QR Code
                </Button>
              )
            )}
            {!qrAssignment && !canManage && (
              <p className="text-xs text-muted-foreground">No QR code assigned.</p>
            )}
          </div>

          {/* Close button */}
          {canClose && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={closeTicketMutation.isPending}
            >
              {closeTicketMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {t("tickets.closeTicket")}
            </Button>
          )}

          {/* Acceptance */}
          {ticket.requires_acceptance && (
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("tickets.acceptance.label")}</h3>
              {ticket.accepted_at ? (
                <div className="space-y-1">
                  <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {t("tickets.acceptance.accepted")}
                  </span>
                  {ticket.accepted_by_name && <p className="text-sm">{ticket.accepted_by_name}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(ticket.accepted_at)}</p>
                </div>
              ) : (
                <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  {t("tickets.acceptance.pending")}
                </span>
              )}
              {ticket.acceptors.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                      {t("tickets.acceptance.authorizedAcceptors")}
                    </p>
                    <div className="space-y-2">
                      {ticket.acceptors.map((a) => (
                        <div key={a.user_id} className="flex items-center gap-2">
                          <UserAvatar
                            className="h-6 w-6"
                            fullName={a.name}
                            email={a.email}
                            src={a.avatar_url}
                            profileHref={a.profile_href}
                          />
                          <span className="truncate text-sm">{a.name ?? a.email ?? a.user_id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {canAccept && (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => acceptTicketMutation.mutate({ ticket_id: ticket.id })}
                  disabled={acceptTicketMutation.isPending}
                >
                  {acceptTicketMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("tickets.acceptance.acceptButton")}
                </Button>
              )}
            </div>
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

      <AssignQrDialog
        open={showAssignQr}
        onOpenChange={setShowAssignQr}
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
        onAssigned={(a) => setQrAssignment(a)}
      />
    </div>
  );
}
