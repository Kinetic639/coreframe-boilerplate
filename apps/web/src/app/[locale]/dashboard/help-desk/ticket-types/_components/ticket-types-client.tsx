"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, GitBranch, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TicketTypeFormDialog } from "./ticket-type-form-dialog";

interface TicketTypesClientProps {
  initialTypes: HelpdeskTicketTypeWithDetails[];
  members: MemberOption[];
  availableBranches: Array<{ id: string; name: string }>;
}

export function TicketTypesClient({
  initialTypes,
  members,
  availableBranches,
}: TicketTypesClientProps) {
  const t = useTranslations("modules.helpDesk");
  const [types, setTypes] = useState(initialTypes);
  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<HelpdeskTicketTypeWithDetails | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchMap = new Map(availableBranches.map((b) => [b.id, b.name]));

  const handleOpenCreate = () => {
    setEditingType(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (type: HelpdeskTicketTypeWithDetails) => {
    setEditingType(type);
    setFormOpen(true);
  };

  const handleSaved = (saved: HelpdeskTicketTypeWithDetails) => {
    setTypes((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const result = await deleteTicketTypeAction(deletingId);
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      setTypes((prev) => prev.filter((t) => t.id !== deletingId));
      toast.success(t("ticketTypes.deleteSuccess"));
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.ticketTypes.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pages.ticketTypes.subtitle")}</p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("ticketTypes.createType")}
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground text-sm">{t("empty.noTicketTypes")}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("empty.noTicketTypesDescription")}
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("ticketTypes.createType")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {types.map((type) => (
            <div
              key={type.id}
              className="border-border bg-card flex items-start gap-4 rounded-lg border p-4"
            >
              {/* Color swatch */}
              <div
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: type.color }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{type.name}</span>
                  {!type.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                  {type.scope === "branch" ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <GitBranch className="h-3 w-3" />
                      {branchMap.get(type.branch_id ?? "") ?? "Branch"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Building2 className="h-3 w-3" />
                      {t("ticketTypes.scopeOrg")}
                    </Badge>
                  )}
                  {type.requires_acceptance && (
                    <Badge variant="outline" className="text-xs">
                      {t("tickets.fields.requiresAcceptance")}
                    </Badge>
                  )}
                </div>
                {type.description && (
                  <p className="text-muted-foreground text-sm">{type.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {t("ticketTypes.defaultAssignees")}: {type.default_responders.length}
                  </span>
                  {type.requires_acceptance && (
                    <span>
                      {t("ticketTypes.defaultAcceptors")}: {type.default_acceptors.length}
                    </span>
                  )}
                  <span>
                    {t("tickets.fields.priority")}: {type.default_priority}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenEdit(type)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!type.is_system && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(type.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <TicketTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingType={editingType}
        members={members}
        availableBranches={availableBranches}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
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
