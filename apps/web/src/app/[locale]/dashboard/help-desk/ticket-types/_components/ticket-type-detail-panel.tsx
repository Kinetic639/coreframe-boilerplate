"use client";

import { useTranslations } from "next-intl";
import {
  Pencil,
  Trash2,
  ExternalLink,
  GitBranch,
  Building2,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";

interface TicketTypeDetailPanelProps {
  type: HelpdeskTicketTypeWithDetails;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  onEdit: (type: HelpdeskTicketTypeWithDetails) => void;
  onDeleteRequest: (id: string) => void;
}

export function TicketTypeDetailPanel({
  type,
  priorityConfigs,
  onEdit,
  onDeleteRequest,
}: TicketTypeDetailPanelProps) {
  const t = useTranslations("modules.helpDesk");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: type.color }}
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-snug">{type.name}</h3>
            {type.description && (
              <p className="text-muted-foreground mt-0.5 text-sm">{type.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign(`/dashboard/help-desk/ticket-types/${type.id}`)}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t("ticketTypes.viewType")}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(type)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {!type.is_system && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDeleteRequest(type.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!type.is_active && (
          <Badge variant="secondary" className="text-xs">
            {t("ticketTypes.inactive")}
          </Badge>
        )}
        {type.scope === "branch" ? (
          <Badge variant="outline" className="gap-1 text-xs">
            <GitBranch className="h-3 w-3" />
            {t("ticketTypes.scopeBranch")}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs">
            <Building2 className="h-3 w-3" />
            {t("ticketTypes.scopeOrg")}
          </Badge>
        )}
        {type.requires_acceptance && (
          <Badge variant="outline" className="gap-1 text-xs text-green-700">
            <ShieldCheck className="h-3 w-3" />
            {t("tickets.fields.requiresAcceptance")}
          </Badge>
        )}
      </div>

      <Separator />

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("tickets.fields.priority")}
          </p>
          <p className="mt-0.5 font-medium">
            {priorityConfigs?.[type.default_priority]?.label ?? type.default_priority}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("ticketTypes.allowsManualAssignees")}
          </p>
          <p className="mt-0.5 font-medium">{type.allows_manual_assignees ? "Yes" : "No"}</p>
        </div>
      </div>

      {/* Default responders */}
      {type.default_responders.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t("ticketTypes.defaultAssignees")} ({type.default_responders.length})
            </div>
            <div className="space-y-1">
              {type.default_responders.map((r) => (
                <div key={r.responder_user_id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">
                    {r.responder_name ?? r.responder_email ?? r.responder_user_id}
                  </span>
                  {r.responder_email && r.responder_name && (
                    <span className="text-muted-foreground text-xs truncate">
                      {r.responder_email}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Default acceptors */}
      {type.requires_acceptance && type.default_acceptors.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("ticketTypes.defaultAcceptors")} ({type.default_acceptors.length})
            </div>
            <div className="space-y-1">
              {type.default_acceptors.map((a) => (
                <div key={a.user_id} className="flex items-center gap-2 text-sm">
                  <span className="truncate">{a.user_name ?? a.user_email ?? a.user_id}</span>
                  {a.user_email && a.user_name && (
                    <span className="text-muted-foreground text-xs truncate">{a.user_email}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
