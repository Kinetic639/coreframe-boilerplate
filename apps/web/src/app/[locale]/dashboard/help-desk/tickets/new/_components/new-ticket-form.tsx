"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MemberSelector, type MemberOption } from "@/components/help-desk/member-selector";
import type { HelpdeskTicketType } from "@/server/services/helpdesk-ticket-types.service";
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/validations/helpdesk";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { ENTITY_MENTIONS } from "@/components/v2/mentions/mention-suggestion-list";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";
import {
  useCreateTicketMutation,
  useTicketTypeDefaultRespondersQuery,
  useTicketTypeDefaultAcceptorsQuery,
} from "@/hooks/queries/help-desk";
import type { StatusBadgeConfig } from "@/components/help-desk/ticket-status-badge";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { StagedUploadsField } from "@/components/features/attachments";
import { QrCodeStagingField, type StagedQrCode } from "@/components/features/qr";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_ASSIGN, QR_CREATE } from "@/lib/constants/permissions";
import { registerUploadedAttachments } from "@/hooks/queries/attachments/direct-upload";
import { useStagedAttachmentUploads } from "@/hooks/queries/attachments/use-staged-attachment-uploads";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { cn } from "@/utils";
import { assignQrToTicketAction, createAndAssignQrToTicketAction } from "@/app/actions/qr/assign";

interface NewTicketFormProps {
  ticketTypes: HelpdeskTicketType[];
  members: MemberOption[];
  activeBranchId: string | null;
  statusConfigs: Record<string, StatusBadgeConfig> | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  initialQr?: { qrCodeId: string; token: string; label: string | null } | null;
  /**
   * "page": the ticket's own page (after scanning a QR code, or a link).
   * "dialog": inside the list's dialog; the dialog gives the title and closes it.
   */
  variant?: "page" | "dialog";
  /** Dialog: the ticket was created (its number). The page opens the ticket itself. */
  onCreated?: (ticketNumber: string) => void;
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export function NewTicketForm({
  ticketTypes,
  members,
  activeBranchId,
  priorityConfigs,
  initialQr,
  variant = "page",
  onCreated,
  onCancel,
  onSubmittingChange,
}: NewTicketFormProps) {
  const visibleTicketTypes = ticketTypes.filter(
    (tt) =>
      (tt as any).scope !== "branch" ||
      ((tt as any).scope === "branch" && (tt as any).branch_id === activeBranchId)
  );
  const t = useTranslations("modules.helpDesk");
  const activeOrgId = useAppStoreV2((state) => state.activeOrgId);
  const router = useRouter();
  const { can } = usePermissions();

  const [title, setTitle] = useState("");
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [acceptorIds, setAcceptorIds] = useState<string[]>([]);
  const [ticketTypeId, setTicketTypeId] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Files upload the moment they are picked; creating the ticket only records them.
  const staged = useStagedAttachmentUploads(activeOrgId);
  const [fileError, setFileError] = useState<string | null>(null);
  const [waitingForFiles, setWaitingForFiles] = useState(false);
  const [stagedQr, setStagedQr] = useState<StagedQrCode | null>(
    initialQr
      ? { qrCodeId: initialQr.qrCodeId, token: initialQr.token, label: initialQr.label }
      : null
  );

  // Cached query — re-selecting the same type reuses the cached result, no extra network call
  const { data: defaultResponders } = useTicketTypeDefaultRespondersQuery(ticketTypeId || null);
  const { data: defaultAcceptors } = useTicketTypeDefaultAcceptorsQuery(ticketTypeId || null);
  const appliedTypeIdRef = useRef<string>("");
  const createTicketMutation = useCreateTicketMutation(activeOrgId ?? undefined);

  // Apply default responders, acceptors, and priority when ticket type changes
  useEffect(() => {
    if (!ticketTypeId || ticketTypeId === appliedTypeIdRef.current) return;
    if (defaultResponders === undefined) return; // still loading

    const selectedType = ticketTypes.find((tt) => tt.id === ticketTypeId);
    const typeRequiresAcceptance = (selectedType as any)?.requires_acceptance === true;

    // Wait for acceptors query too when the type requires acceptance
    if (typeRequiresAcceptance && defaultAcceptors === undefined) return;

    appliedTypeIdRef.current = ticketTypeId;

    if (defaultResponders.length > 0) {
      const defaultIds = defaultResponders.map((r) => r.responder_user_id);
      setAssigneeIds((prev) => [...new Set([...prev, ...defaultIds])]);
    }

    if (selectedType?.default_priority) {
      setPriority(selectedType.default_priority);
    }

    if (typeRequiresAcceptance) {
      setRequiresAcceptance(true);
      if (defaultAcceptors && defaultAcceptors.length > 0) {
        const ids = defaultAcceptors.map((a) => a.user_id);
        setAcceptorIds((prev) => [...new Set([...prev, ...ids])]);
      }
    }
  }, [ticketTypeId, defaultResponders, defaultAcceptors, ticketTypes]);

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("tickets.validation.titleRequired");
    if (assigneeIds.length === 0) errs.assignees = t("tickets.validation.responderRequired");
    if (requiresAcceptance && acceptorIds.length === 0)
      errs.acceptors = t("tickets.validation.acceptorRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Files still on their way are waited for, so the ticket never shows up without them.
    let uploaded: Awaited<ReturnType<typeof staged.settled>>["payloads"] = [];
    if (staged.items.length > 0) {
      setWaitingForFiles(true);
      const outcome = await staged.settled();
      setWaitingForFiles(false);
      if (outcome.failed > 0) {
        setFileError(t("tickets.filesNotSent"));
        return;
      }
      uploaded = outcome.payloads;
    }
    setFileError(null);

    const descriptionPlain = extractPlainText(descriptionRich);
    createTicketMutation.mutate(
      {
        title: title.trim(),
        description_plain: descriptionPlain || undefined,
        description_rich: descriptionRich,
        status: "waiting_response",
        priority,
        ticket_type_id: ticketTypeId || undefined,
        branch_id: activeBranchId || undefined,
        assignee_user_ids: assigneeIds,
        requires_acceptance: requiresAcceptance,
        acceptor_user_ids: acceptorIds,
      },
      {
        onSuccess: async (data) => {
          toast.success(t("tickets.created", { number: data.ticket_number }));

          const followUps: Promise<unknown>[] = [];
          if (uploaded.length > 0) {
            // Already in storage: one quick call records them on the ticket.
            followUps.push(
              registerUploadedAttachments({
                targetType: "helpdesk.ticket",
                targetId: data.id,
                files: uploaded,
              }).catch(() => toast.error(t("tickets.attachmentUploadFailed")))
            );
          }
          if (stagedQr) {
            followUps.push(
              (async () => {
                try {
                  // "New code": created and assigned now that the ticket exists.
                  const result = stagedQr.isNew
                    ? await createAndAssignQrToTicketAction({
                        ticketId: data.id,
                        label: data.ticket_number ?? null,
                      })
                    : await assignQrToTicketAction({
                        qrCodeId: stagedQr.qrCodeId,
                        ticketId: data.id,
                      });
                  if (!result.success) {
                    toast.error(
                      (result as { success: false; error: string }).error ||
                        t("tickets.qrAssignFailed")
                    );
                  }
                } catch {
                  toast.error(t("tickets.qrAssignFailed"));
                }
              })()
            );
          }
          if (followUps.length > 0) await Promise.allSettled(followUps);

          if (onCreated) {
            onCreated(data.ticket_number);
            return;
          }
          router.push({
            pathname: "/dashboard/help-desk/tickets/[ticketId]",
            params: { ticketId: data.ticket_number },
          });
        },
      }
    );
  };

  const selectedType = ticketTypes.find((tt) => tt.id === ticketTypeId);
  const allowsManualAssignees = selectedType?.allows_manual_assignees ?? true;
  const busy = createTicketMutation.isPending || waitingForFiles;
  const isDialog = variant === "dialog";
  const cancel = () => (onCancel ? onCancel() : router.push("/dashboard/help-desk/tickets"));

  // The dialog keeps itself open while the ticket is being sent.
  useEffect(() => {
    onSubmittingChange?.(busy);
  }, [busy, onSubmittingChange]);

  const submitLabel = busy ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {waitingForFiles
        ? t("tickets.waitingForFiles", { count: staged.uploading })
        : t("tickets.submitting")}
    </>
  ) : (
    <>
      <Send className="mr-2 h-4 w-4" />
      {t("tickets.submit")}
    </>
  );

  const choiceClass = (selected: boolean) =>
    cn(
      "inline-flex h-9 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors disabled:opacity-50",
      selected
        ? "border-primary bg-primary/10 font-medium text-foreground"
        : "border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
    );

  // Two columns where there is room: the ticket on the left, who handles it
  // on the right (as on the ticket card); one column on a phone.
  const columns = (
    <div
      className={cn(
        "flex flex-col gap-5",
        isDialog
          ? "md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:gap-6"
          : "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">
            {t("tickets.fields.title")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) clearError("title");
            }}
            placeholder={t("tickets.fields.titlePlaceholder")}
            maxLength={255}
            disabled={busy}
            aria-invalid={Boolean(errors.title)}
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("tickets.fields.description")}</Label>
          <div className="rounded-md border border-input">
            <RichTextEditorField
              value={descriptionRich}
              onChange={setDescriptionRich}
              mode="simple"
              placeholder={t("tickets.fields.descriptionPlaceholder")}
              disabled={busy}
              maxLength={10000}
              mention={ENTITY_MENTIONS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("tickets.fields.attachments")}</Label>
          <StagedUploadsField
            staged={staged}
            disabled={busy}
            error={fileError}
            onError={setFileError}
          />
        </div>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-5",
          isDialog ? "md:border-l md:pl-6" : "lg:border-l lg:pl-8"
        )}
      >
        {visibleTicketTypes.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label id="ticket-type-label">{t("tickets.fields.ticketType")}</Label>
            <div
              role="radiogroup"
              aria-labelledby="ticket-type-label"
              className="flex flex-wrap gap-2"
            >
              {[
                { id: "", name: t("tickets.form.noType"), color: null as string | null },
                ...visibleTicketTypes,
              ].map((tt) => (
                <button
                  key={tt.id || "none"}
                  type="button"
                  role="radio"
                  aria-checked={ticketTypeId === tt.id}
                  disabled={busy}
                  onClick={() => setTicketTypeId(tt.id)}
                  className={choiceClass(ticketTypeId === tt.id)}
                >
                  {tt.color ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tt.color }}
                    />
                  ) : null}
                  <span className="truncate">{tt.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>
            {t("tickets.fields.responders")} <span className="text-destructive">*</span>
          </Label>
          <MemberSelector
            members={members}
            selectedIds={assigneeIds}
            onChange={(ids) => {
              setAssigneeIds(ids);
              if (ids.length) clearError("assignees");
            }}
            placeholder={t("tickets.fields.respondersPlaceholder")}
            disabled={busy || !allowsManualAssignees}
          />
          {errors.assignees && <p className="text-xs text-destructive">{errors.assignees}</p>}
          {!allowsManualAssignees && (
            <p className="text-xs text-muted-foreground">{t("tickets.fields.respondersFixed")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label id="priority-label">{t("tickets.fields.priority")}</Label>
          <div
            role="radiogroup"
            aria-labelledby="priority-label"
            className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1"
          >
            {TICKET_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                disabled={busy}
                onClick={() => setPriority(p)}
                className={cn(
                  "h-9 min-w-0 truncate rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors sm:text-sm",
                  priority === p && "bg-background text-foreground shadow-sm"
                )}
              >
                {priorityConfigs?.[p]?.label ?? t(`tickets.priority.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="requiresAcceptance">{t("tickets.fields.requiresAcceptance")}</Label>
            <Switch
              id="requiresAcceptance"
              checked={requiresAcceptance}
              onCheckedChange={(checked) => {
                setRequiresAcceptance(checked);
                if (!checked) {
                  setAcceptorIds([]);
                  clearError("acceptors");
                }
              }}
              disabled={busy}
            />
          </div>
          {requiresAcceptance && (
            <>
              <MemberSelector
                members={members}
                selectedIds={acceptorIds}
                onChange={(ids) => {
                  setAcceptorIds(ids);
                  if (ids.length) clearError("acceptors");
                }}
                placeholder={t("tickets.fields.acceptorsPlaceholder")}
                disabled={busy}
              />
              {errors.acceptors && <p className="text-xs text-destructive">{errors.acceptors}</p>}
            </>
          )}
        </div>

        {can(QR_ASSIGN) && (
          <div className="flex flex-col gap-1.5">
            <Label>{t("tickets.fields.qrCode")}</Label>
            <QrCodeStagingField
              value={stagedQr}
              onChange={setStagedQr}
              canGenerate={can(QR_CREATE)}
              disabled={busy}
            />
          </div>
        )}
      </div>
    </div>
  );

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 border-input bg-transparent font-normal shadow-none sm:h-10"
        onClick={cancel}
        disabled={createTicketMutation.isPending}
      >
        {t("tickets.cancel")}
      </Button>
      <Button type="submit" className="h-11 flex-1 sm:h-10 sm:flex-none" disabled={busy}>
        {submitLabel}
      </Button>
    </>
  );

  if (isDialog) {
    // The fields scroll; the buttons stay at the bottom (a full screen on a phone).
    return (
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{columns}</div>
        <div className="flex shrink-0 gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-3">
          {actionButtons}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-5xl flex-col p-4 sm:p-6">
      <div className="flex flex-col gap-1 pb-4">
        <Link
          href="/dashboard/help-desk/tickets"
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("tickets.backToList")}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{t("tickets.newTicket")}</h1>
      </div>
      <div className="pb-24 lg:pb-4">{columns}</div>
      {/* On phones the buttons stay at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:justify-end lg:px-0 lg:pb-0">
        {actionButtons}
      </div>
    </form>
  );
}
