"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberSelector } from "@/components/help-desk/member-selector";
import type { MemberOption } from "@/components/help-desk/member-selector";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import {
  createTicketTypeWithRespondersAction,
  updateTicketTypeWithRespondersAction,
} from "@/app/actions/help-desk";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import { TICKET_PRIORITIES } from "@/lib/validations/helpdesk";

interface TicketTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingType: HelpdeskTicketTypeWithDetails | null;
  members: MemberOption[];
  availableBranches: Array<{ id: string; name: string }>;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  onSaved: (type?: HelpdeskTicketTypeWithDetails) => void;
}

export function TicketTypeFormDialog({
  open,
  onOpenChange,
  editingType,
  members,
  availableBranches,
  priorityConfigs,
  onSaved,
}: TicketTypeFormDialogProps) {
  const t = useTranslations("modules.helpDesk");
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [defaultPriority, setDefaultPriority] = useState("medium");
  const [allowsManualAssignees, setAllowsManualAssignees] = useState(true);
  const [scope, setScope] = useState<"org" | "branch">("org");
  const [branchId, setBranchId] = useState<string>("");
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [responderIds, setResponderIds] = useState<string[]>([]);
  const [acceptorIds, setAcceptorIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when editing
  useEffect(() => {
    if (editingType) {
      setName(editingType.name);
      setDescription(editingType.description ?? "");
      setColor(editingType.color);
      setDefaultPriority(editingType.default_priority);
      setAllowsManualAssignees(editingType.allows_manual_assignees);
      setScope(editingType.scope ?? "org");
      setBranchId(editingType.branch_id ?? "");
      setRequiresAcceptance(editingType.requires_acceptance ?? false);
      setResponderIds(editingType.default_responders.map((r) => r.responder_user_id));
      setAcceptorIds(editingType.default_acceptors.map((a) => a.user_id));
    } else {
      setName("");
      setDescription("");
      setColor("#6366f1");
      setDefaultPriority("medium");
      setAllowsManualAssignees(true);
      setScope("org");
      setBranchId("");
      setRequiresAcceptance(false);
      setResponderIds([]);
      setAcceptorIds([]);
    }
    setErrors({});
  }, [editingType, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (scope === "branch" && !branchId) errs.branchId = t("ticketTypes.branchRequired");
    if (requiresAcceptance && acceptorIds.length === 0)
      errs.acceptorIds = t("tickets.validation.acceptorRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: "ticket",
        default_priority: defaultPriority as any,
        allows_manual_assignees: allowsManualAssignees,
        scope,
        branch_id: scope === "branch" ? branchId || null : null,
        requires_acceptance: requiresAcceptance,
        responder_user_ids: responderIds,
        acceptor_user_ids: acceptorIds,
      };

      let result;
      if (editingType) {
        result = await updateTicketTypeWithRespondersAction({
          id: editingType.id,
          ...payload,
        } as any);
      } else {
        result = await createTicketTypeWithRespondersAction(payload as any);
      }

      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }

      toast.success(editingType ? t("ticketTypes.updateSuccess") : t("ticketTypes.createSuccess"));

      // Build the full details object for local state update
      const memberMap = new Map(members.map((m) => [m.user_id, m]));
      const savedType: HelpdeskTicketTypeWithDetails = {
        ...result.data,
        scope: scope,
        branch_id: scope === "branch" ? branchId || null : null,
        requires_acceptance: requiresAcceptance,
        default_responders: responderIds.map((uid) => {
          const m = memberMap.get(uid);
          return {
            id: `temp-${uid}`,
            org_id: result.data.org_id,
            ticket_type_id: result.data.id,
            responder_user_id: uid,
            responder_name: m?.name ?? null,
            responder_email: m?.email ?? null,
            created_at: new Date().toISOString(),
          };
        }),
        default_acceptors: acceptorIds.map((uid) => {
          const m = memberMap.get(uid);
          return {
            id: `temp-${uid}`,
            org_id: result.data.org_id,
            ticket_type_id: result.data.id,
            user_id: uid,
            user_name: m?.name ?? null,
            user_email: m?.email ?? null,
            created_at: new Date().toISOString(),
          };
        }),
      };

      onSaved(savedType);
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!editingType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("ticketTypes.editType") : t("ticketTypes.createType")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tt-name">
              {t("tickets.fields.title")}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="tt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={isSaving}
            />
            {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tt-desc">{t("tickets.description")}</Label>
            <Textarea
              id="tt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={isSaving}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>{t("settings.colorField")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border p-0.5"
                disabled={isSaving}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 font-mono text-sm"
                maxLength={7}
                disabled={isSaving}
              />
              <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: color }} />
            </div>
          </div>

          {/* Default priority */}
          <div className="space-y-1.5">
            <Label>{t("tickets.fields.priority")}</Label>
            <Select value={defaultPriority} onValueChange={setDefaultPriority} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityConfigs?.[p]?.label ?? t(`tickets.priority.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Allows manual assignees */}
          <div className="flex items-center justify-between">
            <Label>{t("tickets.fields.responders")}</Label>
            <Switch
              checked={allowsManualAssignees}
              onCheckedChange={setAllowsManualAssignees}
              disabled={isSaving}
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>{t("ticketTypes.scope")}</Label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope(v as "org" | "branch");
                if (v === "org") setBranchId("");
              }}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org">{t("ticketTypes.scopeOrg")}</SelectItem>
                <SelectItem value="branch">{t("ticketTypes.scopeBranch")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Branch selector */}
          {scope === "branch" && (
            <div className="space-y-1.5">
              <Label>
                {t("ticketTypes.branchLabel")}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder={t("ticketTypes.branchPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branchId && <p className="text-destructive text-xs">{errors.branchId}</p>}
            </div>
          )}

          {/* Default assignees */}
          <div className="space-y-1.5">
            <Label>{t("ticketTypes.defaultAssignees")}</Label>
            <MemberSelector
              members={members}
              selectedIds={responderIds}
              onChange={setResponderIds}
              placeholder={t("ticketTypes.defaultAssigneesPlaceholder")}
              disabled={isSaving}
            />
          </div>

          {/* Requires acceptance */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("ticketTypes.requiresAcceptance")}</Label>
              <p className="text-muted-foreground text-xs">
                {t("ticketTypes.requiresAcceptanceHint")}
              </p>
            </div>
            <Switch
              checked={requiresAcceptance}
              onCheckedChange={(v) => {
                setRequiresAcceptance(v);
                if (!v) setAcceptorIds([]);
              }}
              disabled={isSaving}
            />
          </div>

          {/* Default acceptors */}
          {requiresAcceptance && (
            <div className="space-y-1.5">
              <Label>
                {t("ticketTypes.defaultAcceptors")}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <MemberSelector
                members={members}
                selectedIds={acceptorIds}
                onChange={setAcceptorIds}
                placeholder={t("ticketTypes.defaultAcceptorsPlaceholder")}
                disabled={isSaving}
              />
              {errors.acceptorIds && (
                <p className="text-destructive text-xs">{errors.acceptorIds}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("tickets.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? "Saving…"
              : isEditing
                ? t("ticketTypes.updateSuccess").split(".")[0]
                : t("ticketTypes.createType")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
