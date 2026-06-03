"use client";

import { useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
} from "@/components/primitives/rich-text/rich-text-utils";
import { createTaskAction } from "@/app/actions/planning";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/validations/planning";
import type { PlanningTaskDetail } from "@/server/services/planning-tasks.service";

interface Member {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface PlanningTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  currentUserId: string;
  onCreated: (task: PlanningTaskDetail) => void;
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function PlanningTaskCreateDialog({
  open,
  onOpenChange,
  members,
  currentUserId,
  onCreated,
}: PlanningTaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [descriptionRich, setDescriptionRich] = useState<RichTextValue>(createEmptyRichText);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState<string>("__unassigned__");
  const [dueAt, setDueAt] = useState<string>("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescriptionRich(createEmptyRichText);
    setPriority("normal");
    setAssignedTo("__unassigned__");
    setDueAt("");
    setTitleError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onOpenChange(false);
  }

  async function handleSubmit(assignToMe = false) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required");
      return;
    }
    setTitleError(null);
    setSubmitting(true);

    const descriptionPlain = extractPlainText(descriptionRich as any);
    const hasDescription = descriptionPlain.trim().length > 0;

    try {
      const result = await createTaskAction({
        title: trimmedTitle,
        description_plain: hasDescription ? descriptionPlain : undefined,
        description_rich: hasDescription ? descriptionRich : undefined,
        priority,
        assigned_to: assignToMe
          ? currentUserId
          : assignedTo === "__unassigned__"
            ? null
            : assignedTo || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });

      if (!result.success) {
        toast.error((result as { success: false; error: string }).error ?? "Failed to create task");
        return;
      }

      toast.success("Task created");
      reset();
      onOpenChange(false);
      onCreated(result.data);
    } catch {
      toast.error("Failed to create task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError && e.target.value.trim()) setTitleError(null);
              }}
              placeholder="Enter task title…"
              disabled={submitting}
              autoFocus
            />
            {titleError && <p className="text-destructive text-xs">{titleError}</p>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <div className="border-input rounded-md border">
              <RichTextEditorField
                value={descriptionRich}
                onChange={setDescriptionRich}
                placeholder="Add a description…"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Priority + Assignee row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name ?? m.email ?? m.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <div className="w-48">
              <Input
                id="task-due"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            Create &amp; assign to me
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
