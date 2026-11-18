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
      {/* Full screen on a phone; a large window elsewhere (wide enough for the side tabs). */}
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(90dvh,900px)] sm:w-[calc(100vw-2rem)] sm:max-w-6xl sm:rounded-lg sm:border">
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
