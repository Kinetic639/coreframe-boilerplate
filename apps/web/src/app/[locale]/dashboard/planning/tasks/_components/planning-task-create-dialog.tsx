"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";
import type { PlanningPriorityBadgeConfig } from "@/components/planning/planning-task-priority-badge";
import { PlanningTaskCreateForm } from "./planning-task-create-form";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface BranchOption {
  id: string;
  name: string;
}

interface PlanningTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  branches: BranchOption[];
  activeBranchId: string | null;
  currentUserId: string;
  canAssign: boolean;
  onCreated: (task: PlanningTaskDetail) => void;
  priorityConfigs: Record<string, PlanningPriorityBadgeConfig> | null;
  initialDueAt?: string;
}

export function PlanningTaskCreateDialog({
  open,
  onOpenChange,
  members,
  branches,
  activeBranchId,
  currentUserId,
  canAssign,
  onCreated,
  priorityConfigs,
  initialDueAt,
}: PlanningTaskCreateDialogProps) {
  const t = useTranslations("modules.planning.tasks");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("createTask")}</DialogTitle>
        </DialogHeader>

        <PlanningTaskCreateForm
          members={members}
          branches={branches}
          activeBranchId={activeBranchId}
          currentUserId={currentUserId}
          canAssign={canAssign}
          priorityConfigs={priorityConfigs}
          initialDueAt={initialDueAt}
          onSubmittingChange={setSubmitting}
          onCancel={() => {
            if (!submitting) onOpenChange(false);
          }}
          onCreated={(task) => {
            onOpenChange(false);
            onCreated(task);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
