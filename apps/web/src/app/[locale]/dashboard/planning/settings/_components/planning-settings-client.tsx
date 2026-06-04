"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PlanningTaskStatusBadge } from "@/components/planning/planning-task-status-badge";
import { PlanningTaskPriorityBadge } from "@/components/planning/planning-task-priority-badge";
import { savePlanningSettingsAction } from "@/app/actions/planning";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/validations/planning";
import type { TaskStatus, TaskPriority } from "@/lib/validations/planning";
import type {
  PlanningSettingsRow,
  PlanningBadgeConfig,
} from "@/server/services/planning-settings.service";

const DEFAULT_STATUS_COLORS: Record<TaskStatus, string> = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  cancelled: "#6b7280",
};

const DEFAULT_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#6b7280",
  normal: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

interface PlanningSettingsClientProps {
  settings: PlanningSettingsRow | null;
}

export function PlanningSettingsClient({ settings }: PlanningSettingsClientProps) {
  const t = useTranslations("modules.planning");
  const [isPending, startTransition] = useTransition();

  const [statusConfigs, setStatusConfigs] = useState<Record<string, PlanningBadgeConfig>>(() => {
    const saved = settings?.status_configs ?? {};
    return Object.fromEntries(
      TASK_STATUSES.map((s) => [
        s,
        {
          label: saved[s]?.label ?? t(`tasks.${s === "in_progress" ? "inProgress" : s}`),
          color: saved[s]?.color ?? DEFAULT_STATUS_COLORS[s as TaskStatus],
        },
      ])
    );
  });

  const [priorityConfigs, setPriorityConfigs] = useState<Record<string, PlanningBadgeConfig>>(
    () => {
      const saved = settings?.priority_configs ?? {};
      return Object.fromEntries(
        TASK_PRIORITIES.map((p) => [
          p,
          {
            label: saved[p]?.label ?? t(`tasks.${p}`),
            color: saved[p]?.color ?? DEFAULT_PRIORITY_COLORS[p as TaskPriority],
          },
        ])
      );
    }
  );

  function updateStatus(key: string, field: "label" | "color", value: string) {
    setStatusConfigs((prev) => ({ ...prev, [key]: { ...prev[key]!, [field]: value } }));
  }

  function updatePriority(key: string, field: "label" | "color", value: string) {
    setPriorityConfigs((prev) => ({ ...prev, [key]: { ...prev[key]!, [field]: value } }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await savePlanningSettingsAction({
        status_configs: statusConfigs,
        priority_configs: priorityConfigs,
      });
      if (!result.success) {
        toast.error(t("settings.saveFailed"));
      } else {
        toast.success(t("settings.settingsSaved"));
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.settings.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pages.settings.subtitle")}</p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? t("settings.saving") : t("settings.saveSettings")}
        </Button>
      </div>

      <Separator />

      {/* Statuses */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("settings.statuses")}</h2>
          <p className="text-muted-foreground text-sm">{t("settings.statusesDescription")}</p>
        </div>
        {TASK_STATUSES.map((status) => {
          const cfg = statusConfigs[status]!;
          return (
            <div key={status} className="flex items-center gap-4">
              <div className="w-32 shrink-0">
                <PlanningTaskStatusBadge status={status} config={cfg} />
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-muted-foreground text-xs">
                    {t("settings.labelField")}
                  </Label>
                  <Input
                    value={cfg.label}
                    onChange={(e) => updateStatus(status, "label", e.target.value)}
                    className="h-8 text-sm"
                    maxLength={50}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-xs">
                    {t("settings.colorField")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.color}
                      onChange={(e) => updateStatus(status, "color", e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border p-0.5"
                    />
                    <Input
                      value={cfg.color}
                      onChange={(e) => updateStatus(status, "color", e.target.value)}
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

      <Separator />

      {/* Priorities */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">{t("settings.priorities")}</h2>
          <p className="text-muted-foreground text-sm">{t("settings.prioritiesDescription")}</p>
        </div>
        {TASK_PRIORITIES.map((priority) => {
          const cfg = priorityConfigs[priority]!;
          return (
            <div key={priority} className="flex items-center gap-4">
              <div className="w-32 shrink-0">
                <PlanningTaskPriorityBadge priority={priority} config={cfg} />
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-muted-foreground text-xs">
                    {t("settings.labelField")}
                  </Label>
                  <Input
                    value={cfg.label}
                    onChange={(e) => updatePriority(priority, "label", e.target.value)}
                    className="h-8 text-sm"
                    maxLength={50}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-xs">
                    {t("settings.colorField")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cfg.color}
                      onChange={(e) => updatePriority(priority, "color", e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border p-0.5"
                    />
                    <Input
                      value={cfg.color}
                      onChange={(e) => updatePriority(priority, "color", e.target.value)}
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
  );
}
