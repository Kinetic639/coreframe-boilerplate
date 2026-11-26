"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Hand,
  Link2Off,
  Loader2,
  QrCode,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { refreshTicket } from "@/lib/help-desk/ticket-queries";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { AssignQrDialog } from "../[ticketId]/_components/assign-qr-dialog";
import { QrPrintLabelButton } from "@/components/features/qr";
import {
  useAcceptTicketMutation,
  useCloseTicketMutation,
  useSetTicketStatusMutation,
  useTakeTicketMutation,
  useUpdateTicketMutation,
  type TicketEditInput,
} from "@/hooks/queries/help-desk";
import type {
  HelpdeskTicketActivity,
  HelpdeskTicketDetail,
  HelpdeskTicketQr,
} from "@/server/services/helpdesk-tickets.service";
import type { StatusBadgeConfig } from "@/components/help-desk/ticket-status-badge";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";
import { AttachmentsPanel } from "@/components/features/attachments";
import { CommentsThread } from "@/components/features/comments";
import { helpdeskTicketTypingTopic } from "@repo/rich-text/comments";
import { formatDateTime } from "@/lib/date-time/format";
import { cn } from "@/utils";
import {
  DescriptionField,
  PriorityChip,
  Property,
  SaveIndicator,
  SideHeading,
  SideRow,
  StatusChip,
  TitleField,
  TypeChip,
  useWideLayout,
} from "./ticket-card-parts";

type CardTab = "ticket" | "details" | "comments" | "activity";

export interface TicketCardNavigation {
  /** The list's side panel: close it. */
  onClose?: () => void;
  /** The list's side panel: a link to the ticket's own page. */
  openFull?: boolean;
  /** The ticket's page: a link back to the list. */
  back?: boolean;
}

/**
 * A ticket's card, the same in the list's side panel and on the ticket's page.
 * Like the task card: the ticket on the left (title, properties, handling
 * actions, description, files) and Details / Comments / Activity tabs on the
 * right; where the card is narrow (a phone, a narrow panel) it is one column
 * with four tabs and the handling actions held at the bottom.
 *
 * Everything comes with the ticket (one request). Edits and handling show at
 * once and are put back if the server refuses them.
 */
export function TicketDetailPanel({
  detail,
  currentUserId,
  statusConfigs,
  priorityConfigs,
  navigation,
}: {
  detail: HelpdeskTicketDetail;
  currentUserId: string;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  navigation?: TicketCardNavigation;
}) {
  const t = useTranslations("modules.helpDesk");
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWideLayout(rootRef);
  const [chosenTab, setChosenTab] = useState<CardTab | null>(null);
  const tab: CardTab =
    chosenTab === null || (wide && chosenTab === "ticket")
      ? wide
        ? "details"
        : "ticket"
      : chosenTab;

  // Decided for this ticket's branch: handlers may hold helpdesk.tickets.manage for one branch.
  const canManage = detail.can_manage;
  const isOpen = detail.status !== "closed" && detail.status !== "cancelled";
  const canEdit = isOpen && (canManage || detail.created_by === currentUserId);
  const canComment = isOpen;
  const isMineToHandle = detail.assignees.some((a) => a.user_id === currentUserId);
  const canTake = canManage && isOpen && !isMineToHandle;
  const canClose = isOpen && !canManage && detail.created_by === currentUserId;
  const canAccept =
    detail.requires_acceptance &&
    !detail.accepted_at &&
    (canManage || detail.acceptors.some((a) => a.user_id === currentUserId));

  const update = useUpdateTicketMutation(detail.ticket_number, detail.org_id);
  const setStatus = useSetTicketStatusMutation(detail.ticket_number, detail.org_id);
  const take = useTakeTicketMutation(detail.ticket_number, detail.org_id, currentUserId);
  const close = useCloseTicketMutation(detail.ticket_number, detail.org_id);
  const accept = useAcceptTicketMutation(detail.ticket_number, detail.org_id, currentUserId);
  const edit = (fields: Omit<TicketEditInput, "ticket_id">) =>
    update.mutate({ ticket_id: detail.id, ...fields });

  // A comment or a file adds an activity entry: fetch the card once (one request).
  const refreshActivity = useCallback(() => {
    void refreshTicket(queryClient, detail.org_id, detail.ticket_number, { lists: false });
  }, [queryClient, detail.org_id, detail.ticket_number]);

  const toolbar = (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      {navigation?.onClose ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={navigation.onClose}
          aria-label={t("tickets.card.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
      {navigation?.back ? (
        <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2">
          <Link href="/dashboard/help-desk/tickets">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tickets.backToList")}</span>
          </Link>
        </Button>
      ) : null}
      <span
        id="helpdesk-ticket-panel-title"
        className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
      >
        {detail.ticket_number}
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <SaveIndicator saving={update.isPending} saved={update.isSuccess} />
        {navigation?.openFull ? (
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2.5">
            <Link
              href={{
                pathname: "/dashboard/help-desk/tickets/[ticketId]",
                params: { ticketId: detail.ticket_number },
              }}
              aria-label={t("tickets.viewFull")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("tickets.viewFull")}</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );

  const actionButtons =
    canTake || canAccept || canClose ? (
      <>
        {canTake ? (
          <Button
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            disabled={take.isPending}
            onClick={() => take.mutate({ ticket_id: detail.id })}
          >
            {take.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Hand className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("tickets.handling.take")}
          </Button>
        ) : null}
        {canAccept ? (
          <Button
            size="sm"
            variant={canTake ? "outline" : "default"}
            className="min-w-0 flex-1 sm:flex-none"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ ticket_id: detail.id })}
          >
            {accept.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("tickets.acceptance.acceptButton")}
          </Button>
        ) : null}
        {canClose ? (
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 sm:flex-none"
            disabled={close.isPending}
            onClick={() => close.mutate({ ticket_id: detail.id })}
          >
            {close.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("tickets.closeTicket")}
          </Button>
        ) : null}
      </>
    ) : null;

  const heading = (
    <div className="space-y-4 px-4 pt-4 sm:px-6">
      <div className="space-y-1">
        <p className="truncate text-xs text-muted-foreground">
          {t("tickets.card.reportedLine", {
            name: detail.creator_name ?? detail.creator_email ?? t("tickets.card.unknown"),
            date: formatDateTime(detail.created_at),
          })}
        </p>
        <TitleField value={detail.title} editable={canEdit} onSave={(title) => edit({ title })} />
      </div>
      <div
        className={cn(
          "flex gap-x-5 gap-y-3",
          wide
            ? "flex-wrap"
            : "-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6"
        )}
      >
        <Property label={t("tickets.columns.status")}>
          <StatusChip
            status={detail.status}
            config={statusConfigs}
            editable={canManage}
            onChange={(status) => setStatus.mutate({ ticket_id: detail.id, status })}
          />
        </Property>
        <Property label={t("tickets.columns.priority")}>
          <PriorityChip
            priority={detail.priority}
            config={priorityConfigs}
            editable={canEdit}
            onChange={(priority) => edit({ priority })}
          />
        </Property>
        <Property label={t("tickets.columns.type")}>
          <TypeChip
            typeId={detail.ticket_type_id}
            name={detail.ticket_type_name}
            color={detail.ticket_type_color}
            editable={canEdit}
            onChange={(type) =>
              edit({
                ticket_type_id: type.id,
                display: {
                  ticket_type_name: type.name,
                  ticket_type_color: type.color,
                  ticket_type_icon: type.icon,
                },
              })
            }
          />
        </Property>
        <Property label={t("tickets.columns.responders")}>
          <AvatarStack people={detail.assignees} empty={t("tickets.card.noResponders")} />
        </Property>
        {detail.requires_acceptance ? (
          <Property label={t("tickets.acceptance.label")}>
            <AcceptancePill accepted={Boolean(detail.accepted_at)} />
          </Property>
        ) : null}
        {detail.due_at ? (
          <Property label={t("tickets.fields.dueAt")}>
            <span className="inline-flex h-[22px] items-center text-sm">
              {formatDateTime(detail.due_at)}
            </span>
          </Property>
        ) : null}
      </div>
      {wide && actionButtons ? <div className="flex flex-wrap gap-2">{actionButtons}</div> : null}
    </div>
  );

  const work = (
    <div className="space-y-7 px-4 py-5 sm:px-6">
      <DescriptionField
        ticketId={detail.id}
        rich={detail.description_rich}
        plain={detail.description_plain}
        editable={canEdit}
        saving={update.isPending}
        onSave={(rich, plain) => edit({ description_rich: rich, description_plain: plain })}
      />
      <AttachmentsPanel
        targetType="helpdesk.ticket"
        targetId={detail.id}
        canUpload={canComment}
        labels={{ sectionTitle: t("tickets.fields.attachments") }}
        onUploaded={refreshActivity}
        onDeleted={refreshActivity}
      />
    </div>
  );

  const details = <TicketDetailsTab detail={detail} canManage={canManage} />;

  const comments = (
    <div className="p-4">
      <CommentsThread
        key={detail.id}
        targetType="helpdesk.ticket"
        targetId={detail.id}
        canComment={canComment}
        typingTopic={canComment ? helpdeskTicketTypingTopic(detail.id) : null}
        initialData={{
          rows: detail.comments,
          totalCount: detail.comments_total,
          nextCursor: detail.comments_next_cursor,
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
        composer="top"
        showTitle={false}
        onCommentAdded={refreshActivity}
      />
    </div>
  );

  const activity = (
    <div className="p-4">
      <ActivityList activity={detail.activity} />
    </div>
  );

  const tabs: { id: CardTab; label: string; count?: number }[] = [
    ...(wide ? [] : [{ id: "ticket" as const, label: t("tickets.card.tabTicket") }]),
    { id: "details", label: t("tickets.card.tabDetails") },
    { id: "comments", label: t("tickets.card.tabComments"), count: detail.comments_total },
    { id: "activity", label: t("tickets.card.tabActivity") },
  ];

  const tabBar = (
    <div
      role="tablist"
      aria-label={t("tickets.card.tabsLabel")}
      className="flex gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`ticket-tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls={`ticket-panel-${item.id}`}
          onClick={() => setChosenTab(item.id)}
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm",
            tab === item.id && "bg-background text-foreground shadow-sm"
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.count ? (
            <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] leading-4 tabular-nums">
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );

  const panel = (id: CardTab, content: React.ReactNode) => (
    <div
      role="tabpanel"
      id={`ticket-panel-${id}`}
      aria-labelledby={`ticket-tab-${id}`}
      hidden={tab !== id}
    >
      {content}
    </div>
  );

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {toolbar}
      {wide ? (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {heading}
            {work}
          </div>
          <aside className="flex min-h-0 w-[22rem] shrink-0 flex-col border-l bg-muted/30 xl:w-96">
            <div className="shrink-0 p-3 pb-0">{tabBar}</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel("details", details)}
              {panel("comments", comments)}
              {panel("activity", activity)}
            </div>
          </aside>
        </div>
      ) : (
        <>
          {/* The editor toolbar sticks under the tab bar (its height: 2rem tabs, padding, border). */}
          <div className="min-h-0 flex-1 overflow-y-auto [--rich-text-toolbar-top:calc(3.5rem+1px)]">
            {heading}
            <div className="sticky top-0 z-20 mt-3 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
              {tabBar}
            </div>
            {panel("ticket", work)}
            {panel("details", details)}
            {panel("comments", comments)}
            {panel("activity", activity)}
          </div>
          {actionButtons ? (
            <div className="flex shrink-0 gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {actionButtons}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AvatarStack({
  people,
  empty,
}: {
  people: HelpdeskTicketDetail["assignees"];
  empty: string;
}) {
  if (people.length === 0) {
    return (
      <span className="inline-flex h-[22px] items-center text-sm text-muted-foreground">
        {empty}
      </span>
    );
  }
  const names = people.map((p) => p.name ?? p.email ?? "").join(", ");
  return (
    <div className="flex h-[22px] items-center" title={names}>
      <div className="flex -space-x-1.5">
        {people.slice(0, 4).map((p) => (
          <UserAvatar
            key={p.user_id}
            className="h-6 w-6 ring-2 ring-background"
            fullName={p.name}
            email={p.email}
            src={p.avatar_url}
          />
        ))}
      </div>
      {people.length === 1 ? (
        <span className="ml-2 max-w-36 truncate text-sm">{names}</span>
      ) : people.length > 4 ? (
        <span className="ml-1.5 text-xs text-muted-foreground">+{people.length - 4}</span>
      ) : null}
    </div>
  );
}

function AcceptancePill({ accepted }: { accepted: boolean }) {
  const t = useTranslations("modules.helpDesk.tickets.acceptance");
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium",
        accepted
          ? "bg-green-500/10 text-green-700 dark:text-green-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {accepted ? t("accepted") : t("pending")}
    </span>
  );
}

function PersonRow({
  name,
  email,
  avatarUrl,
  profileHref,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileHref?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-1">
      <UserAvatar
        className="h-6 w-6"
        fullName={name}
        email={email}
        src={avatarUrl}
        profileHref={profileHref ?? undefined}
      />
      <span className="truncate text-sm">{name ?? email ?? "—"}</span>
    </div>
  );
}

/** The right side's first tab: people, acceptance, QR code and dates. */
function TicketDetailsTab({
  detail,
  canManage,
}: {
  detail: HelpdeskTicketDetail;
  canManage: boolean;
}) {
  const t = useTranslations("modules.helpDesk.tickets");

  // QR assignment: comes with the ticket; changed here by assign / unlink.
  const [qrAssignment, setQrAssignment] = useState<HelpdeskTicketQr | null>(detail.qr_assignment);
  const [showAssignQr, setShowAssignQr] = useState(false);
  const [isRevokingQr, setIsRevokingQr] = useState(false);

  const handleRevokeQr = async () => {
    if (!qrAssignment) return;
    setIsRevokingQr(true);
    try {
      const result = await revokeQrAction({ qrCodeId: qrAssignment.qrCodeId });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      setQrAssignment(null);
      toast.success(t("qr.unlinked"));
    } finally {
      setIsRevokingQr(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-1">
        <SideHeading>{t("card.people")}</SideHeading>
        <p className="pt-1 text-xs text-muted-foreground">{t("columns.createdBy")}</p>
        <PersonRow
          name={detail.creator_name}
          email={detail.creator_email}
          avatarUrl={detail.creator_avatar_url}
          profileHref={detail.creator_profile_href}
        />
        <p className="pt-2 text-xs text-muted-foreground">{t("columns.responders")}</p>
        {detail.assignees.length > 0 ? (
          detail.assignees.map((a) => (
            <PersonRow
              key={a.user_id}
              name={a.name}
              email={a.email}
              avatarUrl={a.avatar_url}
              profileHref={a.profile_href}
            />
          ))
        ) : (
          <p className="py-1 text-sm text-muted-foreground">{t("card.noResponders")}</p>
        )}
      </section>

      {detail.requires_acceptance ? (
        <section className="space-y-2">
          <SideHeading>{t("acceptance.label")}</SideHeading>
          <AcceptancePill accepted={Boolean(detail.accepted_at)} />
          {detail.accepted_at ? (
            <div className="space-y-0.5 text-sm">
              {detail.accepted_by_name ? (
                <p className="truncate">{detail.accepted_by_name}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{formatDateTime(detail.accepted_at)}</p>
            </div>
          ) : null}
          {detail.acceptors.length > 0 ? (
            <div>
              <p className="pt-1 text-xs text-muted-foreground">
                {t("acceptance.authorizedAcceptors")}
              </p>
              {detail.acceptors.map((a) => (
                <PersonRow
                  key={a.user_id}
                  name={a.name}
                  email={a.email}
                  avatarUrl={a.avatar_url}
                  profileHref={a.profile_href}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2">
        <SideHeading>{t("qr.title")}</SideHeading>
        {qrAssignment ? (
          <div className="space-y-2">
            <div className="rounded-md border bg-background px-3 py-2 text-sm">
              <p className="truncate font-medium">{qrAssignment.label ?? t("qr.unlabelled")}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {qrAssignment.token}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
              <QrPrintLabelButton
                qrCodeId={qrAssignment.qrCodeId}
                name={qrAssignment.label ?? detail.ticket_number}
                className="w-full"
                targetType="helpdesk.ticket"
              />
              {canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleRevokeQr}
                  disabled={isRevokingQr}
                >
                  {isRevokingQr ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2Off className="h-3.5 w-3.5" />
                  )}
                  {t("qr.unlink")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : canManage ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-1.5"
            onClick={() => setShowAssignQr(true)}
          >
            <QrCode className="h-3.5 w-3.5" />
            {t("qr.assign")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("qr.none")}</p>
        )}
      </section>

      <section className="space-y-1">
        <SideHeading>{t("card.dates")}</SideHeading>
        <div>
          <SideRow label={t("columns.createdAt")}>{formatDateTime(detail.created_at)}</SideRow>
          <SideRow label={t("columns.updatedAt")}>{formatDateTime(detail.updated_at)}</SideRow>
          {detail.due_at ? (
            <SideRow label={t("fields.dueAt")}>{formatDateTime(detail.due_at)}</SideRow>
          ) : null}
          {detail.closed_at ? (
            <SideRow label={t("card.closedAt")}>{formatDateTime(detail.closed_at)}</SideRow>
          ) : null}
        </div>
      </section>

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

const CHANGED_FIELDS = ["title", "priority", "ticket_type_id", "description"] as const;

function ActivityList({ activity }: { activity: HelpdeskTicketActivity[] }) {
  const t = useTranslations("modules.helpDesk.tickets");
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("card.noActivity")}</p>;
  }
  return (
    <ol className="space-y-3">
      {activity.map((entry) => {
        const payload = (entry.payload ?? {}) as Record<string, unknown>;
        let detailText: string | null = null;
        if (entry.event_type === "status_changed" || entry.event_type === "ticket_taken") {
          const to = payload.to as string | undefined;
          if (to) detailText = t(`status.${to}`, { defaultValue: to });
        } else if (entry.event_type === "ticket_updated") {
          const fields = CHANGED_FIELDS.filter((field) => field in payload);
          if (fields.length)
            detailText = fields.map((field) => t(`card.changed.${field}`)).join(", ");
        }
        return (
          <li key={entry.id} className="flex gap-2.5 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {entry.actor_name ?? t("card.system")}
                </span>{" "}
                {t(`activity.${entry.event_type}`, { defaultValue: entry.event_type })}
                {detailText ? <span className="text-foreground">: {detailText}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
