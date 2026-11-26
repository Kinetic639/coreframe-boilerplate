"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MemberOption } from "@/components/help-desk/member-selector";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import type { HelpdeskTicketType } from "@/server/services/helpdesk-ticket-types.service";
import { ticketKeys } from "@/lib/help-desk/ticket-queries";
import { NewTicketForm } from "../new/_components/new-ticket-form";

/**
 * "New ticket" on the list: the form in a dialog (a full screen on a phone),
 * as tasks are created. The new ticket then opens in the list's side panel.
 */
export function NewTicketDialog({
  orgId,
  ticketTypes,
  members,
  activeBranchId,
  priorityConfigs,
}: {
  orgId: string;
  ticketTypes: HelpdeskTicketType[];
  members: MemberOption[];
  activeBranchId: string | null;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}) {
  const t = useTranslations("modules.helpDesk");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A fresh form each time the dialog opens.
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  function created(ticketNumber: string) {
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ticketKeys.lists(orgId) });
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("selected", ticketNumber);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        <Plus className="mr-1.5 size-3.5" />
        {t("tickets.createTicket")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && submitting) return;
          setOpen(next);
        }}
      >
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-[920px] sm:rounded-lg sm:border">
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-6">
            <DialogTitle>{t("tickets.newTicket")}</DialogTitle>
          </DialogHeader>
          <NewTicketForm
            key={formKey}
            variant="dialog"
            ticketTypes={ticketTypes}
            members={members}
            activeBranchId={activeBranchId}
            statusConfigs={null}
            priorityConfigs={priorityConfigs}
            onCreated={created}
            onCancel={() => setOpen(false)}
            onSubmittingChange={setSubmitting}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
