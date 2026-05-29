"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberSelector, type MemberOption } from "@/components/help-desk/member-selector";
import { createTicketAction, getTicketTypeDefaultRespondersAction } from "@/app/actions/help-desk";
import type { HelpdeskTicketType } from "@/server/services/helpdesk-ticket-types.service";
import { TICKET_PRIORITIES, type TicketPriority } from "@/lib/validations/helpdesk";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";

interface NewTicketFormProps {
  ticketTypes: HelpdeskTicketType[];
  members: MemberOption[];
}

export function NewTicketForm({ ticketTypes, members }: NewTicketFormProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [ticketTypeId, setTicketTypeId] = useState<string>("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // When ticket type changes, load default responders and pre-populate
  useEffect(() => {
    if (!ticketTypeId) return;
    void (async () => {
      const result = await getTicketTypeDefaultRespondersAction(ticketTypeId);
      if (result.success && result.data.length > 0) {
        const defaultIds = result.data.map((r) => r.responder_user_id);
        setAssigneeIds((prev) => {
          const merged = [...new Set([...prev, ...defaultIds])];
          return merged;
        });
      }
      // Pre-fill priority from ticket type
      const selectedType = ticketTypes.find((tt) => tt.id === ticketTypeId);
      if (selectedType?.default_priority) {
        setPriority(selectedType.default_priority);
      }
    })();
  }, [ticketTypeId, ticketTypes]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("tickets.validation.titleRequired");
    if (assigneeIds.length === 0) errs.assignees = t("tickets.validation.responderRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const descriptionPlain = extractPlainText(descriptionRich);
      const result = await createTicketAction({
        title: title.trim(),
        description_plain: descriptionPlain || undefined,
        description_rich: descriptionRich,
        status: "waiting_response",
        priority,
        ticket_type_id: ticketTypeId || undefined,
        assignee_user_ids: assigneeIds,
      });

      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }

      toast.success(t("tickets.created", { number: result.data.ticket_number }));
      router.push({
        pathname: "/dashboard/help-desk/tickets/[ticketId]",
        params: { ticketId: result.data.id },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = ticketTypes.find((tt) => tt.id === ticketTypeId);
  const allowsManualAssignees = selectedType?.allows_manual_assignees ?? true;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
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

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("tickets.newTicket")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("tickets.newTicketSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Ticket Type */}
        <div className="space-y-2">
          <Label htmlFor="ticketTypeId">{t("tickets.fields.ticketType")}</Label>
          <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
            <SelectTrigger id="ticketTypeId">
              <SelectValue placeholder={t("tickets.fields.ticketTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {ticketTypes.map((tt) => (
                <SelectItem key={tt.id} value={tt.id}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tt.color }} />
                    {tt.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType?.description && (
            <p className="text-muted-foreground text-xs">{selectedType.description}</p>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            {t("tickets.fields.title")}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("tickets.fields.titlePlaceholder")}
            maxLength={255}
            disabled={isSubmitting}
          />
          {errors.title && <p className="text-destructive text-xs">{errors.title}</p>}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">{t("tickets.fields.priority")}</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TicketPriority)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`tickets.priority.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Responders */}
        <div className="space-y-2">
          <Label>
            {t("tickets.fields.responders")}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <MemberSelector
            members={members}
            selectedIds={assigneeIds}
            onChange={setAssigneeIds}
            placeholder={t("tickets.fields.respondersPlaceholder")}
            disabled={isSubmitting || !allowsManualAssignees}
          />
          {errors.assignees && <p className="text-destructive text-xs">{errors.assignees}</p>}
          {!allowsManualAssignees && (
            <p className="text-muted-foreground text-xs">{t("tickets.fields.respondersFixed")}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>{t("tickets.fields.description")}</Label>
          <RichTextEditorField
            value={descriptionRich}
            onChange={setDescriptionRich}
            mode="simple"
            placeholder={t("tickets.fields.descriptionPlaceholder")}
            disabled={isSubmitting}
            maxLength={10000}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("tickets.submitting")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("tickets.submit")}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/help-desk/tickets")}
            disabled={isSubmitting}
          >
            {t("tickets.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
