"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { CheckCircle2, Loader2, Ticket as TicketIcon, ClipboardCheck, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { EntityPicker, type EntityPickerItem } from "@/components/features/qr";
import { PlanningTaskCreateForm } from "@/app/[locale]/dashboard/planning/tasks/_components/planning-task-create-form";
import { listTicketsForDataViewAction } from "@/app/actions/help-desk";
import { listTasksForDataViewAction, assignQrToPlanningTaskAction } from "@/app/actions/planning";
import { assignQrToTicketAction } from "@/app/actions/qr/assign";
import type { PlanningPriorityBadgeConfig } from "@/components/planning/planning-task-priority-badge";

type TargetType = "ticket" | "task";
type Mode = "existing" | "create";

interface MemberOption {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface QuickAssignWizardProps {
  qrCodeId: string;
  token: string;
  label: string | null;
  orgId: string;
  canCreateTicket: boolean;
  canCreateTask: boolean;
  canAssignTask: boolean;
  members: MemberOption[];
  currentUserId: string;
  taskPriorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
}

export function QuickAssignWizard({
  qrCodeId,
  token,
  label,
  orgId,
  canCreateTicket,
  canCreateTask,
  canAssignTask,
  members,
  currentUserId,
  taskPriorityConfigs,
}: QuickAssignWizardProps) {
  const t = useTranslations("qrAssign");
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetType | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState<{ targetType: TargetType; number: string } | null>(null);

  const searchTickets = async (query: string): Promise<EntityPickerItem[]> => {
    const result = await listTicketsForDataViewAction(
      { search: query, sort: null, page: 1, pageSize: 20, filters: {} },
      orgId
    );
    if (!result.success) return [];
    return result.data.rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.ticket_number,
    }));
  };

  const searchTasks = async (query: string): Promise<EntityPickerItem[]> => {
    const result = await listTasksForDataViewAction(
      { search: query, sort: null, page: 1, pageSize: 20, filters: {} },
      orgId
    );
    if (!result.success) return [];
    return result.data.rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.task_number,
    }));
  };

  const handleAssignExisting = async (item: EntityPickerItem, target: TargetType) => {
    setAssigning(true);
    try {
      if (target === "ticket") {
        const result = await assignQrToTicketAction({ qrCodeId, ticketId: item.id });
        if (!result.success) {
          toast.error((result as { success: false; error: string }).error);
          return;
        }
        setSuccess({ targetType: "ticket", number: item.subtitle ?? item.title });
      } else {
        const result = await assignQrToPlanningTaskAction({ qrCodeId, taskId: item.id });
        if (!result.success) {
          toast.error((result as { success: false; error: string }).error);
          return;
        }
        setSuccess({ targetType: "task", number: item.subtitle ?? item.title });
      }
      toast.success(t("assigned"));
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateTicket = () => {
    router.push({
      pathname: "/dashboard/help-desk/tickets/new",
      query: { qrCodeId, qrToken: token, ...(label ? { qrLabel: label } : {}) },
    });
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="text-lg font-semibold">{t("successTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("successBody", { name: success.number })}
        </p>
        <Button asChild className="w-full">
          {success.targetType === "ticket" ? (
            <Link
              href={{
                pathname: "/dashboard/help-desk/tickets/[ticketId]",
                params: { ticketId: success.number },
              }}
            >
              {t("viewItem")}
            </Link>
          ) : (
            <Link
              href={{
                pathname: "/dashboard/planning/tasks/[taskId]",
                params: { taskId: success.number },
              }}
            >
              {t("viewItem")}
            </Link>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <QrCode className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground font-mono">{label ?? token}</p>
        </div>
      </div>

      {/* Step 1: target type */}
      {!targetType && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetType("ticket")}
            className="flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition hover:border-primary hover:bg-muted/40"
          >
            <TicketIcon className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{t("targetTicket")}</span>
          </button>
          <button
            type="button"
            onClick={() => setTargetType("task")}
            className="flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition hover:border-primary hover:bg-muted/40"
          >
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{t("targetTask")}</span>
          </button>
        </div>
      )}

      {/* Step 2: mode */}
      {targetType && !mode && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setTargetType(null)}>
            {t("back")}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className="rounded-lg border p-4 text-center text-sm font-medium transition hover:border-primary hover:bg-muted/40"
            >
              {t("assignExisting")}
            </button>
            {targetType === "ticket" && canCreateTicket && (
              <button
                type="button"
                onClick={handleCreateTicket}
                className="rounded-lg border p-4 text-center text-sm font-medium transition hover:border-primary hover:bg-muted/40"
              >
                {t("createNew")}
              </button>
            )}
            {targetType === "task" && canCreateTask && (
              <button
                type="button"
                onClick={() => setMode("create")}
                className="rounded-lg border p-4 text-center text-sm font-medium transition hover:border-primary hover:bg-muted/40"
              >
                {t("createNew")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3a: assign to existing */}
      {targetType && mode === "existing" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
            {t("back")}
          </Button>
          <EntityPicker
            search={targetType === "ticket" ? searchTickets : searchTasks}
            onSelect={(item) => handleAssignExisting(item, targetType)}
            placeholder={targetType === "ticket" ? t("searchTickets") : t("searchTasks")}
            disabled={assigning}
          />
          {assigning && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("assigning")}
            </div>
          )}
        </div>
      )}

      {/* Step 3b: create new task (ticket creation redirects to its own page — see handleCreateTicket) */}
      {targetType === "task" && mode === "create" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
            {t("back")}
          </Button>
          <div className="rounded-lg border p-4">
            <PlanningTaskCreateForm
              members={members}
              currentUserId={currentUserId}
              canAssign={canAssignTask}
              priorityConfigs={taskPriorityConfigs}
              initialQrCodeId={qrCodeId}
              initialToken={token}
              initialLabel={label}
              onCancel={() => setMode(null)}
              onCreated={(task) => {
                setSuccess({ targetType: "task", number: task.task_number });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
