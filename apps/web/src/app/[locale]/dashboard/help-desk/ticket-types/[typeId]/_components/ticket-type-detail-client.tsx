"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeft, Pencil, Trash2, GitBranch, Building2, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { deleteTicketTypeAction } from "@/app/actions/help-desk";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { MemberOption } from "@/components/help-desk/member-selector";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { TicketTypeFormDialog } from "../../_components/ticket-type-form-dialog";

interface TicketTypeDetailClientProps {
  type: HelpdeskTicketTypeWithDetails;
  members: MemberOption[];
  availableBranches: Array<{ id: string; name: string }>;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
}

export function TicketTypeDetailClient({
  type: initialType,
  members,
  availableBranches,
  priorityConfigs,
}: TicketTypeDetailClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchMap = new Map(availableBranches.map((b) => [b.id, b.name]));

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteTicketTypeAction(type.id);
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      toast.success(t("ticketTypes.deleteSuccess"));
      router.push("/dashboard/help-desk/ticket-types");
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/help-desk/ticket-types")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("ticketTypes.backToList")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            {t("ticketTypes.editType")}
          </Button>
          {!type.is_system && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <span
          className="mt-1.5 h-5 w-5 shrink-0 rounded-full"
          style={{ backgroundColor: type.color }}
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{type.name}</h1>
          {type.description && <p className="text-muted-foreground text-sm">{type.description}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {!type.is_active && <Badge variant="secondary">{t("ticketTypes.inactive")}</Badge>}
            {type.scope === "branch" ? (
              <Badge variant="outline" className="gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                {branchMap.get(type.branch_id ?? "") ?? t("ticketTypes.scopeBranch")}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {t("ticketTypes.scopeOrg")}
              </Badge>
            )}
            {type.requires_acceptance && (
              <Badge variant="outline" className="gap-1 text-green-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("tickets.fields.requiresAcceptance")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Properties */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("tickets.fields.priority")}
          </p>
          <p className="font-medium">
            {priorityConfigs?.[type.default_priority]?.label ?? type.default_priority}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("ticketTypes.allowsManualAssignees")}
          </p>
          <p className="font-medium">{type.allows_manual_assignees ? "Yes" : "No"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("ticketTypes.requiresAcceptance")}
          </p>
          <p className="font-medium">{type.requires_acceptance ? "Yes" : "No"}</p>
        </div>
      </div>

      {/* Default responders */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <h3 className="font-semibold">{t("ticketTypes.defaultAssignees")}</h3>
          <span className="text-muted-foreground text-sm">({type.default_responders.length})</span>
        </div>
        {type.default_responders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("ticketTypes.noDefaultAssignees")}</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {type.default_responders.map((r) => (
              <div
                key={r.responder_user_id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="font-medium text-sm">
                  {r.responder_name ?? r.responder_email ?? r.responder_user_id}
                </span>
                {r.responder_email && r.responder_name && (
                  <span className="text-muted-foreground text-xs">{r.responder_email}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default acceptors */}
      {type.requires_acceptance && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
            <h3 className="font-semibold">{t("ticketTypes.defaultAcceptors")}</h3>
            <span className="text-muted-foreground text-sm">({type.default_acceptors.length})</span>
          </div>
          {type.default_acceptors.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("ticketTypes.noDefaultAcceptors")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {type.default_acceptors.map((a) => (
                <div key={a.user_id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-medium text-sm">
                    {a.user_name ?? a.user_email ?? a.user_id}
                  </span>
                  {a.user_email && a.user_name && (
                    <span className="text-muted-foreground text-xs">{a.user_email}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <TicketTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingType={type}
        members={members}
        availableBranches={availableBranches}
        priorityConfigs={priorityConfigs}
        onSaved={(saved) => {
          setType(saved);
          setFormOpen(false);
        }}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ticketTypes.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ticketTypes.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("tickets.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
