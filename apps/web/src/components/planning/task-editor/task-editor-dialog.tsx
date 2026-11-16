"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TaskEditor, type TaskEditorProps } from "./task-editor";

/** The task editor in a window (board, task list, calendar). Closed when taskRef is null. */
export function TaskEditorDialog({
  taskRef,
  onClose,
  ...props
}: Omit<TaskEditorProps, "taskRef" | "onClose" | "renderTitle"> & {
  taskRef: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(taskRef)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {taskRef ? (
          <TaskEditor
            {...props}
            taskRef={taskRef}
            onClose={onClose}
            renderTitle={(title) => <DialogTitle asChild>{title}</DialogTitle>}
          />
        ) : (
          <DialogTitle className="sr-only">…</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
