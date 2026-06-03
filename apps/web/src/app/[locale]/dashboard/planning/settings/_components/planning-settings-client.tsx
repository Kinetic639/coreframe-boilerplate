"use client";

import { useState, useTransition } from "react";
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

const DEFAULT_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DEFAULT_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#6b7280",
  normal: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

const DEFAULT_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

interface PlanningSettingsClientProps {
  settings: PlanningSettingsRow | null;
}

export function PlanningSettingsClient({ settings }: PlanningSettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  const [statusConfigs, setStatusConfigs] = useState<Record<string, PlanningBadgeConfig>>(() => {
    const saved = settings?.status_configs ?? {};
    return Object.fromEntries(
      TASK_STATUSES.map((s) => [
        s,
        {
          label: saved[s]?.label ?? DEFAULT_STATUS_LABELS[s as TaskStatus],
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
            label: saved[p]?.label ?? DEFAULT_PRIORITY_LABELS[p as TaskPriority],
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
      try {
        const result = await savePlanningSettingsAction({
          status_configs: statusConfigs,
          priority_configs: priorityConfigs,
        });
        if (!result.success) {
          toast.error((result as { success: false; error: string }).error);
        } else {
          toast.success("Settings saved");
        }
      } catch {
        toast.error("Failed to save settings");
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planning Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Customize status and priority labels and colors for your tasks.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <Separator />

      {/* Statuses */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Statuses</h2>
        {TASK_STATUSES.map((status) => {
          const cfg = statusConfigs[status]!;
          return (
            <div key={status} className="flex items-center gap-4">
              <div className="w-36">
                <PlanningTaskStatusBadge
                  status={status}
                  // @ts-expect-error custom color preview
                  style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color, border: 0 }}
                  className="text-xs font-medium"
                />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={cfg.label}
                  onChange={(e) => updateStatus(status, "label", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Label"
                />
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    value={cfg.color}
                    onChange={(e) => updateStatus(status, "color", e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                    title="Pick color"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Priorities */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Priorities</h2>
        {TASK_PRIORITIES.map((priority) => {
          const cfg = priorityConfigs[priority]!;
          return (
            <div key={priority} className="flex items-center gap-4">
              <div className="w-36">
                <PlanningTaskPriorityBadge
                  priority={priority}
                  // @ts-expect-error custom color preview
                  style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color, border: 0 }}
                  className="text-xs font-medium"
                />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={cfg.label}
                  onChange={(e) => updatePriority(priority, "label", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Label"
                />
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    value={cfg.color}
                    onChange={(e) => updatePriority(priority, "color", e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                    title="Pick color"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
