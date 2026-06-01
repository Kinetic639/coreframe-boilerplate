"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TicketStatusBadge } from "@/components/help-desk/ticket-status-badge";
import { TicketPriorityBadge } from "@/components/help-desk/ticket-priority-badge";
import { saveHelpdeskSettingsAction } from "@/app/actions/help-desk";
import type {
  HelpdeskSettingsRow,
  HelpdeskBadgeConfig,
} from "@/server/services/helpdesk-ticket-types.service";
import { TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/validations/helpdesk";
import type { TicketStatus, TicketPriority } from "@/lib/validations/helpdesk";

const DEFAULT_STATUS_COLORS: Record<TicketStatus, string> = {
  open: "#3b82f6",
  in_progress: "#eab308",
  waiting: "#f97316",
  waiting_response: "#a855f7",
  resolved: "#22c55e",
  closed: "#6b7280",
  cancelled: "#ef4444",
};

const DEFAULT_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  waiting_response: "Waiting Response",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const DEFAULT_PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

const DEFAULT_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

interface HelpDeskSettingsClientProps {
  settings: HelpdeskSettingsRow | null;
}

export function HelpDeskSettingsClient({ settings }: HelpDeskSettingsClientProps) {
  const t = useTranslations("modules.helpDesk");
  const [isPending, startTransition] = useTransition();

  const [statusConfigs, setStatusConfigs] = useState<Record<string, HelpdeskBadgeConfig>>(() => {
    const saved = settings?.status_configs ?? {};
    return Object.fromEntries(
      TICKET_STATUSES.map((s) => [
        s,
        {
          label: saved[s]?.label ?? DEFAULT_STATUS_LABELS[s],
          color: saved[s]?.color ?? DEFAULT_STATUS_COLORS[s],
        },
      ])
    );
  });

  const [priorityConfigs, setPriorityConfigs] = useState<Record<string, HelpdeskBadgeConfig>>(
    () => {
      const saved = settings?.priority_configs ?? {};
      return Object.fromEntries(
        TICKET_PRIORITIES.map((p) => [
          p,
          {
            label: saved[p]?.label ?? DEFAULT_PRIORITY_LABELS[p],
            color: saved[p]?.color ?? DEFAULT_PRIORITY_COLORS[p],
          },
        ])
      );
    }
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveHelpdeskSettingsAction({
        status_configs: statusConfigs as any,
        priority_configs: priorityConfigs as any,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
      } else {
        toast.success(t("settings.settingsSaved"));
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.settings.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pages.settings.subtitle")}</p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving…" : t("settings.saveSettings")}
        </Button>
      </div>

      <Separator />

      {/* Statuses */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("settings.statuses")}</h2>
          <p className="text-muted-foreground text-sm">{t("settings.statusesDescription")}</p>
        </div>
        <div className="space-y-3">
          {TICKET_STATUSES.map((status) => {
            const cfg = statusConfigs[status];
            return (
              <div key={status} className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <TicketStatusBadge status={status} config={cfg} />
                </div>
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("settings.labelField")}
                    </Label>
                    <Input
                      value={cfg.label}
                      onChange={(e) =>
                        setStatusConfigs((prev) => ({
                          ...prev,
                          [status]: { ...prev[status], label: e.target.value },
                        }))
                      }
                      className="h-8 text-sm"
                      maxLength={50}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("settings.colorField")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={cfg.color}
                        onChange={(e) =>
                          setStatusConfigs((prev) => ({
                            ...prev,
                            [status]: { ...prev[status], color: e.target.value },
                          }))
                        }
                        className="h-8 w-12 cursor-pointer rounded border p-0.5"
                      />
                      <Input
                        value={cfg.color}
                        onChange={(e) =>
                          setStatusConfigs((prev) => ({
                            ...prev,
                            [status]: { ...prev[status], color: e.target.value },
                          }))
                        }
                        className="h-8 w-24 font-mono text-xs"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Priorities */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("settings.priorities")}</h2>
          <p className="text-muted-foreground text-sm">{t("settings.prioritiesDescription")}</p>
        </div>
        <div className="space-y-3">
          {TICKET_PRIORITIES.map((priority) => {
            const cfg = priorityConfigs[priority];
            return (
              <div key={priority} className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <TicketPriorityBadge priority={priority} config={cfg} />
                </div>
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("settings.labelField")}
                    </Label>
                    <Input
                      value={cfg.label}
                      onChange={(e) =>
                        setPriorityConfigs((prev) => ({
                          ...prev,
                          [priority]: { ...prev[priority], label: e.target.value },
                        }))
                      }
                      className="h-8 text-sm"
                      maxLength={50}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      {t("settings.colorField")}
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={cfg.color}
                        onChange={(e) =>
                          setPriorityConfigs((prev) => ({
                            ...prev,
                            [priority]: { ...prev[priority], color: e.target.value },
                          }))
                        }
                        className="h-8 w-12 cursor-pointer rounded border p-0.5"
                      />
                      <Input
                        value={cfg.color}
                        onChange={(e) =>
                          setPriorityConfigs((prev) => ({
                            ...prev,
                            [priority]: { ...prev[priority], color: e.target.value },
                          }))
                        }
                        className="h-8 w-24 font-mono text-xs"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
